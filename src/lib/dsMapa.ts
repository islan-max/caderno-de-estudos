// Mapa da aba DS: matéria → bimestre → aula. O mapa (src/data/ds-mapa.json, gerado por
// scripts/mapear-ds.mjs) lista TODAS as aulas do curso; uma aula só vira link quando o
// arquivo dela existe em src/content/ds/<materia>/<bimestre>/<aula>.mdx.
import { getCollection } from 'astro:content';
import mapa from '../data/ds-mapa.json';
import { bimestreLabel } from './slug';
import { u } from './url';
import type { MateriaTrilha } from './materiasSecoes';

export async function materiasDs(): Promise<MateriaTrilha[]> {
  const prontas = new Set((await getCollection('ds')).map((a) => a.id));
  return mapa.materias.map((m) => ({
    slug: m.slug,
    nome: m.nome,
    bimestres: m.bimestres.map((b) => ({
      slug: b.slug,
      label: bimestreLabel(b.slug),
      aulas: b.aulas.map((a) => ({
        slug: a.slug,
        titulo: a.titulo,
        // Cada aula junta o conteúdo da semana: os tópicos fazem de resumo.
        resumo: a.topicos.join(' · '),
        href: u(`/ds/${m.slug}/${b.slug}/${a.slug}/`),
        pronta: prontas.has(`${m.slug}/${b.slug}/${a.slug}`),
        id: `ds/${m.slug}/${b.slug}/${a.slug}`,
        marca: String(a.pos).padStart(2, '0'),
      })),
    })),
  }));
}
