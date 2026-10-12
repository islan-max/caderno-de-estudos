import type { Evento } from './eventos.ts';
import { estadoDoConceito } from './estados.ts';
import { estadoDoCartao } from './revisao.ts';

/**
 * "Precisa revisar": algum conceito da aula está em "precisa-revisar" (último resultado foi erro)
 * ou um cartão dela chegou à data de revisão. Só olha o que o estudante já fez na aula.
 */
export function aulaPrecisaRevisar(vigentesDoEstudante: Evento[], aulaId: string, hoje: string): boolean {
  const daAula = vigentesDoEstudante.filter((e) => e.aulaId === aulaId);
  const conceitos = new Set(daAula.flatMap((e) => e.conceitoIds));
  if ([...conceitos].some((c) => estadoDoConceito(vigentesDoEstudante, c) === 'precisa-revisar')) return true;
  const cartoes = new Set(daAula.filter((e) => e.tipo === 'cartao_revisado').map((e) => e.cartaoId!));
  return [...cartoes].some((id) => {
    const { venceEm } = estadoDoCartao(vigentesDoEstudante, id);
    return venceEm !== null && venceEm <= hoje;
  });
}

/** Pré-requisitos ainda não concluídos. Só orienta: nada fica bloqueado. */
export function preRequisitosPendentes(preRequisitos: string[] | undefined, concluidas: Set<string>): string[] {
  return (preRequisitos ?? []).filter((id) => !concluidas.has(id));
}
