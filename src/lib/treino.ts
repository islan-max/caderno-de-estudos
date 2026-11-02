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
  dados: 'manha' | 'simulado' | 'humanas' | 'redacao' | 'redacao2024';
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
    id: 'simulado-humanas-2024',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Ciências Humanas · ENEM 2024',
    resumo: 'A área inteira de Humanas do 1º dia, na ordem da prova.',
    icone: 'landmark',
    cor: 'var(--color-historia)',
    minutos: 135,
    dados: 'humanas',
    fonte: 'ENEM 2024, 1º dia, caderno azul',
    dicas: [
      ...DICAS_QUESTOES,
      'Leia a pergunta do fim antes do texto de apoio: você sabe o que procurar enquanto lê.',
    ],
  },
  {
    id: 'simulado-mat-2025',
    grupo: 'simulado',
    tipo: 'questoes',
    titulo: 'Matemática · ENEM 2025',
    resumo: 'A área inteira de Matemática do 2º dia, na ordem da prova.',
    icone: 'square-root-variable',
    cor: 'var(--color-geometria)',
    minutos: 150,
    dados: 'simulado',
    fonte: 'ENEM 2025, 2º dia, caderno azul',
    dicas: [...DICAS_QUESTOES, 'Antes de calcular, sublinhe o que a pergunta pede. Muito erro é parar uma conta antes do fim.'],
  },
  {
    id: 'manha',
    grupo: 'treino',
    tipo: 'questoes',
    titulo: 'Treino de Matemática',
    resumo: 'Das mais fáceis às médias, para pegar ritmo antes de um simulado.',
    icone: 'bullseye',
    cor: 'var(--color-geometria)',
    minutos: 60,
    dados: 'manha',
    fonte: 'ENEM 2022 a 2024, 2º dia, caderno azul',
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
