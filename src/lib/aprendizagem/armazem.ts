import { anexar, vigentes, type Evento } from './eventos.ts';
import { normalizarPerfil, PERFIL_PADRAO, type Perfil } from './perfil.ts';
import type { Sessao } from './sessoes.ts';

const CHAVE = 'cdt:v2:eventos';
const VERSAO = 1;
const CHAVE_PROGRESSO_LEGADA = 'cdt:progresso';

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>;

/** Lê os eventos. Armazenamento bloqueado, vazio ou de outra versão = lista vazia. */
export function lerEventos(armazenamento: Armazenamento = localStorage): Evento[] {
  try {
    const dados = JSON.parse(armazenamento.getItem(CHAVE) ?? 'null');
    return dados?.versao === VERSAO && Array.isArray(dados.eventos) ? dados.eventos : [];
  } catch {
    return [];
  }
}

/** Grava o evento; devolve false se o armazenamento recusar (a interface segue funcionando). */
export function registrarEvento(evento: Evento, armazenamento: Armazenamento = localStorage): boolean {
  try {
    const atual = lerEventos(armazenamento);
    const novo = anexar(atual, evento);
    if (novo !== atual) armazenamento.setItem(CHAVE, JSON.stringify({ versao: VERSAO, eventos: novo }));
    return true;
  } catch {
    return false;
  }
}

export function registrarConclusao(aulaId: string, quando = new Date(), armazenamento?: Armazenamento) {
  return registrarEvento(
    {
      id: `aula_concluida:${aulaId}:${quando.getTime()}`,
      tipo: 'aula_concluida',
      quando: quando.toISOString(),
      aulaId,
      conceitoIds: [],
    },
    armazenamento
  );
}

/** Desmarcar uma aula anula as conclusões vigentes dela; o histórico não é apagado. */
export function desfazerConclusao(aulaId: string, quando = new Date(), armazenamento?: Armazenamento) {
  for (const e of vigentes(lerEventos(armazenamento))) {
    if (e.tipo !== 'aula_concluida' || e.aulaId !== aulaId) continue;
    registrarEvento(
      { id: `correcao:${e.id}`, tipo: 'correcao', quando: quando.toISOString(), aulaId, conceitoIds: [], corrige: e.id },
      armazenamento
    );
  }
}

export function registrarQuestao(
  dados: { aulaId: string; numero: number; acertou: boolean; conceitoIds: string[] },
  quando = new Date(),
  armazenamento?: Armazenamento
) {
  const questaoId = `${dados.aulaId}#q${dados.numero}`;
  return registrarEvento(
    {
      id: `questao_respondida:${questaoId}:${quando.getTime()}`,
      tipo: 'questao_respondida',
      quando: quando.toISOString(),
      aulaId: dados.aulaId,
      questaoId,
      conceitoIds: dados.conceitoIds,
      resultado: dados.acertou ? 'acertou' : 'errou',
    },
    armazenamento
  );
}

export function registrarRevisao(
  dados: { cartaoId: string; aulaId: string; conceito: string; resultado: 'lembrei' | 'dificil' | 'nao_lembrei' },
  quando = new Date(),
  armazenamento?: Armazenamento
) {
  return registrarEvento(
    {
      id: `cartao_revisado:${dados.cartaoId}:${quando.getTime()}`,
      tipo: 'cartao_revisado',
      quando: quando.toISOString(),
      aulaId: dados.aulaId,
      cartaoId: dados.cartaoId,
      conceitoIds: [dados.conceito],
      resultado: dados.resultado,
    },
    armazenamento
  );
}

/** Converte o progresso antigo (`cdt:progresso`: id → instante) em eventos. Os ids são fixos, então repetir não duplica. */
export function importarLegado(armazenamento: Armazenamento = localStorage) {
  let antigo: Record<string, number>;
  try {
    antigo = JSON.parse(armazenamento.getItem(CHAVE_PROGRESSO_LEGADA) ?? '{}');
  } catch {
    return;
  }
  for (const [aulaId, instante] of Object.entries(antigo)) {
    if (Number.isFinite(instante)) registrarConclusao(aulaId, new Date(instante), armazenamento);
  }
}

const CHAVE_DISPENSADAS = 'cdt:v2:dispensadas';

export function recomendacaoDispensada(aulaRecomendada: string, armazenamento: Armazenamento = localStorage): boolean {
  try {
    return JSON.parse(armazenamento.getItem(CHAVE_DISPENSADAS) ?? '[]').includes(aulaRecomendada);
  } catch {
    return false;
  }
}

export function dispensarRecomendacao(aulaRecomendada: string, armazenamento: Armazenamento = localStorage) {
  try {
    const lista: string[] = JSON.parse(armazenamento.getItem(CHAVE_DISPENSADAS) ?? '[]');
    if (!lista.includes(aulaRecomendada)) armazenamento.setItem(CHAVE_DISPENSADAS, JSON.stringify([...lista, aulaRecomendada]));
  } catch {
    /* sem armazenamento: a recomendação volta na próxima visita */
  }
}

const CHAVE_PERFIL = 'cdt:v2:perfil';

export function lerPerfil(armazenamento: Armazenamento = localStorage): Perfil {
  try {
    return normalizarPerfil(JSON.parse(armazenamento.getItem(CHAVE_PERFIL) ?? 'null'));
  } catch {
    return PERFIL_PADRAO;
  }
}

export function gravarPerfil(perfil: Perfil, armazenamento: Armazenamento = localStorage): boolean {
  try {
    armazenamento.setItem(CHAVE_PERFIL, JSON.stringify(normalizarPerfil(perfil)));
    return true;
  } catch {
    return false;
  }
}

/** Estudo fora do site: vira uma sessão manual. Minutos entre 1 e 600. */
export function registrarEstudoExterno(
  dados: { minutos: number; assunto?: string; objetivo?: string },
  quando = new Date(),
  armazenamento?: Armazenamento
) {
  const minutos = Math.round(dados.minutos);
  if (!Number.isFinite(minutos) || minutos < 1 || minutos > 600) return false;
  return registrarEvento(
    {
      id: `estudo_externo:${quando.getTime()}`,
      tipo: 'estudo_externo',
      quando: quando.toISOString(),
      conceitoIds: [],
      minutos,
      assunto: dados.assunto?.trim().slice(0, 80) || undefined,
      objetivo: dados.objetivo?.trim().slice(0, 160) || undefined,
    },
    armazenamento
  );
}

/** Corrige a duração e/ou o objetivo de uma sessão. Só mexe nas métricas de tempo. */
export function editarSessao(
  sessaoId: string,
  dados: { minutos?: number; objetivo?: string },
  quando = new Date(),
  armazenamento?: Armazenamento
) {
  const minutos = dados.minutos === undefined ? undefined : Math.round(dados.minutos);
  if (minutos !== undefined && (!Number.isFinite(minutos) || minutos < 0 || minutos > 600)) return false;
  return registrarEvento(
    {
      id: `sessao_editada:${sessaoId}:${quando.getTime()}`,
      tipo: 'sessao_editada',
      quando: quando.toISOString(),
      conceitoIds: [],
      sessaoId,
      minutos,
      objetivo: dados.objetivo?.trim().slice(0, 160),
    },
    armazenamento
  );
}

/**
 * Exclui a sessão do histórico e do tempo. Respostas e conclusões ficam, salvo se o estudante
 * pedir (`ignorarEvidencias`): aí cada evento dela é anulado. No estudo fora do site, o registro
 * é a própria sessão e é anulado.
 */
export function excluirSessao(
  sessao: Sessao,
  opcoes: { ignorarEvidencias?: boolean } = {},
  quando = new Date(),
  armazenamento?: Armazenamento
) {
  const registrar = (e: Evento) => registrarEvento(e, armazenamento);
  const correcao = (alvo: string): Evento => ({
    id: `correcao:${alvo}`, tipo: 'correcao', quando: quando.toISOString(), conceitoIds: [], corrige: alvo,
  });
  if (sessao.origem === 'manual') return registrar(correcao(sessao.id));
  let ok = registrar({
    id: `sessao_excluida:${sessao.id}`, tipo: 'sessao_excluida', quando: quando.toISOString(), conceitoIds: [], sessaoId: sessao.id,
  });
  if (opcoes.ignorarEvidencias) for (const e of sessao.eventos) ok = registrar(correcao(e.id)) && ok;
  return ok;
}
