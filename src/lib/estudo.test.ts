// Testes das regras de estudo. Rodam com `npm test` (executor nativo do Node, sem dependência).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INTERVALOS,
  INTERVALO_REVER_MS,
  acoesPorDia,
  diaLocal,
  estadoDaAula,
  estadoDoCartao,
  mesclarRegistros,
  montarFila,
  nivelDoDia,
  normalizarRegistro,
  parseRevisar,
  proximaCaixa,
  secoesDaAula,
  semEvento,
  somarDias,
  sugestoesDeHoje,
} from './estudo.ts';
import type { AulaIdx, Evento } from './estudo.ts';
import { contarCartoes } from './cartoes.ts';
import { DISPENSA_MS, dispensasAtivas, limparFoco, proximoRetorno } from './estudo.ts';
import { corrigirPorSentido, corrigirPorTermos, cosseno, quebrarEmPontos, quebrarResposta } from './correcao.ts';

/** Meio-dia do dia indicado (outubro de 2026), no fuso desta máquina. */
const dia = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
let seq = 0;
const q = (aula: string, n: number, ok: boolean, d: number, s?: string, h = 12): Evento => ({
  id: `q${seq++}`, t: dia(d, h), k: 'q', a: aula, n, ok, ...(s ? { s } : {}),
});
const c = (cartao: string, r: 0 | 1 | 2, d: number): Evento => ({ id: `c${seq++}`, t: dia(d), k: 'c', c: cartao, r });

const A = 'enem/matematica-basica/fracoes';

test('parseRevisar separa o texto da seção a rever', () => {
  const r = parseRevisar('Em decimal, 3/5 = 0,6. Revisar: Aula Teórica › 3. Comparando e ordenando frações\n');
  assert.equal(r.secao, '3. Comparando e ordenando frações');
  assert.equal(r.texto, 'Em decimal, 3/5 = 0,6.');
  assert.deepEqual(parseRevisar('Sem indicação.'), { texto: 'Sem indicação.', secao: null });
});

test('questão errada deixa a seção em rever; acertar em outro dia tira', () => {
  const sec = '2. Frações equivalentes';
  let ev = [q(A, 1, false, 5, sec)];
  assert.equal(secoesDaAula(ev, A)[0].estado, 'rever');
  assert.equal(estadoDaAula({ eventos: ev, aula: A, vista: true }).estado, 'rever');
  ev = [...ev, q(A, 1, true, 6, sec)];
  assert.equal(secoesDaAula(ev, A)[0].estado, 'acertou');
  assert.equal(estadoDaAula({ eventos: ev, aula: A, vista: true }).estado, 'concluida');
});

test('acertar logo depois do erro (menos de 30 min) mantém a seção em rever, com o motivo', () => {
  const ev = [q(A, 0, false, 5, 'X', 10), { ...q(A, 0, true, 5, 'X', 10), t: dia(5, 10) + 10 * 60 * 1000 }];
  const [s] = secoesDaAula(ev, A);
  assert.equal(s.estado, 'rever');
  assert.equal(s.motivo, 'cedo');
  assert.equal(s.desde, dia(5, 10) + INTERVALO_REVER_MS);
});

test('acertar 30 minutos ou mais depois do erro tira a seção de rever', () => {
  const ev = [q(A, 0, false, 5, 'X', 10), { ...q(A, 0, true, 5, 'X', 10), t: dia(5, 10) + INTERVALO_REVER_MS }];
  const [s] = secoesDaAula(ev, A);
  assert.equal(s.estado, 'acertou');
  assert.equal(s.motivo, null);
  assert.equal(estadoDaAula({ eventos: ev, aula: A, vista: true }).estado, 'concluida');
});

test('errar de novo reinicia a contagem', () => {
  const ev = [q(A, 0, false, 5, 'X', 9), q(A, 0, true, 5, 'X', 12), q(A, 0, false, 5, 'X', 14)];
  const [s] = secoesDaAula(ev, A);
  assert.equal(s.estado, 'rever');
  assert.equal(s.motivo, 'errou');
  assert.equal(s.desde, dia(5, 14) + INTERVALO_REVER_MS);
});

test('firme exige dois dias certos depois do último erro', () => {
  const um = [q(A, 0, false, 1, 'X'), q(A, 0, true, 2, 'X')];
  assert.equal(secoesDaAula(um, A)[0].estado, 'acertou');
  const dois = [...um, q(A, 0, true, 3, 'X')];
  assert.equal(secoesDaAula(dois, A)[0].estado, 'firme');
  const erroDepois = [...dois, q(A, 0, false, 4, 'X')];
  assert.equal(secoesDaAula(erroDepois, A)[0].estado, 'rever');
});

test('seção com várias questões: uma errada basta para rever', () => {
  const ev = [q(A, 0, true, 1, 'X'), q(A, 0, true, 2, 'X'), q(A, 3, false, 2, 'X')];
  const [s] = secoesDaAula(ev, A);
  assert.equal(s.estado, 'rever');
  assert.deepEqual(s.questoes.sort(), [0, 3]);
});

test('questão sem seção vira "Questão N"', () => {
  const [s] = secoesDaAula([q(A, 2, false, 1)], A);
  assert.equal(s.rotulo, 'Questão 3');
});

test('estado da aula sem erros segue o progresso', () => {
  assert.equal(estadoDaAula({ eventos: [], aula: A, vista: false }).estado, 'nao-iniciada');
  assert.equal(estadoDaAula({ eventos: [], aula: A, vista: false, andamento: { l: 30, q: 0, z: 1 } }).estado, 'andamento');
  assert.equal(estadoDaAula({ eventos: [], aula: A, vista: true }).estado, 'concluida');
});

test('caixas: tabela de respostas', () => {
  assert.equal(proximaCaixa(0, 2), 2);
  assert.equal(proximaCaixa(0, 1), 1);
  assert.equal(proximaCaixa(4, 0), 1);
  assert.equal(proximaCaixa(4, 1), 4);
  assert.equal(proximaCaixa(4, 2), 5);
  assert.equal(proximaCaixa(6, 2), 6);
  assert.deepEqual(INTERVALOS, [0, 1, 3, 7, 14, 30, 60]);
});

test('duas revisões do mesmo cartão no mesmo dia valem uma só', () => {
  const e = estadoDoCartao([
    { t: dia(1, 9), r: 2 },
    { t: dia(1, 18), r: 2 },
  ]);
  assert.equal(e.caixa, 2);
});

const fila = (eventos: Evento[], hoje: number, extra: Partial<Parameters<typeof montarFila>[0]> = {}) =>
  montarFila({ eventos, conclusoes: { [A]: dia(1) }, cartoes: { [A]: 3 }, hoje: diaLocal(dia(hoje)), limite: 20, ...extra });

test('cartões entram na fila no dia seguinte à conclusão', () => {
  assert.equal(fila([], 1).vencidos.length, 0);
  assert.equal(fila([], 1).proxima, diaLocal(dia(2)));
  assert.equal(fila([], 2).vencidos.length, 3);
  assert.equal(fila([], 2).vencidos[0].id, `${A}#1`);
});

test('lembrei empurra o cartão para 3 dias; não lembrei traz de volta em 1', () => {
  const lembrei = fila([c(`${A}#1`, 2, 2)], 4).vencidos.map((x) => x.id);
  assert.ok(!lembrei.includes(`${A}#1`));
  assert.ok(fila([c(`${A}#1`, 2, 2)], 5).vencidos.map((x) => x.id).includes(`${A}#1`));
  assert.ok(fila([c(`${A}#1`, 0, 2)], 3).vencidos.map((x) => x.id).includes(`${A}#1`));
});

test('com dificuldade mantém a caixa', () => {
  const ev = [c(`${A}#1`, 2, 2), c(`${A}#1`, 2, 5), c(`${A}#1`, 1, 12)];
  // caixas: 2 (3 dias) -> 3 (7 dias) -> dificuldade fica em 3 (7 dias): vence no dia 19
  assert.ok(!fila(ev, 18).vencidos.some((x) => x.id === `${A}#1`));
  assert.ok(fila(ev, 19).vencidos.some((x) => x.id === `${A}#1`));
});

test('errar uma questão antecipa os cartões já revisados', () => {
  const ev = [c(`${A}#1`, 2, 2), c(`${A}#1`, 2, 5), q(A, 0, false, 6, 'X')];
  assert.ok(fila(ev, 6).vencidos.every((x) => x.id !== `${A}#1`));
  assert.ok(fila(ev, 7).vencidos.some((x) => x.id === `${A}#1`));
});

test('a fila diária é limitada e o excesso espera', () => {
  const f = fila([], 2, { limite: 2 });
  assert.equal(f.hoje.length, 2);
  assert.equal(f.vencidos.length, 3);
});

test('aula não concluída não gera cartão', () => {
  assert.equal(fila([], 9, { conclusoes: {} }).vencidos.length, 0);
});

const aulas: AulaIdx[] = [
  { id: 'enem/mat/a', t: 'Frações', m: 'Matemática Básica', s: 'enem/mat', h: '/a' },
  { id: 'enem/mat/b', t: 'Potências', m: 'Matemática Básica', s: 'enem/mat', h: '/b' },
  { id: 'enem/fis/c', t: 'Óptica', m: 'Física', s: 'enem/fis', h: '/c' },
];
const base = {
  eventos: [] as Evento[], aulas, vistas: {}, andamentos: {}, dispensados: [] as string[], foco: [] as string[],
  agora: dia(10), hrefRevisao: '/revisao', fila: { vencidos: [], hoje: [], proxima: null },
};

test('Hoje: estudante novo recebe uma aula para começar', () => {
  const s = sugestoesDeHoje(base);
  assert.equal(s.length, 1);
  assert.equal(s[0].tipo, 'comecar');
  assert.equal(s[0].id, 'aula:enem/mat/a');
});

test('Hoje: próxima da trilha da matéria mais usada, com motivo', () => {
  const s = sugestoesDeHoje({ ...base, vistas: { 'enem/mat/a': dia(9) } });
  assert.equal(s[0].id, 'aula:enem/mat/b');
  assert.match(s[0].motivo, /depois de “Frações”/);
});

test('Hoje: ordem revisão, rever, uma ação longa; no máximo três', () => {
  const cart = { id: 'enem/mat/a#1', aula: 'enem/mat/a', n: 1, vence: '2026-10-09', caixa: 0 };
  const s = sugestoesDeHoje({
    ...base,
    eventos: [q('enem/mat/a', 0, false, 9, '1. Frações')],
    vistas: { 'enem/mat/a': dia(8) },
    andamentos: { 'enem/mat/b': { l: 40, q: 0, z: 1, t: dia(9) } },
    fila: { vencidos: [cart], hoje: [cart], proxima: null },
  });
  assert.deepEqual(s.map((x) => x.tipo), ['revisao', 'rever', 'continuar']);
});

test('Hoje: dispensado some e o foco manda na matéria', () => {
  const s = sugestoesDeHoje({ ...base, dispensados: ['aula:enem/fis/c'], foco: ['enem/fis'] });
  assert.equal(s.length, 0);
  const t = sugestoesDeHoje({ ...base, foco: ['enem/fis'] });
  assert.equal(t[0].id, 'aula:enem/fis/c');
});

test('Hoje: não repete aula já vista', () => {
  const s = sugestoesDeHoje({ ...base, vistas: { 'enem/mat/a': dia(9), 'enem/mat/b': dia(9) } });
  assert.ok(s.every((x) => x.id !== 'aula:enem/mat/b'));
});

test('dias de estudo contam ações e usam degraus fixos', () => {
  const m = acoesPorDia([q(A, 0, true, 3), q(A, 1, true, 3), c('x#1', 2, 4)], { [A]: dia(3) });
  assert.equal(m.get(diaLocal(dia(3))), 3);
  assert.equal(m.get(diaLocal(dia(4))), 1);
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10].map(nivelDoDia), [0, 1, 2, 2, 3, 3, 4]);
});

test('registro: descarta lixo, mescla sem duplicar e apaga por id', () => {
  const bruto = {
    eventos: [
      { id: 'a', t: 1, k: 'q', a: 'x', n: 0, ok: true },
      { id: 'b', t: 2, k: 'c', c: 'x#1', r: 7 },
      { id: 'c', t: 3, k: 'x', m: 'Física', min: 99999 },
      { t: 4, k: 'q' },
      null,
    ],
  };
  const reg = normalizarRegistro(bruto);
  assert.deepEqual(reg.eventos.map((e) => e.id), ['a', 'c']);
  assert.equal((reg.eventos[1] as { min?: number }).min, undefined);
  assert.equal(normalizarRegistro('texto').eventos.length, 0);
  const junto = mesclarRegistros(reg, normalizarRegistro({ eventos: [bruto.eventos[0], { id: 'z', t: 0, k: 'q', a: 'y', n: 1, ok: false }] }));
  assert.deepEqual(junto.eventos.map((e) => e.id), ['z', 'a', 'c']);
  assert.deepEqual(semEvento(junto, 'a').eventos.map((e) => e.id), ['z', 'c']);
});

test('contarCartoes conta os #### do bloco de tópicos e respeita a exclusão', () => {
  const mdx = [
    '## Aula Teórica', '', '#### não é tópico', '',
    '## Tópicos-Chave', '', '<div className="topico">', '', '#### 1. A', '', 'texto', '', '#### 2. B', '', '</div>', '',
    '## Questões', '', '#### 3. fora', '',
  ].join('\n');
  assert.equal(contarCartoes(mdx), 2);
  assert.equal(contarCartoes(mdx.replace('className="topico"', 'className="topico" data-cartoes="nao"')), 0);
  assert.equal(contarCartoes('## sem tópicos'), 0);
  assert.equal(contarCartoes(undefined), 0);
});

test('"Agora não" volta depois de uma hora e ignora lixo do armazenamento', () => {
  const agora = dia(10, 15);
  const d = dispensasAtivas({ revisao: agora + DISPENSA_MS, velha: agora - 1, ruim: 'x', nula: null }, agora);
  assert.deepEqual(Object.keys(d), ['revisao']);
  assert.equal(proximoRetorno(d), agora + DISPENSA_MS);
  assert.equal(proximoRetorno({}), null);
  assert.deepEqual(dispensasAtivas([1, 2], agora), {});
  assert.deepEqual(dispensasAtivas('texto', agora), {});
});

test('cartão marcado para rever entra em "Rever" e sai quando lembrar depois do intervalo', () => {
  const marcado: Evento = { id: 'm1', t: dia(5, 10), k: 'c', c: A + '#3', r: 0, rv: true, s: '3. Comparando', v: 'errado' };
  assert.equal(secoesDaAula([marcado], A)[0].estado, 'rever');
  assert.equal(estadoDaAula({ eventos: [marcado], aula: A, vista: true }).rever[0].rotulo, '3. Comparando');
  const logo: Evento = { id: 'm2', t: dia(5, 10) + 5 * 60 * 1000, k: 'c', c: A + '#3', r: 2 };
  assert.equal(secoesDaAula([marcado, logo], A)[0].estado, 'rever');
  const depois: Evento = { id: 'm3', t: dia(6, 10), k: 'c', c: A + '#3', r: 2 };
  assert.equal(secoesDaAula([marcado, depois], A)[0].estado, 'acertou');
  // cartão sem marca nunca vira "Rever", mesmo com "não lembrei"
  const semMarca: Evento = { id: 'm4', t: dia(5, 10), k: 'c', c: A + '#2', r: 0 };
  assert.equal(secoesDaAula([semMarca], A).length, 0);
});

test('correção por termos: certo, parcial e errado', () => {
  const termos = ['fração', 'numerador', 'denominador', 'a/b = a ÷ b'];
  const certo = corrigirPorTermos('Uma fração tem numerador e denominador; é uma divisão.', termos);
  assert.equal(certo.veredito, 'certo');
  assert.equal(certo.revisarAula, false);
  const parcial = corrigirPorTermos('É uma fração, parte de um todo dividido.', termos);
  assert.equal(parcial.veredito, 'parcial');
  assert.deepEqual(parcial.faltaram, ['numerador', 'denominador']);
  const errado = corrigirPorTermos('Não lembro muito bem desse assunto de matemática.', termos);
  assert.equal(errado.veredito, 'errado');
  assert.equal(errado.revisarAula, true);
  assert.equal(corrigirPorTermos('sei', termos).veredito, 'errado');
});

test('correção por termos aceita plural, acento e feminino', () => {
  const r = corrigirPorTermos('As FRAÇÕES equivalentes simplificam dividindo por um divisor comum', ['fração', 'equivalentes', 'simplificar']);
  assert.equal(r.veredito, 'certo');
});

test('correção por sentido: pontos cobertos, faltantes e vereditos', () => {
  const pontos = [
    { texto: 'A regra de três acha o valor que falta numa proporção.', termos: ['regra de três', 'proporção'] },
    { texto: 'Numa relação inversa, uma das razões vira de cabeça para baixo.', termos: ['inversa'] },
    { texto: 'Multiplique em cruz e divida pelo número que sobrou.', termos: ['cruz'] },
  ];
  // um trecho só (0.8 com o ponto 1, 0.56 com o 2, 0.7 com o 3): cobre o 1 e, por ser forte, o 3; o 2 não
  const parcial = corrigirPorSentido('a regra de três serve para achar um valor numa proporção, multiplicando em cruz e dividindo', pontos, [[0.8], [0.56], [0.7]]);
  assert.equal(parcial.veredito, 'parcial');
  assert.equal(parcial.pontosFaltantes.length, 1);
  assert.match(parcial.pontosFaltantes[0], /inversa/);
  // três trechos, cada um fala de um ponto
  const certo = corrigirPorSentido('texto longo o bastante para valer como resposta', pontos, [[0.9, 0.1, 0.2], [0.1, 0.6, 0.1], [0.2, 0.1, 0.55]]);
  assert.equal(certo.veredito, 'certo');
  assert.equal(certo.pontosFaltantes.length, 0);
  const errado = corrigirPorSentido('não sei nada sobre isso aqui', pontos, [[0.1], [0.05], [0.2]]);
  assert.equal(errado.veredito, 'errado');
  assert.equal(errado.revisarAula, true);
  assert.equal(errado.pontosFaltantes.length, 3);
  // os termos em negrito de um ponto, todos presentes, cobrem o ponto mesmo com semelhança baixa
  const termos = corrigirPorSentido('uma regra de três usa proporção e relação inversa de cruz', pontos, [[0.1], [0.1], [0.1]]);
  assert.ok(termos.cobertos.length >= 1);
});

test('cosseno e quebra de texto em pontos', () => {
  assert.equal(Math.round(cosseno([1, 0], [1, 0]) * 100), 100);
  assert.equal(cosseno([1, 0], [0, 1]), 0);
  assert.equal(cosseno([0, 0], [1, 1]), 0);
  const pontos = quebrarEmPontos('Uma fração representa uma parte de um todo. a/b = a ÷ b. Os denominadores precisam ser iguais; senão, ache o MMC.');
  assert.equal(pontos.length, 2);
  assert.deepEqual(quebrarResposta('Uma frase só aqui.'), ['Uma frase só aqui.']);
  assert.equal(quebrarResposta('Primeira ideia aqui. Segunda ideia aqui.').length, 3);
});

test('somarDias atravessa o fim do mês', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
});

test('foco: cada categoria tem o seu limite e uma não interfere na outra', () => {
  const foco = limparFoco(['enem/fisica', 'enem/biologia', 'enem/historia', 'enem/artes', 'escolar/matematica', 'escolar/lingua-portuguesa', 'ds/back-end', 'ds/front-end', 'ds/banco-de-dados']);
  assert.deepEqual(foco, ['enem/fisica', 'enem/biologia', 'enem/historia', 'escolar/matematica', 'ds/back-end', 'ds/front-end']);
  assert.deepEqual(limparFoco(['enem/fisica', 'enem/fisica', 'outra/coisa']), ['enem/fisica']);
});
