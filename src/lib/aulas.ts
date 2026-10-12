// Índice plano de aulas: alimenta a busca, o "continuar de onde parou",
// o progresso e a navegação anterior/próxima entre aulas.
//
// A ordem aqui é a ordem de aprendizado: área -> matéria -> posição no mapa
// (src/data/enem-mapa.json). É a mesma sequência usada para exibir as listas de cima
// para baixo, então "próxima aula" nunca diverge do que a lista mostra.
import { getCollection } from 'astro:content';
import mapa from '../data/enem-mapa.json';
import registroDeConceitos from '../data/conceitos.json';
import { ENEM_AREAS, areaDaMateria, iconeDaMateria } from './enemAreas';
import { u } from './url';

interface ItemMapa {
  slug: string;
  /** Só nas aulas ainda não escritas. */
  titulo?: string;
  resumo?: string;
  /** Agrupa a trilha da matéria (só nas matérias já organizadas em unidades). */
  unidade?: string;
  /** Slugs de aulas da mesma matéria que ela pressupõe. Só orienta: nada fica bloqueado. */
  preRequisitos?: string[];
}
const MAPA = mapa.materias as Record<string, ItemMapa[]>;

/** Posição (0, 1, 2…) da aula na ordem de aprendizado da matéria; -1 se ela não está no mapa. */
function posicaoNoMapa(materia: string, tema: string): number {
  return (MAPA[materia] ?? []).findIndex((i) => i.slug === tema);
}

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
  /** Ids das aulas que ela pressupõe. */
  preRequisitos: string[];
  /** Conceitos que a aula ensina (ids). */
  conceitos: string[];
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
    if (posicaoNoMapa(materia, tema) < 0) {
      throw new Error(`A aula enem/${materia}/${tema} não está em src/data/enem-mapa.json: coloque-a na ordem de aprendizado.`);
    }
    const area = areaDaMateria(materia);
    return {
      id: `enem/${materia}/${tema}`,
      materia,
      materiaLabel: aula.data.subject,
      tema,
      titulo: aula.data.title,
      ordem: posicaoNoMapa(materia, tema),
      href: u(`/enem/${materia}/${tema}/`),
      areaLabel: area?.label ?? 'ENEM',
      areaCurto: area?.labelCurto ?? 'ENEM',
      areaCor: area?.cor ?? 'var(--color-enem)',
      icone: iconeDaMateria(materia),
      resumo: aula.data.quickSummary ?? aula.data.relevance,
      preRequisitos: (MAPA[materia]?.[posicaoNoMapa(materia, tema)]?.preRequisitos ?? []).map((s) => `enem/${materia}/${s}`),
      conceitos: aula.data.conceitos,
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
    // Anterior e próxima só entre aulas que existem; a posição conta o mapa inteiro, igual à trilha.
    anterior: i > 0 ? lista[i - 1] : null,
    proxima: i >= 0 && i < lista.length - 1 ? lista[i + 1] : null,
    posicao: posicaoNoMapa(materia, tema) + 1,
    total: (MAPA[materia] ?? []).length,
  };
}

/** Uma linha da trilha de aulas (TrilhaAulas): aulas prontas e as que ainda vêm. */
export interface ItemTrilhaEnem {
  id: string;
  titulo: string;
  resumo: string;
  href: string;
  pronta: boolean;
  unidade?: string;
  /** Aulas que ela pressupõe, com o título para o aviso. */
  pre?: { id: string; titulo: string }[];
  /** Conceitos da aula, com o nome, para o "Ver o que ficou" da unidade. */
  conceitos?: { id: string; nome: string }[];
}

/** A trilha inteira de uma matéria, na ordem de aprendizado. Aula ainda não escrita vem sem link. */
export async function trilhaEnem(materia: string): Promise<ItemTrilhaEnem[]> {
  const prontas = new Map((await aulasDaMateria(materia)).map((a) => [a.tema, a]));
  const itens = MAPA[materia] ?? [];
  const tituloDe = (slug: string) => prontas.get(slug)?.titulo ?? itens.find((i) => i.slug === slug)?.titulo ?? slug;
  return itens.map((item) => {
    const a = prontas.get(item.slug);
    const base = { unidade: item.unidade, pre: (item.preRequisitos ?? []).map((s) => ({ id: `enem/${materia}/${s}`, titulo: tituloDe(s) })) };
    return a
      ? {
          id: a.id, titulo: a.titulo, resumo: a.resumo, href: a.href, pronta: true, ...base,
          conceitos: a.conceitos.map((id) => ({ id, nome: (registroDeConceitos as Record<string, { nome: string }>)[id].nome })),
        }
      : {
          id: `enem/${materia}/${item.slug}`,
          titulo: item.titulo ?? item.slug,
          resumo: item.resumo ?? '',
          href: '',
          pronta: false,
          ...base,
        };
  });
}
