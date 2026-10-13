// Índice de busca consumido pela paleta de comandos (Ctrl/⌘ + K), pelo "sortear", pelo
// "continuar" e pelo painel de progresso. Gerado no build: um único arquivo estático,
// carregado sob demanda. Reúne as aulas que existem nas três abas.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { contarCartoes } from '../lib/cartoes';
import { indiceGeral } from '../lib/indice';

export const GET: APIRoute = async () => {
  const aulas = await indiceGeral();
  // Quantos cartões de revisão (tópicos-chave) cada aula tem. Id igual ao do progresso: "<aba>/<id da coleção>".
  const cartoes = new Map<string, number>();
  for (const aba of ['enem', 'escolar', 'ds'] as const) {
    for (const e of await getCollection(aba)) cartoes.set(`${aba}/${e.id}`, contarCartoes(e.body));
  }
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
    // Só aparece quando a aula tem cartões (o índice carrega em toda página).
    ...(cartoes.get(a.id) ? { k: cartoes.get(a.id) } : {}),
  }));

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
