import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desfazerConclusao, dispensarRecomendacao, gravarPerfil, importarLegado, lerPerfil, lerEventos, recomendacaoDispensada, registrarConclusao, registrarQuestao, registrarRevisao } from './armazem.ts';
import { conceitosInvalidos } from './conceitos.ts';
import { vigentes, type Evento } from './eventos.ts';
import { estadoDoConceito } from './estados.ts';
import { diasDeEstudo, progressoDaMateria } from './metricas.ts';
import { estadoDoCartao, filaDoDia, somarDias, vencidos } from './revisao.ts';
import { aulaPrecisaRevisar, preRequisitosPendentes } from './jornada.ts';
import { planoDeHoje, type AulaDoPlano, type EntradaDoPlano } from './hoje.ts';
import { normalizarPerfil, tamanhoDaFila } from './perfil.ts';

/** localStorage de mentira. */
function falso(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return { getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => void (dados[k] = v) };
}
/** Meio-dia local do dia 10+n de outubro: não muda de dia em nenhum fuso. */
const dia = (n: number, hora = 12) => new Date(2026, 9, 10 + n, hora);
const resposta = (n: number, acertou: boolean, conceitoIds = ['mat/mmc']) => ({
  aulaId: 'enem/mat/a', numero: 1, acertou, conceitoIds, _quando: dia(n),
});
function responder(arm: ReturnType<typeof falso>, n: number, acertou: boolean) {
  const { _quando, ...dados } = resposta(n, acertou);
  registrarQuestao(dados, _quando, arm);
}

test('uma resposta gera exatamente um evento, com a questão identificada', () => {
  const arm = falso();
  responder(arm, 0, true);
  const eventos = lerEventos(arm);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].questaoId, 'enem/mat/a#q1');
  assert.equal(eventos[0].resultado, 'acertou');
});

test('importar o progresso antigo não perde dados e repetir não duplica', () => {
  const arm = falso({ 'cdt:progresso': JSON.stringify({ 'enem/mat/a': 1700000000000, 'enem/mat/b': 1700000100000 }) });
  importarLegado(arm);
  importarLegado(arm);
  const eventos = lerEventos(arm);
  assert.equal(eventos.length, 2);
  assert.deepEqual(eventos.map((e) => e.aulaId).sort(), ['enem/mat/a', 'enem/mat/b']);
  assert.equal(arm.getItem('cdt:progresso')?.includes('enem/mat/a'), true);
});

test('progresso antigo inválido não quebra', () => {
  const arm = falso({ 'cdt:progresso': '{quebrado' });
  importarLegado(arm);
  assert.deepEqual(lerEventos(arm), []);
});

test('desmarcar a aula anula a conclusão sem apagar o histórico', () => {
  const arm = falso();
  registrarConclusao('enem/mat/a', dia(0), arm);
  desfazerConclusao('enem/mat/a', dia(1), arm);
  const todos = lerEventos(arm);
  assert.equal(todos.length, 2);
  assert.deepEqual(vigentes(todos), []);
  assert.deepEqual(diasDeEstudo(vigentes(todos)), []);
  registrarConclusao('enem/mat/a', dia(2), arm);
  assert.equal(vigentes(lerEventos(arm)).length, 1);
});

test('armazenamento que recusa não derruba a interface', () => {
  const bloqueado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.deepEqual(lerEventos(bloqueado), []);
  assert.equal(registrarConclusao('enem/mat/a', dia(0), bloqueado), false);
});

test('estado do conceito: sem evidência, praticado, retido e precisa revisar', () => {
  const estado = (arm: ReturnType<typeof falso>) => estadoDoConceito(vigentes(lerEventos(arm)), 'mat/mmc');
  const arm = falso();
  assert.equal(estado(arm), 'nao-iniciado');
  responder(arm, 0, true);
  assert.equal(estado(arm), 'praticado');
  responder(arm, 0, true); // outro acerto no mesmo dia não basta
  assert.equal(estado(arm), 'praticado');
  responder(arm, 1, true);
  assert.equal(estado(arm), 'retido');
  responder(arm, 2, false); // erro posterior derruba
  assert.equal(estado(arm), 'precisa-revisar');
  responder(arm, 3, true);
  assert.equal(estado(arm), 'praticado');
});

test('conceito de outra matéria não entra na conta', () => {
  const arm = falso();
  responder(arm, 0, false);
  assert.equal(estadoDoConceito(vigentes(lerEventos(arm)), 'mat/outro'), 'nao-iniciado');
});

test('dias de estudo: só conclusão e resposta, um por dia', () => {
  const arm = falso();
  responder(arm, 0, true);
  responder(arm, 0, false);
  registrarConclusao('enem/mat/a', dia(2), arm);
  assert.deepEqual(diasDeEstudo(vigentes(lerEventos(arm))), ['2026-10-10', '2026-10-12']);
});

test('progresso da matéria ignora aulas que ainda não existem', () => {
  assert.equal(progressoDaMateria(3, 6), 0.5);
  assert.equal(progressoDaMateria(0, 0), 0);
});

test('conceitos: formato e cadastro', () => {
  const registro = { 'mat/mmc': { nome: 'MMC' } };
  assert.deepEqual(conceitosInvalidos(['mat/mmc'], registro), []);
  assert.deepEqual(conceitosInvalidos(['mat/mdc', 'MAT/mmc', 'mmc'], registro), ['mat/mdc', 'MAT/mmc', 'mmc']);
});

test('evento anulado deixa de contar para o estado', () => {
  const eventos: Evento[] = [
    { id: 'a', tipo: 'questao_respondida', quando: dia(0).toISOString(), conceitoIds: ['mat/mmc'], resultado: 'errou' },
    { id: 'c', tipo: 'correcao', quando: dia(1).toISOString(), conceitoIds: [], corrige: 'a' },
  ];
  assert.equal(estadoDoConceito(vigentes(eventos), 'mat/mmc'), 'nao-iniciado');
});

test('recomendação dispensada fica dispensada e não duplica', () => {
  const arm = falso();
  assert.equal(recomendacaoDispensada('enem/mat/a', arm), false);
  dispensarRecomendacao('enem/mat/a', arm);
  dispensarRecomendacao('enem/mat/a', arm);
  assert.equal(recomendacaoDispensada('enem/mat/a', arm), true);
  assert.equal(recomendacaoDispensada('enem/mat/b', arm), false);
  assert.deepEqual(JSON.parse(arm.getItem('cdt:v2:dispensadas')!), ['enem/mat/a']);
});

const rev = (arm: ReturnType<typeof falso>, cartaoId: string, n: number, resultado: 'lembrei' | 'dificil' | 'nao_lembrei') =>
  registrarRevisao({ cartaoId, aulaId: 'enem/mat/a', conceito: 'mat/mmc', resultado }, dia(n), arm);
const estadoCartao = (arm: ReturnType<typeof falso>, id: string) => estadoDoCartao(vigentes(lerEventos(arm)), id);

test('cartão novo: sem caixa e sem vencimento', () => {
  assert.deepEqual(estadoCartao(falso(), 'c1'), { caixa: 0, venceEm: null });
});

test('tabela das caixas: lembrei sobe e usa 3, 7, 14, 30 e 60 dias', () => {
  const arm = falso();
  const esperado = [[2, 3], [3, 7], [4, 14], [5, 30], [6, 60], [6, 60]];
  esperado.forEach(([caixa, dias], i) => {
    rev(arm, 'c1', i, 'lembrei');
    assert.deepEqual(estadoCartao(arm, 'c1'), { caixa, venceEm: somarDias(`2026-10-${10 + i}`, dias) });
  });
});

test('não lembrei volta à caixa 1 e vence em 1 dia', () => {
  const arm = falso();
  rev(arm, 'c1', 0, 'lembrei');
  rev(arm, 'c1', 3, 'lembrei');
  rev(arm, 'c1', 10, 'nao_lembrei');
  assert.deepEqual(estadoCartao(arm, 'c1'), { caixa: 1, venceEm: '2026-10-21' });
});

test('com dificuldade fica na caixa e repete o intervalo atual', () => {
  const arm = falso();
  rev(arm, 'c1', 0, 'lembrei'); // caixa 2
  rev(arm, 'c1', 3, 'lembrei'); // caixa 3, 7 dias
  rev(arm, 'c1', 10, 'dificil');
  assert.deepEqual(estadoCartao(arm, 'c1'), { caixa: 3, venceEm: '2026-10-27' });
  const novo = falso();
  rev(novo, 'c2', 0, 'dificil'); // novo + dificuldade: caixa 1
  assert.deepEqual(estadoCartao(novo, 'c2'), { caixa: 1, venceEm: '2026-10-11' });
});

test('fila do dia: vencidos antes dos novos, mais atrasado primeiro, com limite', () => {
  const arm = falso();
  rev(arm, 'a', 0, 'nao_lembrei'); // vence 11/10
  rev(arm, 'b', -5, 'nao_lembrei'); // vence 06/10
  rev(arm, 'c', 0, 'lembrei'); // vence 13/10 (ainda não)
  const ids = ['n1', 'a', 'b', 'c', 'n2'];
  const hoje = '2026-10-12';
  const v = vigentes(lerEventos(arm));
  assert.deepEqual(vencidos(v, ids, hoje), ['a', 'b']);
  const dia1 = filaDoDia(v, ids, hoje, 3);
  assert.deepEqual(dia1.fila, ['b', 'a', 'n1']);
  assert.equal(dia1.restantes, 1);
  assert.equal(dia1.vencidos, 2);
});

test('revisar duas vezes o mesmo cartão gera dois eventos; recarregar não cria mais', () => {
  const arm = falso();
  rev(arm, 'c1', 0, 'lembrei');
  rev(arm, 'c1', 0, 'lembrei'); // mesmo instante e mesmo cartão: mesmo id, ignorado
  assert.equal(lerEventos(arm).length, 1);
});

test('revisão conta como dia de estudo e "lembrei" como acerto do conceito', () => {
  const arm = falso();
  rev(arm, 'c1', 0, 'lembrei');
  rev(arm, 'c1', 1, 'dificil'); // não muda o estado
  const v = vigentes(lerEventos(arm));
  assert.deepEqual(diasDeEstudo(v), ['2026-10-10', '2026-10-11']);
  assert.equal(estadoDoConceito(v, 'mat/mmc'), 'praticado');
  rev(arm, 'c1', 2, 'lembrei');
  assert.equal(estadoDoConceito(vigentes(lerEventos(arm)), 'mat/mmc'), 'retido');
  rev(arm, 'c1', 3, 'nao_lembrei');
  assert.equal(estadoDoConceito(vigentes(lerEventos(arm)), 'mat/mmc'), 'precisa-revisar');
});

test('aula precisa revisar: erro recente num conceito dela ou cartão vencido', () => {
  const arm = falso();
  const v = () => vigentes(lerEventos(arm));
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/a', '2026-10-12'), false);
  responder(arm, 0, false);
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/a', '2026-10-12'), true);
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/b', '2026-10-12'), false);
  responder(arm, 1, true); // acerto depois do erro limpa
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/a', '2026-10-12'), false);
  rev(arm, 'enem/mat/a/c1', 2, 'lembrei'); // vence 15/10
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/a', '2026-10-14'), false);
  assert.equal(aulaPrecisaRevisar(v(), 'enem/mat/a', '2026-10-15'), true);
});

test('pré-requisito pendente só orienta', () => {
  assert.deepEqual(preRequisitosPendentes(['a', 'b'], new Set(['a'])), ['b']);
  assert.deepEqual(preRequisitosPendentes(undefined, new Set()), []);
});

const aula = (slug: string, materia = 'mat', p?: string[]): AulaDoPlano => ({
  id: `enem/${materia}/${slug}`, t: slug.toUpperCase(), href: `/enem/${materia}/${slug}/`, s: `enem/${materia}`, p,
});
const entrada = (extra: Partial<EntradaDoPlano> = {}): EntradaDoPlano => ({
  aulas: [aula('a'), aula('b'), aula('c')], concluidas: new Set(), prioridades: [], vencidos: 0, novos: 0,
  hrefRevisao: '/revisao/', aulasParaRever: [], ...extra,
});

test('hoje: usuário novo recebe a primeira aula da ordem, com motivo', () => {
  const acoes = planoDeHoje(entrada());
  assert.equal(acoes.length, 1);
  assert.equal(acoes[0].titulo, 'A');
  assert.match(acoes[0].motivo, /ordem de aprendizado/);
});

test('hoje: aula começada vem antes de aula nova; revisão vencida vem antes de tudo', () => {
  const comAula = planoDeHoje(entrada({ ultimaId: 'enem/mat/b' }));
  assert.equal(comAula[0].titulo, 'B');
  assert.equal(comAula[0].rotulo, 'Continuar aula');
  const comRevisao = planoDeHoje(entrada({ ultimaId: 'enem/mat/b', vencidos: 3, aulasParaRever: ['enem/mat/a'] }));
  assert.deepEqual(comRevisao.map((a) => a.tipo), ['revisao', 'rever-aula', 'aula']);
  assert.equal(comRevisao[0].titulo, 'Revisar 3 cartões');
});

test('hoje: no máximo três ações e uma só aula', () => {
  const acoes = planoDeHoje(entrada({ vencidos: 2, novos: 4, aulasParaRever: ['enem/mat/a'] }));
  assert.ok(acoes.length <= 3);
  assert.equal(acoes.filter((a) => a.longa).length, 1);
});

test('hoje: cartões novos só entram quando há espaço e nada vencido', () => {
  assert.deepEqual(planoDeHoje(entrada({ novos: 5 })).map((a) => a.tipo), ['aula', 'cartoes-novos']);
  assert.equal(planoDeHoje(entrada({ novos: 5, vencidos: 1 })).some((a) => a.tipo === 'cartoes-novos'), false);
});

test('hoje: prioridade declarada vence a ordem, e pré-requisito pendente não é sugerido primeiro', () => {
  const aulas = [aula('a', 'mat'), aula('x', 'fis', ['enem/fis/y']), aula('y', 'fis')];
  const acoes = planoDeHoje(entrada({ aulas, prioridades: ['fis'] }));
  assert.equal(acoes[0].titulo, 'Y'); // X pressupõe Y, que ainda não foi feita
  assert.match(acoes[0].motivo, /prioridade/);
  assert.deepEqual(acoes[0].alternativas?.map((a) => a.titulo), ['Y', 'X', 'A']);
});

test('hoje: aviso de pré-requisito aparece no motivo; aula indisponível nunca entra', () => {
  const aulas = [aula('x', 'mat', ['enem/mat/y']), aula('y', 'mat')];
  const so = planoDeHoje(entrada({ aulas: [aulas[0]] }));
  assert.equal(so.length, 1);
  const todas = planoDeHoje(entrada({ aulas }));
  assert.equal(todas[0].titulo, 'Y');
  const bloqueada = planoDeHoje(entrada({ aulas: [aula('x', 'mat', ['enem/mat/y']), aula('y', 'mat')], concluidas: new Set(['enem/mat/y']) }));
  assert.equal(bloqueada[0].titulo, 'X');
  assert.doesNotMatch(bloqueada[0].motivo, /pressupõe/);
});

test('hoje: tudo concluído não gera aula', () => {
  const acoes = planoDeHoje(entrada({ concluidas: new Set(['enem/mat/a', 'enem/mat/b', 'enem/mat/c']) }));
  assert.deepEqual(acoes, []);
});

test('perfil: valida o que vem do armazenamento e define o tamanho da fila', () => {
  assert.deepEqual(normalizarPerfil({ prioridades: ['a', 'a', 'B!', 'b', 'c', 'd'], ritmo: 99 }), { prioridades: ['a', 'b', 'c'], ritmo: 4 });
  assert.deepEqual(normalizarPerfil('lixo'), { prioridades: [], ritmo: 4 });
  assert.deepEqual([2, 4, 6].map((ritmo) => tamanhoDaFila({ prioridades: [], ritmo: ritmo as 2 | 4 | 6 })), [5, 10, 15]);
  const arm = falso();
  assert.equal(gravarPerfil({ prioridades: ['fisica'], ritmo: 6 }, arm), true);
  assert.deepEqual(lerPerfil(arm), { prioridades: ['fisica'], ritmo: 6 });
  assert.deepEqual(lerPerfil(falso()), { prioridades: [], ritmo: 4 });
});

test('hoje: aula em andamento que também precisa de revisão vira uma ação só', () => {
  const acoes = planoDeHoje(entrada({ ultimaId: 'enem/mat/b', aulasParaRever: ['enem/mat/b'] }));
  assert.equal(acoes.length, 1);
  assert.equal(acoes[0].tipo, 'aula');
  assert.match(acoes[0].motivo, /errou/);
});
