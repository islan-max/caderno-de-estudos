// Testes do recomendador de aulas. Rodam com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avaliarRecomendador, sorteador } from './recomendacao-avaliacao.ts';
import {
  INTERESSES_MAX,
  comFeedback,
  comInteresse,
  mesclarPreferencias,
  normalizarPreferencias,
  recomendar,
  termosDoTitulo,
} from './recomendacao.ts';
import type { ItemRec, Preferencias } from './recomendacao.ts';

const MATERIAS: Record<string, { nome: string; grupo: string; aulas: string[] }> = {
  'enem/fisica': { nome: 'Física', grupo: 'Ciências da Natureza', aulas: ['Leis de Newton', 'Cinemática: movimento uniforme', 'Óptica geométrica', 'Termologia e calor'] },
  'enem/quimica': { nome: 'Química', grupo: 'Ciências da Natureza', aulas: ['Tabela periódica', 'Ligações químicas', 'Termoquímica e calor', 'Soluções e concentração'] },
  'enem/biologia': { nome: 'Biologia', grupo: 'Ciências da Natureza', aulas: ['Citologia', 'Genética mendeliana', 'Ecologia e cadeias alimentares', 'Evolução'] },
  'enem/historia': { nome: 'História', grupo: 'Ciências Humanas', aulas: ['Brasil Colônia', 'Revolução Francesa', 'Era Vargas', 'Guerra Fria'] },
  'enem/geografia': { nome: 'Geografia', grupo: 'Ciências Humanas', aulas: ['Clima e vegetação', 'Urbanização brasileira', 'Globalização', 'Cartografia'] },
  'ds/banco-de-dados': { nome: 'Banco de Dados', grupo: 'Desenvolvimento de Sistemas', aulas: ['Modelagem relacional', 'Consultas SQL', 'Índices e desempenho', 'Transações'] },
};

const CATALOGO: ItemRec[] = Object.entries(MATERIAS).flatMap(([materia, m]) =>
  m.aulas.map((titulo, i) => ({
    id: `${materia}/aula-${i + 1}`,
    titulo,
    materia,
    materiaNome: m.nome,
    grupo: m.grupo,
    cartoes: (i * 7 + materia.length) % 5,
  })),
);
const id = (materia: string, n: number) => `${materia}/aula-${n}`;
const vazio: Preferencias = { interesses: [], feedback: {} };

test('sem interesse nem feedback não há o que recomendar', () => {
  const r = recomendar({ catalogo: CATALOGO, prefs: vazio });
  assert.deepEqual([r.semPerfil, r.itens.length], [true, 0]);
});

test('um interesse leva as aulas da matéria, com o motivo', () => {
  const r = recomendar({ catalogo: CATALOGO, prefs: { interesses: ['enem/historia'], feedback: {} }, n: 4 });
  assert.equal(r.semPerfil, false);
  assert.deepEqual(r.itens.map((x) => x.item.materia), Array(4).fill('enem/historia'));
  assert.deepEqual(r.itens[0].porque, ['Você escolheu História']);
});

test('aula concluída e aula já avaliada (👍 ou 👎) não voltam', () => {
  const prefs = { interesses: ['enem/historia'], feedback: { [id('enem/historia', 1)]: -1 as const } };
  const r = recomendar({ catalogo: CATALOGO, prefs, concluidas: [id('enem/historia', 2)], n: 10 });
  const ids = r.itens.map((x) => x.item.id);
  assert.ok(!ids.includes(id('enem/historia', 1)));
  assert.ok(!ids.includes(id('enem/historia', 2)));
  assert.ok(ids.includes(id('enem/historia', 3)));
});

test('o 👍 traz aulas parecidas e diz de qual aula vem a semelhança', () => {
  const curtida = id('enem/fisica', 4); // "Termologia e calor"
  const r = recomendar({ catalogo: CATALOGO, prefs: { interesses: [], feedback: { [curtida]: 1 } }, n: 5 });
  assert.equal(r.itens[0].item.materia, 'enem/fisica');
  assert.ok(r.itens[0].porque[0].includes('Termologia e calor'));
  // "Termoquímica e calor" divide o termo "calor" e o grupo: aparece, mas depois das aulas da mesma matéria.
  const posQuimica = r.itens.findIndex((x) => x.item.id === id('enem/quimica', 3));
  assert.ok(posQuimica > 2 || posQuimica === -1);
});

test('o 👍 numa matéria diferente do interesse muda a lista', () => {
  const so = recomendar({ catalogo: CATALOGO, prefs: { interesses: ['enem/fisica'], feedback: {} }, n: 6 });
  const com = recomendar({
    catalogo: CATALOGO,
    prefs: { interesses: ['enem/fisica'], feedback: { [id('enem/quimica', 1)]: 1, [id('enem/quimica', 2)]: 1 } },
    n: 6,
  });
  assert.ok(!so.itens.some((x) => x.item.materia === 'enem/quimica'));
  assert.ok(com.itens.some((x) => x.item.materia === 'enem/quimica'));
});

test('o 👎 empurra para baixo as aulas parecidas', () => {
  const base = { interesses: ['enem/fisica'], feedback: {} };
  const antes = recomendar({ catalogo: CATALOGO, prefs: base, n: 20 }).itens.map((x) => x.item.id);
  const depois = recomendar({
    catalogo: CATALOGO,
    prefs: { ...base, feedback: { [id('enem/fisica', 1)]: -1 as const } },
    n: 20,
  }).itens.map((x) => x.item.id);
  assert.ok(antes.includes(id('enem/fisica', 2)) && depois.includes(id('enem/fisica', 2)));
  assert.ok(depois.indexOf(id('enem/fisica', 2)) >= antes.indexOf(id('enem/fisica', 2)) - 1);
  assert.ok(!depois.includes(id('enem/fisica', 1)));
});

test('a mesma entrada dá sempre a mesma lista (desempate por id)', () => {
  const prefs = { interesses: ['enem/biologia', 'enem/historia'], feedback: { [id('enem/geografia', 2)]: 1 as const } };
  const a = recomendar({ catalogo: CATALOGO, prefs, n: 12 }).itens.map((x) => x.item.id);
  const b = recomendar({ catalogo: [...CATALOGO].reverse(), prefs, n: 12 }).itens.map((x) => x.item.id);
  assert.deepEqual(a, b);
});

test('n é limitado e feedback de aula que não existe mais é ignorado', () => {
  const prefs = { interesses: ['enem/fisica'], feedback: { 'enem/fisica/apagada': 1 as const } };
  assert.equal(recomendar({ catalogo: CATALOGO, prefs, n: 2 }).itens.length, 2);
  assert.ok(recomendar({ catalogo: CATALOGO, prefs, n: 9999 }).itens.length <= 50);
});

test('termosDoTitulo tira acento, palavra comum, número e repetição', () => {
  assert.deepEqual(termosDoTitulo('Óptica geométrica: a luz e as lentes 2'), ['optica', 'geometrica', 'luz', 'lentes']);
  assert.deepEqual(termosDoTitulo('Leis de Newton, leis!'), ['leis', 'newton']);
});

test('normalizarPreferencias aceita só ids válidos, 1 ou -1, sem repetir e com limite', () => {
  const bruto = JSON.parse(
    '{"interesses":["enem/fisica","enem/fisica","outra/coisa","enem/fisica/extra",5],' +
      '"feedback":{"enem/fisica/optica":1,"ds/back-end/x":-1,"enem/fisica/a":2,"enem/fisica/b":"1","lixo":1,"__proto__":1}}',
  );
  assert.deepEqual(normalizarPreferencias(bruto), {
    interesses: ['enem/fisica'],
    feedback: { 'enem/fisica/optica': 1, 'ds/back-end/x': -1 },
  });
  for (const lixo of [null, undefined, 5, 'x', [], [1]]) assert.deepEqual(normalizarPreferencias(lixo), vazio);
  const muitas = { interesses: Array.from({ length: 30 }, (_, i) => `enem/m${i}`) };
  assert.equal(normalizarPreferencias(muitas).interesses.length, INTERESSES_MAX);
});

test('comFeedback alterna: o mesmo botão duas vezes tira a marca; o outro troca', () => {
  let p = comFeedback(vazio, 'enem/fisica/optica', 1);
  assert.equal(p.feedback['enem/fisica/optica'], 1);
  p = comFeedback(p, 'enem/fisica/optica', -1);
  assert.equal(p.feedback['enem/fisica/optica'], -1);
  p = comFeedback(p, 'enem/fisica/optica', -1);
  assert.deepEqual(p.feedback, {});
});

test('comInteresse liga e desliga sem repetir', () => {
  let p = comInteresse(vazio, 'enem/fisica', true);
  p = comInteresse(p, 'enem/fisica', true);
  assert.deepEqual(p.interesses, ['enem/fisica']);
  assert.deepEqual(comInteresse(p, 'enem/fisica', false).interesses, []);
});

test('mesclarPreferencias soma e, no conflito, vale o que já existe aqui', () => {
  const aqui: Preferencias = { interesses: ['enem/fisica'], feedback: { 'enem/fisica/a': 1 } };
  const fora: Preferencias = { interesses: ['enem/quimica'], feedback: { 'enem/fisica/a': -1, 'enem/fisica/b': 1 } };
  assert.deepEqual(mesclarPreferencias(aqui, fora), {
    interesses: ['enem/fisica', 'enem/quimica'],
    feedback: { 'enem/fisica/a': 1, 'enem/fisica/b': 1 },
  });
});

test('a avaliação offline se repete com a mesma semente e o feedback melhora o resultado', () => {
  const a = avaliarRecomendador(CATALOGO, { pessoas: 100, semente: 7 });
  assert.deepEqual(a, avaliarRecomendador(CATALOGO, { pessoas: 100, semente: 7 }));
  assert.ok(a.recomendador.achouAOutraMateria > a.soInteresses.achouAOutraMateria);
  assert.ok(a.recomendador.precisao > a.sorteio.precisao);
  assert.ok(a.recomendador.precisao > a.maisCartoes.precisao);
});

test('o sorteador com semente é reprodutível e fica entre 0 e 1', () => {
  const a = sorteador(3);
  const b = sorteador(3);
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('avaliar um catálogo sem grupo com duas matérias avisa em vez de devolver zeros', () => {
  assert.throws(() => avaliarRecomendador(CATALOGO.filter((i) => i.grupo === 'Ciências Humanas' && i.materia === 'enem/historia')), /duas matérias/);
});
