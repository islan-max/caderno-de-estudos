// Testes do simulado. Rodam com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { embaralhar, formatarTempo, lerSalvo, resultado, sortear } from './simulado.ts';
import type { QuestaoDisponivel } from './simulado.ts';

/** Gerador previsível para os testes. */
function semente(s = 42) {
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

function banco(materia: string, aulas: number, porAula = 5): QuestaoDisponivel[] {
  const lista: QuestaoDisponivel[] = [];
  for (let a = 0; a < aulas; a++) for (let n = 0; n < porAula; n++) lista.push({ aula: `enem/${materia}/aula-${a}`, materia, n });
  return lista;
}

const todas = [...banco('quimica', 9), ...banco('biologia', 11), ...banco('fisica', 10)];
const chave = (q: QuestaoDisponivel) => `${q.aula}#${q.n}`;

test('embaralhar mantém os mesmos itens e não mexe na lista original', () => {
  const original = [1, 2, 3, 4, 5];
  const saida = embaralhar(original, semente());
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
  assert.deepEqual([...saida].sort(), original);
});

test('sortear divide igual entre as matérias e não repete questão', () => {
  const s = sortear(todas, ['quimica', 'biologia', 'fisica'], 15, semente());
  assert.equal(s.length, 15);
  assert.equal(new Set(s.map(chave)).size, 15);
  for (const m of ['quimica', 'biologia', 'fisica']) assert.equal(s.filter((q) => q.materia === m).length, 5, m);
});

test('sortear manda a sobra da divisão para as primeiras matérias', () => {
  const s = sortear(todas, ['quimica', 'biologia', 'fisica'], 10, semente());
  assert.deepEqual(
    ['quimica', 'biologia', 'fisica'].map((m) => s.filter((q) => q.materia === m).length),
    [4, 3, 3]
  );
});

test('sortear usa só as matérias escolhidas', () => {
  const s = sortear(todas, ['biologia'], 8, semente());
  assert.equal(s.length, 8);
  assert.ok(s.every((q) => q.materia === 'biologia'));
});

test('matéria sem questões suficientes entra com todas e as outras completam', () => {
  const pouco = [...banco('quimica', 1, 2), ...banco('fisica', 10)];
  const s = sortear(pouco, ['quimica', 'fisica'], 10, semente());
  assert.equal(s.filter((q) => q.materia === 'quimica').length, 2);
  assert.equal(s.filter((q) => q.materia === 'fisica').length, 8);
});

test('pedir mais do que existe devolve tudo o que existe', () => {
  const pequeno = banco('quimica', 1, 3);
  assert.equal(sortear(pequeno, ['quimica'], 50, semente()).length, 3);
  assert.equal(sortear(pequeno, ['quimica'], 0, semente()).length, 0);
  assert.equal(sortear(pequeno, ['fisica'], 5, semente()).length, 0);
});

test('resultado conta acertos, respondidas e separa por matéria', () => {
  const r = resultado([
    { materia: 'quimica', correta: 0, escolha: 0 },
    { materia: 'quimica', correta: 1, escolha: 2 },
    { materia: 'fisica', correta: 3, escolha: -1 },
    { materia: 'fisica', correta: 4, escolha: 4 },
  ]);
  assert.equal(r.acertos, 2);
  assert.equal(r.respondidas, 3);
  assert.equal(r.total, 4);
  assert.deepEqual(r.porMateria, [
    { materia: 'quimica', acertos: 1, total: 2 },
    { materia: 'fisica', acertos: 1, total: 2 },
  ]);
});

test('formatarTempo', () => {
  assert.equal(formatarTempo(0), '00:00');
  assert.equal(formatarTempo(425_000), '07:05');
  assert.equal(formatarTempo(3_729_000), '1:02:09');
  assert.equal(formatarTempo(-5000), '00:00');
});

test('lerSalvo aceita o formato certo e recusa o resto', () => {
  const ok = { questoes: [{ aula: 'enem/quimica/a', materia: 'quimica', n: 2 }], respostas: [3], inicio: 1, limite: null };
  assert.deepEqual(lerSalvo(ok), ok);
  assert.deepEqual(lerSalvo({ ...ok, respostas: [9] })?.respostas, [-1]);
  assert.equal(lerSalvo(null), null);
  assert.equal(lerSalvo({ ...ok, respostas: [] }), null);
  assert.equal(lerSalvo({ ...ok, questoes: [{ aula: 1 }] }), null);
  assert.equal(lerSalvo({ ...ok, limite: 'x' }), null);
});
