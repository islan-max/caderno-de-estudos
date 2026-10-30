import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONJUNTOS, duracao, relogio } from './treino.ts';

const dados = JSON.parse(readFileSync(new URL('../data/treino.json', import.meta.url), 'utf-8'));

test('duracao e relogio', () => {
  assert.equal(duracao(135), '2h15');
  assert.equal(duracao(60), '1h00');
  assert.equal(duracao(45), '45 min');
  assert.equal(relogio(65), '01:05');
  assert.equal(relogio(-65), '01:05');
  assert.equal(relogio(3725), '1:02:05');
});

test('cada lista aponta para dados que existem', () => {
  const ids = new Set<string>();
  for (const c of CONJUNTOS) {
    assert.ok(!ids.has(c.id), `id repetido: ${c.id}`);
    ids.add(c.id);
    assert.ok(Array.isArray(dados[c.dados]) && dados[c.dados].length > 0, `${c.id}: sem dados em ${c.dados}`);
  }
});

test('questões: gabarito e alternativas coerentes, sem repetir id', () => {
  const ids = new Set<string>();
  for (const c of CONJUNTOS.filter((x) => x.tipo === 'questoes')) {
    for (const q of dados[c.dados]) {
      assert.ok(!ids.has(q.id), `questão repetida: ${q.id}`);
      ids.add(q.id);
      assert.ok(q.gabarito === null || 'ABCDE'.includes(q.gabarito), `${q.id}: gabarito inválido`);
      assert.ok(q.alternativas === null || q.alternativas.length === 5, `${q.id}: alternativas != 5`);
      assert.ok(q.imgs.length > 0, `${q.id}: sem imagem`);
    }
  }
});
