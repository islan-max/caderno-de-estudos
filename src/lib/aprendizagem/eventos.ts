/** Registro imutável do que o estudante fez. Totais e estados são sempre recalculados daqui. */
export interface Evento {
  id: string;
  tipo: 'questao_respondida' | 'aula_concluida' | 'cartao_revisado' | 'correcao';
  /** ISO em UTC. */
  quando: string;
  aulaId?: string;
  /** `<aulaId>#q<n>`; obrigatório em questao_respondida. */
  questaoId?: string;
  /** Só em cartao_revisado: `<aulaId>/<id do cartão>`. */
  cartaoId?: string;
  conceitoIds: string[];
  resultado?: 'acertou' | 'errou' | 'lembrei' | 'dificil' | 'nao_lembrei';
  /** Só em `correcao`: id do evento que ela anula. */
  corrige?: string;
}

/** Acrescenta o evento; um id já existente é ignorado, então repetir uma importação não duplica. */
export function anexar(lista: Evento[], evento: Evento): Evento[] {
  return lista.some((e) => e.id === evento.id) ? lista : [...lista, evento];
}

/** Eventos que valem: sem os anulados por uma correção e sem as próprias correções. */
export function vigentes(lista: Evento[]): Evento[] {
  const anulados = new Set(lista.filter((e) => e.tipo === 'correcao').map((e) => e.corrige));
  return lista.filter((e) => e.tipo !== 'correcao' && !anulados.has(e.id));
}

/** Dia local (AAAA-MM-DD) de um evento. */
export function diaDaData(d: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export function diaLocal(evento: Evento): string {
  return diaDaData(new Date(evento.quando));
}
