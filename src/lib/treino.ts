// Listas de treino (/treino): simulados de provas reais do ENEM e propostas de redação.
// As questões vivem em src/data/treino.json, gerado por scripts/gerar-treino.py a partir do PDF
// oficial do INEP. Aqui ficam só os metadados de cada lista, usados pela página de navegação
// (/treino/) e pela página da lista (/treino/[id]/).

export type TipoTreino = 'questoes' | 'redacao';
export type GrupoTreino = 'simulado' | 'treino' | 'redacao';

export interface ConjuntoTreino {
  /** Vira o endereço e a chave do progresso guardado no navegador (cdt:treino:<id>). */
  id: string;
  grupo: GrupoTreino;
  tipo: TipoTreino;
  titulo: string;
  /** Uma frase que diz o que é a lista. */
  resumo: string;
  icone: string;
  cor: string;
  minutos: number;
  /** Chave em src/data/treino.json: lista de questões ou páginas da proposta de redação. */
  dados: 'manha' | 'lingua' | 'humanas' | 'natureza' | 'simulado' | 'redacao' | 'redacao2024';
  /** De onde vêm as questões ou a proposta. */
  fonte: string;
  dicas: string[];
  /** Só na redação: o tema oficial. */
  tema?: string;
}

const DICAS_QUESTOES = [
  'Marque só a letra. Nada é corrigido até você entregar.',
  'Errar não desconta ponto: não deixe nenhuma em branco.',
  'Marque “Chutei” quando não tiver certeza. O resultado separa os chutes dos acertos firmes.',
];

export const CONJUNTOS: ConjuntoTreino[] = [
  {
    id: 'simulado-linguagens-2023',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Linguagens · ENEM 2023',
    resumo: 'A área de Linguagens do 1º dia, na ordem da prova, sem as cinco de língua estrangeira.',
    icone: 'book-open',
    cor: 'var(--color-lingua-portuguesa)',
    minutos: 130,
    dados: 'lingua',
    fonte: 'ENEM 2023, 1º dia, caderno azul, questões 6 a 45',
    dicas: [...DICAS_QUESTOES, 'Leia a pergunta antes do texto: você sabe o que procurar enquanto lê.'],
  },
  {
    id: 'simulado-humanas-2023',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Ciências Humanas · ENEM 2023',
    resumo: 'A área inteira de Humanas do 1º dia, na ordem da prova.',
    icone: 'landmark',
    cor: 'var(--color-historia)',
    minutos: 150,
    dados: 'humanas',
    fonte: 'ENEM 2023, 1º dia, caderno azul, questões 46 a 90',
    dicas: [
      ...DICAS_QUESTOES,
      'Leia a pergunta do fim antes do texto de apoio: você sabe o que procurar enquanto lê.',
    ],
  },
  {
    id: 'simulado-natureza-2023',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Ciências da Natureza · ENEM 2023',
    resumo: 'A área inteira de Natureza do 2º dia, na ordem da prova.',
    icone: 'atom',
    cor: 'var(--color-biologia)',
    minutos: 150,
    dados: 'natureza',
    fonte: 'ENEM 2023, 2º dia, caderno azul, questões 91 a 135',
    dicas: [...DICAS_QUESTOES, 'Muita questão de Natureza se resolve só com o texto e o gráfico. Marque o que a conta ou o texto mostram, não o que você lembra.'],
  },
  {
    id: 'simulado-matematica-2022',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Matemática · ENEM 2022',
    resumo: 'A área de Matemática do 2º dia, na ordem da prova, sem duas que já foram feitas em outra lista.',
    icone: 'square-root-variable',
    cor: 'var(--color-geometria)',
    minutos: 140,
    dados: 'simulado',
    fonte: 'ENEM 2022, 2º dia, caderno azul, questões 136 a 180 (sem a 164 e a 171)',
    dicas: [...DICAS_QUESTOES, 'Antes de calcular, sublinhe o que a pergunta pede. Muito erro é parar uma conta antes do fim.'],
  },
  {
    id: 'treino-matematica-2023',
    grupo: 'treino',
    tipo: 'questoes',
    titulo: 'Treino de Matemática · ENEM 2023',
    resumo: 'As 30 mais acessíveis da prova, das mais fáceis às mais difíceis, para pegar ritmo.',
    icone: 'bullseye',
    cor: 'var(--color-geometria)',
    minutos: 90,
    dados: 'manha',
    fonte: 'ENEM 2023, 2º dia, caderno azul',
    dicas: DICAS_QUESTOES,
  },
  {
    id: 'redacao-2024',
    grupo: 'redacao',
    tipo: 'redacao',
    titulo: 'Redação · ENEM 2024',
    resumo: 'Proposta oficial com os seis textos de apoio.',
    icone: 'feather-pointed',
    cor: 'var(--color-redacao)',
    minutos: 75,
    dados: 'redacao2024',
    fonte: 'ENEM 2024, 1º dia',
    tema: 'Desafios para a valorização da herança africana no Brasil',
    dicas: [],
  },
  {
    id: 'redacao-2025',
    grupo: 'redacao',
    tipo: 'redacao',
    titulo: 'Redação · ENEM 2025',
    resumo: 'Proposta oficial com os textos de apoio.',
    icone: 'feather-pointed',
    cor: 'var(--color-redacao)',
    minutos: 75,
    dados: 'redacao',
    fonte: 'ENEM 2025, 1º dia',
    tema: 'Perspectivas acerca do envelhecimento na sociedade brasileira',
    dicas: [],
  },
];

export const GRUPOS: { id: GrupoTreino; titulo: string; sub: string }[] = [
  { id: 'simulado', titulo: 'Simulados completos', sub: 'Uma área inteira de uma prova real, com o tempo da prova.' },
  { id: 'treino', titulo: 'Treino rápido', sub: 'Menos questões, para uma sessão curta.' },
  { id: 'redacao', titulo: 'Redação', sub: 'Propostas oficiais para escrever na folha, com cronômetro.' },
];

/** 135 → "2h15", 75 → "1h15", 45 → "45 min". */
export function duracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  return h ? `${h}h${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`;
}

/** Segundos → "mm:ss" (ou "h:mm:ss" de uma hora para cima). */
export function relogio(segundos: number): string {
  const s = Math.abs(Math.round(segundos));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
