import type { Evento } from './eventos.ts';
import { estadoDoConceito } from './estados.ts';

export type EstadoDiagnostico = 'firme' | 'parcial' | 'lacuna' | 'dados-insuficientes';

/** Menos que isto não diz nada: uma resposta só nunca vira diagnóstico. */
export const MINIMO_DE_EVIDENCIAS = 2;

export interface ResultadoDoConceito {
  conceitoId: string;
  estado: EstadoDiagnostico;
  /** O que foi usado na conta, em ordem cronológica. */
  evidencias: Evento[];
}

/**
 * - dados-insuficientes: menos de duas respostas (questões ou cartões) sobre o conceito;
 * - lacuna: o último resultado foi erro;
 * - firme: desde o último erro, acertos em pelo menos dois dias diferentes;
 * - parcial: o resto (acertos recentes, mas ainda sem a repetição em dias diferentes).
 * Nunca vira nota nem porcentagem.
 */
export function diagnosticoDoConceito(vigentesDoEstudante: Evento[], conceitoId: string): ResultadoDoConceito {
  const evidencias = vigentesDoEstudante
    .filter((e) => e.resultado && e.conceitoIds.includes(conceitoId))
    .sort((a, b) => a.quando.localeCompare(b.quando));
  if (evidencias.length < MINIMO_DE_EVIDENCIAS) return { conceitoId, estado: 'dados-insuficientes', evidencias };
  const estado = estadoDoConceito(vigentesDoEstudante, conceitoId);
  return {
    conceitoId,
    estado: estado === 'precisa-revisar' ? 'lacuna' : estado === 'retido' ? 'firme' : 'parcial',
    evidencias,
  };
}

/** Diagnóstico de um conjunto de conceitos (uma unidade). `conclusivo` é falso enquanto nenhum conceito tem dados. */
export function diagnosticoDaUnidade(vigentesDoEstudante: Evento[], conceitoIds: string[]) {
  const resultados = conceitoIds.map((id) => diagnosticoDoConceito(vigentesDoEstudante, id));
  return { resultados, conclusivo: resultados.some((r) => r.estado !== 'dados-insuficientes') };
}
