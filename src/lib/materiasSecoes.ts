// Formato comum das trilhas de aulas das abas DS e Escolar (matéria → bimestre → aula) e o
// registro de ícones das matérias dessas abas. O ENEM tem o dele em enemAreas.ts.
import type { AreaEnem, MateriaEnem } from './enemAreas';

/** Uma aula numa trilha (TrilhaAulas). Sem `pronta`, aparece sem link ("Em breve" ou `aviso`). */
export interface AulaTrilha {
  /** Identificador no progresso local: "ds/back-end/4-bimestre/aula-1-…". */
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  href: string;
  pronta: boolean;
  /** Texto no lugar do número da posição (ex.: R1 numa revisão). */
  marca?: string;
  /** Selo da aula sem link; o padrão da trilha é "Em breve". */
  aviso?: string;
}
export interface BimestreTrilha {
  slug: string;
  label: string;
  aulas: AulaTrilha[];
}
export interface MateriaTrilha {
  slug: string;
  nome: string;
  bimestres: BimestreTrilha[];
}

export const contarAulas = (bs: BimestreTrilha[]) => ({
  total: bs.reduce((n, b) => n + b.aulas.length, 0),
  prontas: bs.reduce((n, b) => n + b.aulas.filter((a) => a.pronta).length, 0),
});

/** Ids (progresso local) das aulas que existem, para o `data-progresso-de`. */
export const idsProntos = (m: MateriaTrilha): string[] =>
  m.bimestres.flatMap((b) => b.aulas.filter((a) => a.pronta).map((a) => a.id));

const ICONES: Record<string, string> = {
  // DS
  'front-end': 'code',
  'back-end': 'sitemap',
  'banco-de-dados': 'database',
  'inteligencia-artificial': 'robot',
  'programacao-mobile': 'rocket',
  'projeto-multidisciplinar': 'lightbulb',
  'versionamento-de-codigo': 'share-nodes',
  // Escolar
  matematica: 'calculator',
  'lingua-portuguesa': 'book',
};
export const iconeDaMateriaSecao = (slug: string): string => ICONES[slug] ?? 'book-open';

/** Reúne as matérias de uma aba num grupo no formato das áreas do ENEM (AreaMaterias). */
export function grupoDaSecao(
  slug: 'ds' | 'escolar',
  label: string,
  icone: string,
  materias: { slug: string; nome: string }[]
): AreaEnem {
  const subjects: MateriaEnem[] = materias.map((m) => ({ slug: m.slug, label: m.nome, icone: iconeDaMateriaSecao(m.slug) }));
  return { slug, label, labelCurto: label, cor: `var(--color-${slug})`, icone, subjects };
}
