// Configuração central das seções do caderno.
//
// `visivel: false` esconde a seção da navegação E impede que suas páginas
// sejam geradas no build — as rotas viram redirecionamentos para a home.
// É o interruptor único para "guardar" uma seção sem apagar o conteúdo dela.

export type ChaveSecao = 'enem' | 'escolar' | 'ds';

export interface Secao {
  chave: ChaveSecao;
  /** Nome curto, usado nas abas. */
  label: string;
  /** Nome por extenso, usado em títulos e textos. */
  labelLongo: string;
  href: string;
  cor: string;
  corSuave: string;
  icone: string;
  visivel: boolean;
  descricao: string;
}

export const SECOES: Secao[] = [
  {
    chave: 'enem',
    label: 'ENEM',
    labelLongo: 'ENEM',
    href: '/enem',
    cor: 'var(--color-enem)',
    corSuave: 'var(--color-enem-soft)',
    icone: 'graduation-cap',
    visivel: true,
    descricao:
      'Conteúdo focado no que o INEP cobra: teoria direta, pegadinhas mapeadas e questões oficiais para treinar.',
  },
  {
    chave: 'escolar',
    label: 'Escolar',
    labelLongo: 'Escolar',
    href: '/escolar',
    cor: 'var(--color-escolar)',
    corSuave: 'var(--color-escolar-soft)',
    icone: 'book-open',
    // Temporariamente fora do ar enquanto o material é revisado.
    visivel: false,
    descricao:
      'O conteúdo passado em sala de aula, organizado por matéria, bimestre e semana — para quem faltou ou quer revisar.',
  },
  {
    chave: 'ds',
    label: 'Desenvolvimento de Sistemas',
    labelLongo: 'Desenvolvimento de Sistemas',
    href: '/ds',
    cor: 'var(--color-ds)',
    corSuave: 'var(--color-ds-soft)',
    icone: 'code',
    // Temporariamente fora do ar enquanto o material é revisado.
    visivel: false,
    descricao: 'Material do curso técnico, em linguagem simples, para reforçar o que foi visto em aula.',
  },
];

export const SECOES_VISIVEIS = SECOES.filter((s) => s.visivel);

export function secao(chave: ChaveSecao): Secao {
  return SECOES.find((s) => s.chave === chave)!;
}

export function secaoVisivel(chave: ChaveSecao): boolean {
  return secao(chave).visivel;
}
