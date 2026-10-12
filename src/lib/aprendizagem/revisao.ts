import { diaDaData, diaLocal, type Evento } from './eventos.ts';

/** Dias até a próxima revisão em cada caixa (1 a 6). */
export const INTERVALOS = [1, 3, 7, 14, 30, 60];
/** Cartões por sessão; o excesso fica guardado para a vez seguinte. */
export const FILA_MAXIMA = 10;

export interface EstadoDoCartao {
  /** 0 = nunca revisado. */
  caixa: number;
  /** Dia local (AAAA-MM-DD) em que volta a vencer; null se nunca foi revisado. */
  venceEm: string | null;
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaDaData(new Date(a, m - 1, d + n, 12));
}

/**
 * Reproduz as revisões do cartão em ordem:
 * - não lembrei: volta à caixa 1;
 * - com dificuldade: fica na caixa (um cartão novo vai para a 1);
 * - lembrei: sobe uma caixa (a 6 é o teto).
 * A data de vencimento é o dia da revisão mais o intervalo da caixa em que o cartão ficou.
 */
export function estadoDoCartao(vigentesDoEstudante: Evento[], cartaoId: string): EstadoDoCartao {
  const revisoes = vigentesDoEstudante
    .filter((e) => e.tipo === 'cartao_revisado' && e.cartaoId === cartaoId)
    .sort((a, b) => a.quando.localeCompare(b.quando));
  let caixa = 0;
  let venceEm: string | null = null;
  for (const e of revisoes) {
    if (e.resultado === 'nao_lembrei') caixa = 1;
    else if (e.resultado === 'dificil') caixa = Math.max(1, caixa);
    else if (e.resultado === 'lembrei') caixa = Math.min(INTERVALOS.length, Math.max(1, caixa) + 1);
    else continue;
    venceEm = somarDias(diaLocal(e), INTERVALOS[caixa - 1]);
  }
  return { caixa, venceEm };
}

/** Cartões revisados cujo vencimento é hoje ou antes. */
export function vencidos(vigentesDoEstudante: Evento[], cartaoIds: string[], hoje: string): string[] {
  return cartaoIds.filter((id) => {
    const { venceEm } = estadoDoCartao(vigentesDoEstudante, id);
    return venceEm !== null && venceEm <= hoje;
  });
}

/** Fila do dia: primeiro os vencidos (os mais atrasados antes), depois os novos, até o limite. */
export function filaDoDia(vigentesDoEstudante: Evento[], cartaoIds: string[], hoje: string, limite = FILA_MAXIMA) {
  const estados = new Map(cartaoIds.map((id) => [id, estadoDoCartao(vigentesDoEstudante, id)]));
  const atrasados = cartaoIds
    .filter((id) => {
      const v = estados.get(id)!.venceEm;
      return v !== null && v <= hoje;
    })
    .sort((a, b) => estados.get(a)!.venceEm!.localeCompare(estados.get(b)!.venceEm!));
  const novos = cartaoIds.filter((id) => estados.get(id)!.venceEm === null);
  const todos = [...atrasados, ...novos];
  return { fila: todos.slice(0, limite), restantes: Math.max(0, todos.length - limite), vencidos: atrasados.length };
}
