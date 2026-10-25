// Testes das regras de estudo. Rodam com `npm test` (executor nativo do Node, sem dependência).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INTERVALOS,
  INTERVALO_REVER_MS,
  META_DIAS_MAX,
  acoesPorDia,
  diaLocal,
  diasDaMateria,
  diasEntre,
  diasSemRegistro,
  historicoDaMeta,
  inicioDaSemana,
  materiaDaAula,
  normalizarMetas,
  progressoDaSemana,
  situacaoDaMeta,
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

/* ------------------------------------------------------- metas semanais */

const D = (d: number) => diaLocal(dia(d)); // "2026-10-<d>"; 12/10/2026 é segunda-feira

test('inicioDaSemana: a semana vai de segunda a domingo', () => {
  assert.equal(inicioDaSemana('2026-10-12'), '2026-10-12'); // segunda
  assert.equal(inicioDaSemana('2026-10-14'), '2026-10-12'); // quarta
  assert.equal(inicioDaSemana('2026-10-18'), '2026-10-12'); // domingo ainda é da semana que começou na segunda
  assert.equal(inicioDaSemana('2026-10-19'), '2026-10-19');
  assert.equal(inicioDaSemana('2026-11-01'), '2026-10-26'); // atravessa o mês
  assert.equal(inicioDaSemana('2027-01-01'), '2026-12-28'); // e o ano
});

test('diasEntre não é enganado por horário de verão', () => {
  assert.equal(diasEntre('2026-10-12', '2026-10-12'), 0);
  assert.equal(diasEntre('2026-10-12', '2026-10-18'), 6);
  assert.equal(diasEntre('2018-11-01', '2018-11-10'), 9); // virada do horário de verão no Brasil, em 2018
  assert.equal(diasEntre('2026-03-01', '2026-03-31'), 30);
});

test('normalizarMetas aceita só matéria válida e dias de 1 a 7', () => {
  const bruto = JSON.parse(
    '{"enem/fisica":3,"ds/banco-de-dados":7,"escolar/matematica":1,"enem/fisica/extra":2,"outra/coisa":2,' +
      '"enem/quimica":0,"enem/biologia":8,"enem/historia":2.5,"enem/geografia":"3","__proto__":4}',
  );
  assert.deepEqual(normalizarMetas(bruto), { 'enem/fisica': 3, 'ds/banco-de-dados': 7, 'escolar/matematica': 1 });
  assert.equal(META_DIAS_MAX, 7);
  for (const lixo of [null, undefined, 5, 'x', [], [1, 2]]) assert.deepEqual(normalizarMetas(lixo), {});
});

test('normalizarMetas guarda no máximo 12 metas', () => {
  const muitas = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`enem/m${i}`, 2]));
  assert.equal(Object.keys(normalizarMetas(muitas)).length, 12);
});

test('materiaDaAula pega a frente e a matéria do id', () => {
  assert.equal(materiaDaAula('enem/matematica-basica/fracoes'), 'enem/matematica-basica');
  assert.equal(materiaDaAula('ds/banco-de-dados/bim1/semana-3'), 'ds/banco-de-dados');
  assert.equal(materiaDaAula('escolar/ciencias/b1/s2'), 'escolar/ciencias');
  assert.equal(materiaDaAula('livro'), null);
  assert.equal(materiaDaAula('xyz/fisica/a'), null);
});

test('diasDaMateria conta questão, cartão e aula concluída, e só da matéria pedida', () => {
  const eventos: Evento[] = [
    q(A, 0, true, 12),
    c(`${A}#0`, 2, 13),
    q('enem/fisica/cinematica', 0, false, 14),
    { id: 'x1', t: dia(15), k: 'x', m: 'Livro de matemática' }, // fora do site: não tem matéria do caderno
  ];
  const vistas = { 'enem/matematica-basica/porcentagem': dia(16), 'enem/fisica/leis-de-newton': dia(17) };
  assert.deepEqual([...diasDaMateria(eventos, vistas, 'enem/matematica-basica')].sort(), [D(12), D(13), D(16)]);
  assert.deepEqual([...diasDaMateria(eventos, vistas, 'enem/fisica')].sort(), [D(14), D(17)]);
  assert.equal(diasDaMateria(eventos, vistas, 'enem/quimica').size, 0);
});

test('dois eventos no mesmo dia contam um dia só', () => {
  const eventos = [q(A, 0, true, 12, undefined, 8), q(A, 1, false, 12, undefined, 20), c(`${A}#0`, 1, 12)];
  assert.equal(diasDaMateria(eventos, {}, 'enem/matematica-basica').size, 1);
});

test('situacaoDaMeta: cumprida, no caminho, apertada e fora de alcance', () => {
  assert.equal(situacaoDaMeta(3, 3, 2), 'cumprida');
  assert.equal(situacaoDaMeta(3, 5, 1), 'cumprida'); // passou da meta: segue cumprida
  assert.equal(situacaoDaMeta(3, 0, 5), 'no-caminho');
  assert.equal(situacaoDaMeta(3, 1, 2), 'apertada'); // faltam 2 e restam 2
  assert.equal(situacaoDaMeta(3, 0, 2), 'fora-de-alcance'); // faltam 3 e restam 2
  assert.equal(situacaoDaMeta(3, 0, 3), 'apertada');
});

test('progressoDaSemana: só a semana de hoje conta e os dias restantes incluem hoje', () => {
  const eventos = [
    q(A, 0, true, 11), // domingo da semana anterior: não conta
    q(A, 0, true, 12), // segunda
    c(`${A}#1`, 2, 14), // quarta
    q('enem/fisica/cinematica', 0, true, 13),
  ];
  const metas = { 'enem/matematica-basica': 3, 'enem/fisica': 2 };
  const quarta = progressoDaSemana({ eventos, vistas: {}, metas, hoje: D(14) });
  const mat = quarta.find((m) => m.materia === 'enem/matematica-basica')!;
  assert.deepEqual([mat.feito, mat.faltam, mat.restantes, mat.situacao], [2, 1, 5, 'no-caminho']);
  assert.deepEqual(mat.dias, [D(12), D(14)]);
  const fis = quarta.find((m) => m.materia === 'enem/fisica')!;
  assert.deepEqual([fis.feito, fis.faltam, fis.situacao], [1, 1, 'no-caminho']);
  // No domingo resta só 1 dia (hoje): a de matemática (2 de 3) e a de física (1 de 2) ficam apertadas.
  const domingo = progressoDaSemana({ eventos, vistas: {}, metas, hoje: D(18) });
  assert.equal(domingo[0].restantes, 1);
  assert.deepEqual(domingo.map((m) => m.situacao), ['apertada', 'apertada']);
  // Na segunda seguinte tudo recomeça, sem dívida da semana passada.
  const proxima = progressoDaSemana({ eventos, vistas: {}, metas, hoje: D(19) });
  assert.deepEqual(proxima.map((m) => [m.feito, m.restantes]), [[0, 7], [0, 7]]);
});

test('progressoDaSemana sem metas devolve lista vazia, e a ordem é pela matéria', () => {
  assert.deepEqual(progressoDaSemana({ eventos: [], vistas: {}, metas: {}, hoje: D(14) }), []);
  const r = progressoDaSemana({ eventos: [], vistas: {}, metas: { 'ds/z': 1, 'enem/a': 1, 'ds/a': 1 }, hoje: D(14) });
  assert.deepEqual(r.map((m) => m.materia), ['ds/a', 'ds/z', 'enem/a']);
});

test('apagar um evento recalcula a meta (nada é guardado como total)', () => {
  const eventos = [q(A, 0, true, 12), q(A, 1, true, 13)];
  const metas = { 'enem/matematica-basica': 2 };
  assert.equal(progressoDaSemana({ eventos, vistas: {}, metas, hoje: D(14) })[0].situacao, 'cumprida');
  const sem = semEvento({ v: 1, eventos }, eventos[1].id).eventos;
  const depois = progressoDaSemana({ eventos: sem, vistas: {}, metas, hoje: D(14) })[0];
  assert.deepEqual([depois.feito, depois.situacao], [1, 'no-caminho']);
});

test('historicoDaMeta: semanas passadas, a atual em andamento', () => {
  // Semana de 5/10: 3 dias; semana de 12/10: 1 dia.
  const eventos = [q(A, 0, true, 5), q(A, 0, true, 6), q(A, 0, true, 7), q(A, 0, true, 14)];
  const h = historicoDaMeta({ eventos, vistas: {}, materia: 'enem/matematica-basica', meta: 3, hoje: D(14), semanas: 4 });
  assert.deepEqual(h.map((s) => s.inicio), ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(h.map((s) => s.feito), [0, 0, 3, 1]);
  assert.deepEqual(h.map((s) => s.cumpriu), [false, false, true, false]);
  assert.deepEqual(h.map((s) => s.emAndamento), [false, false, false, true]);
});

test('historicoDaMeta limita o número de semanas', () => {
  const n = (semanas?: number) =>
    historicoDaMeta({ eventos: [], vistas: {}, materia: 'enem/fisica', meta: 1, hoje: D(14), semanas }).length;
  assert.equal(n(), 8);
  assert.equal(n(0), 1);
  assert.equal(n(500), 26);
});

test('diasSemRegistro lista os dias sem nenhuma ação, contando hoje', () => {
  const eventos = [q(A, 0, true, 12), c(`${A}#0`, 1, 14)];
  const vistas = { 'enem/fisica/cinematica': dia(16) };
  assert.deepEqual(diasSemRegistro({ eventos, vistas, hoje: D(18), n: 7 }), [D(13), D(15), D(17), D(18)]);
  assert.deepEqual(diasSemRegistro({ eventos: [], vistas: {}, hoje: D(18), n: 3 }), [D(16), D(17), D(18)]);
  assert.equal(diasSemRegistro({ eventos: [], vistas: {}, hoje: D(18) }).length, 7);
});

test('estudo fora do site conta como dia de estudo, mas não como dia de uma matéria do caderno', () => {
  const fora: Evento = { id: 'x2', t: dia(13), k: 'x', m: 'enem/fisica' }; // texto livre igual à chave: continua sem matéria
  assert.equal(diasDaMateria([fora], {}, 'enem/fisica').size, 0);
  assert.equal(diasSemRegistro({ eventos: [fora], vistas: {}, hoje: D(13), n: 1 }).length, 0);
});
