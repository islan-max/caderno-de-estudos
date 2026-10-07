// Índice de busca consumido pela paleta de comandos (Ctrl/⌘ + K).
// Gerado no build: um único arquivo estático, carregado sob demanda.
import type { APIRoute } from 'astro';
import { indiceEnem } from '../lib/aulas';

export const GET: APIRoute = async () => {
  const aulas = await indiceEnem();
  const payload = aulas.map((a) => ({
    id: a.id,
    t: a.titulo,
    m: a.materiaLabel,
    s: a.materia,
    a: a.areaCurto,
    h: a.href,
    i: a.icone,
    c: a.areaCor,
  }));

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
