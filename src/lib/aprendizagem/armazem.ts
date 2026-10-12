import { anexar, vigentes, type Evento } from './eventos.ts';

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
