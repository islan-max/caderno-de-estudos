// Índice de busca consumido pela paleta de comandos (Ctrl/⌘ + K), pelo "sortear", pelo
// "continuar" e pelo painel de progresso. Gerado no build: um único arquivo estático,
// carregado sob demanda. Reúne as aulas que existem nas três abas.
import type { APIRoute } from 'astro';
import { indiceGeral } from '../lib/indice';

export const GET: APIRoute = async () => {
  const aulas = await indiceGeral();
  const payload = aulas.map((a) => ({
    id: a.id,
    t: a.titulo,
    m: a.materiaLabel,
    // Matéria dentro da aba: "Língua Portuguesa" existe no ENEM e no Escolar.
    s: `${a.secao}/${a.materia}`,
    a: a.grupo,
    h: a.href,
    i: a.icone,
    c: a.grupoCor,
  }));

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
