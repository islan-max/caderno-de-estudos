// Cartões de revisão (flashcards) escritos nas aulas do ENEM, reunidos num arquivo estático que a
// página /revisao carrega sob demanda. Só entra o que está no frontmatter da aula: nada é gerado.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { u } from '../lib/url';

export const GET: APIRoute = async () => {
  const aulas = await getCollection('enem');
  const cartoes = aulas.flatMap((aula) =>
    aula.data.cartoes.map((c) => ({
      id: `enem/${aula.id}/${c.id}`,
      aulaId: `enem/${aula.id}`,
      aula: aula.data.title,
      href: u(`/enem/${aula.id}/`),
      tipo: c.tipo,
      frente: c.frente,
      verso: c.verso,
      conceito: c.conceito,
    }))
  );
  return new Response(JSON.stringify(cartoes), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
