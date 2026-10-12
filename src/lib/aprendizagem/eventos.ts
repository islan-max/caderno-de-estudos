/** Registro imutável do que o estudante fez. Totais e estados são sempre recalculados daqui. */
export interface Evento {
  id: string;
  tipo: 'questao_respondida' | 'aula_concluida' | 'correcao';
  /** ISO em UTC. */
  quando: string;
  aulaId?: string;
  /** `<aulaId>#q<n>`; obrigatório em questao_respondida. */
  questaoId?: string;
  conceitoIds: string[];
  resultado?: 'acertou' | 'errou';
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
export function diaLocal(evento: Evento): string {
  const d = new Date(evento.quando);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
