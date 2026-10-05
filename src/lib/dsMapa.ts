// Mapa da aba DS: matéria → bimestre → aula. O mapa (src/data/ds-mapa.json, gerado por
// scripts/mapear-ds.mjs) lista TODAS as aulas do curso; uma aula só vira link quando o
// arquivo dela existe em src/content/ds/<materia>/<bimestre>/<aula>.mdx.
import { getCollection } from 'astro:content';
import mapa from '../data/ds-mapa.json';
import { bimestreLabel } from './slug';

export interface AulaDs {
  pos: number;
  slug: string;
  titulo: string;
  topicos: string[];
  pronta: boolean;
  /** Identificador no progresso local: "ds/back-end/4-bimestre/aula-1-...". */
  id: string;
}
export interface BimestreDs {
  slug: string;
  label: string;
  aulas: AulaDs[];
}
export interface MateriaDs {
  slug: string;
  nome: string;
  bimestres: BimestreDs[];
}

export async function materiasDs(): Promise<MateriaDs[]> {
  const prontas = new Set((await getCollection('ds')).map((a) => a.id));
  return mapa.materias.map((m) => ({
    slug: m.slug,
    nome: m.nome,
    bimestres: m.bimestres.map((b) => ({
      slug: b.slug,
      label: bimestreLabel(b.slug),
      aulas: b.aulas.map((a) => ({
        pos: a.pos,
        slug: a.slug,
        titulo: a.titulo,
        topicos: a.topicos,
        pronta: prontas.has(`${m.slug}/${b.slug}/${a.slug}`),
        id: `ds/${m.slug}/${b.slug}/${a.slug}`,
      })),
    })),
  }));
}

export const contarAulas = (bs: BimestreDs[]) => ({
  total: bs.reduce((n, b) => n + b.aulas.length, 0),
  prontas: bs.reduce((n, b) => n + b.aulas.filter((a) => a.pronta).length, 0),
});
