// Índice plano de aulas: alimenta a busca, o "continuar de onde parou",
// o progresso e a navegação anterior/próxima entre aulas.
//
// A ordem aqui é a ordem de aprendizado: área -> matéria -> `order` do
// frontmatter. É a mesma sequência usada para exibir as listas de cima
// para baixo, então "próxima aula" nunca diverge do que a lista mostra.
import { getCollection } from 'astro:content';
import { ENEM_AREAS, areaDaMateria, iconeDaMateria } from './enemAreas';
import { u } from './url';

export interface AulaIndexada {
  /** Identificador estável usado no armazenamento local: "enem/fisica/optica". */
  id: string;
  materia: string;
  materiaLabel: string;
  tema: string;
  titulo: string;
  ordem: number;
  href: string;
  areaLabel: string;
  areaCurto: string;
  areaCor: string;
  icone: string;
  resumo: string;
}

const posicaoMateria = new Map<string, number>();
ENEM_AREAS.forEach((area, ai) => {
  area.subjects.forEach((s, si) => posicaoMateria.set(s.slug, ai * 100 + si));
});

let cache: AulaIndexada[] | null = null;

export async function indiceEnem(): Promise<AulaIndexada[]> {
  if (cache) return cache;

  const aulas = await getCollection('enem');
  const lista: AulaIndexada[] = aulas.map((aula) => {
    const [materia, tema] = aula.id.split('/');
    const area = areaDaMateria(materia);
    return {
      id: `enem/${materia}/${tema}`,
      materia,
      materiaLabel: aula.data.subject,
      tema,
      titulo: aula.data.title,
      ordem: aula.data.order,
      href: u(`/enem/${materia}/${tema}/`),
      areaLabel: area?.label ?? 'ENEM',
      areaCurto: area?.labelCurto ?? 'ENEM',
      areaCor: area?.cor ?? 'var(--color-enem)',
      icone: iconeDaMateria(materia),
      resumo: aula.data.quickSummary ?? aula.data.relevance,
    };
  });

  lista.sort((a, b) => {
    const pa = posicaoMateria.get(a.materia) ?? 999;
    const pb = posicaoMateria.get(b.materia) ?? 999;
    if (pa !== pb) return pa - pb;
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });

  cache = lista;
  return lista;
}

/** Aulas de uma matéria, já na ordem de aprendizado. */
export async function aulasDaMateria(materia: string): Promise<AulaIndexada[]> {
  return (await indiceEnem()).filter((a) => a.materia === materia);
}

/** Aula anterior e próxima dentro da mesma matéria. */
export async function vizinhas(materia: string, tema: string) {
  const lista = await aulasDaMateria(materia);
  const i = lista.findIndex((a) => a.tema === tema);
  return {
    anterior: i > 0 ? lista[i - 1] : null,
    proxima: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null,
    posicao: i + 1,
    total: lista.length,
  };
}
