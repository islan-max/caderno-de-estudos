// Abas do estudo (além do Início e das seções de conteúdo): usadas pelo TabNav e pelo
// CabecalhoFixo. As cores são os tokens --color-revisao e --color-estudo (global.css).
export const ABAS_ESTUDO = [
  { key: 'revisao', label: 'Revisão', href: '/revisao', color: 'var(--color-revisao)', soft: 'var(--color-revisao-soft)', icone: 'repeat' },
  { key: 'estudo', label: 'Meu estudo', href: '/meu-estudo', color: 'var(--color-estudo)', soft: 'var(--color-estudo-soft)', icone: 'chart-line' },
] as const;

export type ChaveAba = 'hub' | 'enem' | 'escolar' | 'ds' | (typeof ABAS_ESTUDO)[number]['key'];
