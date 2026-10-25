// Avalia o recomendador no catálogo real (dist/aulas.json, gerado pelo build) com pessoas
// sintéticas e semente fixa. Uso: npm run build && node --experimental-strip-types scripts/avaliar-recomendacao.ts
import { readFileSync } from 'node:fs';
import { avaliarRecomendador } from '../src/lib/recomendacao-avaliacao.ts';
import type { ItemRec } from '../src/lib/recomendacao.ts';

const bruto = JSON.parse(readFileSync(new URL('../dist/aulas.json', import.meta.url), 'utf-8')) as {
  id: string; t: string; m: string; s: string; a: string; k?: number;
}[];
const catalogo: ItemRec[] = bruto.map((a) => ({ id: a.id, titulo: a.t, materia: a.s, materiaNome: a.m, grupo: a.a, cartoes: a.k }));

const r = avaliarRecomendador(catalogo, { pessoas: 500, semente: 2026, k: 5 });
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`${catalogo.length} aulas; ${r.pessoas} pessoas sintéticas; k = ${r.k}\n`);
console.log('| Método | Precisão@k | Achou a outra matéria |\n|---|---|---|');
for (const [nome, m] of [
  ['Recomendador (interesse + 👍)', r.recomendador],
  ['Só interesses (sem 👍)', r.soInteresses],
  ['Aulas com mais cartões', r.maisCartoes],
  ['Sorteio (média de 20)', r.sorteio],
] as const) console.log(`| ${nome} | ${pct(m.precisao)} | ${pct(m.achouAOutraMateria)} |`);
