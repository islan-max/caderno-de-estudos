// As 4 áreas oficiais do ENEM e as matérias de cada uma.
// Fonte única: a página da aba ENEM e o hub leem daqui.

export interface MateriaEnem {
  slug: string;
  label: string;
  icone: string;
}

export interface AreaEnem {
  slug: string;
  label: string;
  labelCurto: string;
  cor: string;
  icone: string;
  subjects: MateriaEnem[];
}

export const ENEM_AREAS: AreaEnem[] = [
  {
    slug: 'natureza',
    label: 'Ciências da Natureza e suas Tecnologias',
    labelCurto: 'Natureza',
    cor: '#3f7d58',
    icone: 'flask',
    subjects: [
      { slug: 'biologia', label: 'Biologia', icone: 'dna' },
      { slug: 'fisica', label: 'Física', icone: 'atom' },
      { slug: 'quimica', label: 'Química', icone: 'vial' },
    ],
  },
  {
    slug: 'humanas',
    label: 'Ciências Humanas e suas Tecnologias',
    labelCurto: 'Humanas',
    cor: '#8a5a2b',
    icone: 'landmark',
    subjects: [
      { slug: 'historia', label: 'História', icone: 'scroll' },
      { slug: 'geografia', label: 'Geografia', icone: 'globe' },
      { slug: 'filosofia', label: 'Filosofia', icone: 'brain' },
      { slug: 'sociologia', label: 'Sociologia', icone: 'landmark' },
    ],
  },
  {
    slug: 'linguagens',
    label: 'Linguagens, Códigos e suas Tecnologias',
    labelCurto: 'Linguagens',
    cor: '#c4432b',
    icone: 'pen-nib',
    subjects: [
      { slug: 'lingua-portuguesa', label: 'Língua Portuguesa e Literatura', icone: 'book' },
      { slug: 'redacao', label: 'Redação', icone: 'pen-to-square' },
      { slug: 'lingua-estrangeira', label: 'Língua Estrangeira (Inglês/Espanhol)', icone: 'spell-check' },
      { slug: 'artes', label: 'Artes', icone: 'palette' },
      { slug: 'educacao-fisica', label: 'Educação Física', icone: 'award' },
      { slug: 'tic', label: 'Tecnologias da Informação e Comunicação', icone: 'code' },
    ],
  },
  {
    slug: 'matematica',
    label: 'Matemática e suas Tecnologias',
    labelCurto: 'Matemática',
    cor: '#2e5c8a',
    icone: 'square-root-variable',
    subjects: [
      { slug: 'matematica-basica', label: 'Matemática Básica', icone: 'calculator' },
      { slug: 'matematica-financeira', label: 'Matemática Financeira', icone: 'chart-simple' },
      { slug: 'geometria', label: 'Geometria', icone: 'cube' },
      { slug: 'estatistica-e-probabilidade', label: 'Estatística e Probabilidade', icone: 'chart-simple' },
      { slug: 'funcoes', label: 'Funções', icone: 'timeline' },
    ],
  },
];

const porMateria = new Map<string, AreaEnem>();
for (const area of ENEM_AREAS) {
  for (const s of area.subjects) porMateria.set(s.slug, area);
}

export function areaDaMateria(slug: string): AreaEnem | undefined {
  return porMateria.get(slug);
}

export function iconeDaMateria(slug: string): string {
  for (const area of ENEM_AREAS) {
    const m = area.subjects.find((s) => s.slug === slug);
    if (m) return m.icone;
  }
  return 'book-open';
}
