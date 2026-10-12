import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desfazerConclusao, importarLegado, lerEventos, registrarConclusao, registrarQuestao } from './armazem.ts';
import { conceitosInvalidos } from './conceitos.ts';
import { vigentes, type Evento } from './eventos.ts';
import { estadoDoConceito } from './estados.ts';
import { diasDeEstudo, progressoDaMateria } from './metricas.ts';

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
