import { FILA_MAXIMA } from './revisao.ts';

/** Só o que altera algo visível: as matérias priorizadas (aula nova) e o ritmo (tamanho da fila de cartões). */
export interface Perfil {
  /** Até três matérias do ENEM (slug), em ordem de prioridade. */
  prioridades: string[];
  /** Dias de estudo por semana: 2 (1 a 2), 4 (3 a 4) ou 6 (5 ou mais). */
  ritmo: 2 | 4 | 6;
}

export const PERFIL_PADRAO: Perfil = { prioridades: [], ritmo: 4 };

/** Aceita qualquer coisa vinda do armazenamento e devolve um perfil válido. */
export function normalizarPerfil(bruto: unknown): Perfil {
  const p = (bruto ?? {}) as Partial<Perfil>;
  const prioridades = Array.isArray(p.prioridades)
    ? [...new Set(p.prioridades.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)))].slice(0, 3)
    : [];
  const ritmo = p.ritmo === 2 || p.ritmo === 6 ? p.ritmo : 4;
  return { prioridades, ritmo };
}

/** Cartões por sessão: 5, 10 ou 15 conforme o ritmo. */
export function tamanhoDaFila(perfil: Perfil): number {
  return perfil.ritmo === 2 ? FILA_MAXIMA / 2 : perfil.ritmo === 6 ? FILA_MAXIMA * 1.5 : FILA_MAXIMA;
}
