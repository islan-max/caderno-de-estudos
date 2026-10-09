// Aba Escolar: matéria → bimestre → aula. O mapa (src/data/escolar-mapa.json, gerado por
// scripts/mapear-escolar.mjs) lista todas as aulas do material da escola; uma aula só vira
// link quando o arquivo dela existe em src/content/escolar/<materia>/<N>-bimestre/<aula>.mdx.
// As aulas de revisão dadas pelo professor (revisao-<n>-<tema>.mdx, com order negativo) não
// estão no material: entram no topo do bimestre.
import { getCollection } from 'astro:content';
import mapa from '../data/escolar-mapa.json';
import { bimestreLabel } from './slug';
import { u } from './url';
import type { AulaTrilha, MateriaTrilha } from './materiasSecoes';

export async function materiasEscolar(): Promise<MateriaTrilha[]> {
  const escritas = new Map((await getCollection('escolar')).map((a) => [a.id, a]));
  const usadas = new Set<string>();

  const materias: MateriaTrilha[] = mapa.materias.map((m) => ({
    slug: m.slug,
    nome: m.nome,
    bimestres: m.bimestres.map((b) => {
      const revisoes: AulaTrilha[] = [...escritas.values()]
        .filter((a) => a.id.startsWith(`${m.slug}/${b.slug}/revisao-`))
        .sort((x, y) => x.data.order - y.data.order)
        .map((a) => {
          usadas.add(a.id);
          const slug = a.id.split('/')[2];
          return {
            id: `escolar/${a.id}`,
            slug,
            titulo: a.data.title,
            resumo: a.data.quickSummary ?? a.data.relevance,
            href: u(`/escolar/${a.id}/`),
            pronta: true,
            marca: `R${slug.match(/^revisao-(\d+)/)?.[1] ?? ''}`,
          };
        });

      const aulas: AulaTrilha[] = b.aulas.map((a) => {
        const chave = `${m.slug}/${b.slug}/${a.slug}`;
        const escrita = escritas.get(chave);
        if (escrita) usadas.add(chave);
        return {
          id: `escolar/${chave}`,
          slug: a.slug,
          titulo: escrita?.data.title ?? a.titulo,
          resumo: escrita ? (escrita.data.quickSummary ?? escrita.data.relevance) : a.topicos.join(' · '),
          href: u(`/escolar/${chave}/`),
          pronta: Boolean(escrita),
          marca: String(a.pos).padStart(2, '0'),
          // Número que o material da escola não trouxe: aparece na trilha, sem link.
          aviso: a.material ? undefined : 'Sem material',
        };
      });
      return { slug: b.slug, label: bimestreLabel(b.slug), aulas: [...revisoes, ...aulas] };
    }),
  }));

  // Aula escrita fora do mapa: o mapa está desatualizado (rode scripts/mapear-escolar.mjs).
  for (const id of escritas.keys()) {
    if (!usadas.has(id)) throw new Error(`A aula escolar/${id} não está em src/data/escolar-mapa.json.`);
  }
  return materias;
}
