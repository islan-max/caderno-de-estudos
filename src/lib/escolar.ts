// Aba Escolar: matéria → bimestre → aula, montada a partir dos arquivos em
// src/content/escolar/<materia>/<N>-bimestre/aula-<N>-<titulo>.mdx (sem mapa fixo).
import { getCollection } from 'astro:content';
import { bimestreLabel } from './slug';

export interface AulaEscolar {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
}
export interface BimestreEscolar {
  slug: string;
  label: string;
  aulas: AulaEscolar[];
}
export interface MateriaEscolar {
  slug: string;
  nome: string;
  bimestres: BimestreEscolar[];
}

export async function materiasEscolar(): Promise<MateriaEscolar[]> {
  const aulas = await getCollection('escolar');
  const materias = new Map<string, MateriaEscolar>();
  for (const a of aulas) {
    const [m, b, slug] = a.id.split('/');
    const mat = materias.get(m) ?? { slug: m, nome: a.data.subject, bimestres: [] };
    let bim = mat.bimestres.find((x) => x.slug === b);
    if (!bim) mat.bimestres.push((bim = { slug: b, label: bimestreLabel(b), aulas: [] }));
    bim.aulas.push({
      id: `escolar/${m}/${b}/${slug}`,
      slug,
      titulo: a.data.title,
      resumo: a.data.quickSummary ?? a.data.relevance,
      ordem: a.data.order,
    });
    materias.set(m, mat);
  }
  const lista = [...materias.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  for (const m of lista) {
    m.bimestres.sort((x, y) => x.slug.localeCompare(y.slug));
    for (const b of m.bimestres) b.aulas.sort((x, y) => x.ordem - y.ordem);
  }
  return lista;
}
