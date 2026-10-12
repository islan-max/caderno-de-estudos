import { diaLocal, type Evento } from './eventos.ts';

/** Mais que isto sem nenhuma atividade começa uma nova sessão. */
export const LACUNA_DA_SESSAO_MIN = 30;
/** Quanto uma atividade conta, no máximo, até a seguinte. */
export const TETO_ENTRE_ATIVIDADES_MIN = 5;

export interface Sessao {
  /** Id do primeiro evento dela. */
  id: string;
  origem: 'automatica' | 'manual';
  inicio: string;
  fim: string;
  /** Dia local do início (AAAA-MM-DD). */
  dia: string;
  /** Eventos que a formaram (vazio no estudo fora do site). */
  eventos: Evento[];
  /** Tempo ativo estimado, ou o editado pelo estudante. */
  minutos: number;
  editada: boolean;
  objetivo?: string;
  assunto?: string;
}

const ATIVIDADES = ['questao_respondida', 'aula_concluida', 'cartao_revisado'];

/**
 * Sessões calculadas a partir dos eventos vigentes, nada guardado:
 * - automáticas: atividades agrupadas com menos de 30 min entre si;
 * - manuais: cada `estudo_externo` é uma sessão.
 * Excluídas somem; edições (duração, objetivo) valem pela mais recente.
 * shortcut: o id é o do primeiro evento; se esse evento for anulado depois, a sessão muda de id e
 * perde exclusões e edições antigas. Aceitável enquanto só o Max usa; fixar o id se isso incomodar.
 */
export function montarSessoes(vigentesDoEstudante: Evento[]): Sessao[] {
  const porInstante = (a: Evento, b: Evento) => a.quando.localeCompare(b.quando);
  const excluidas = new Set(vigentesDoEstudante.filter((e) => e.tipo === 'sessao_excluida').map((e) => e.sessaoId));
  const edicoes = new Map<string, Evento>();
  for (const e of vigentesDoEstudante.filter((e) => e.tipo === 'sessao_editada').sort(porInstante)) edicoes.set(e.sessaoId!, e);

  const sessoes: Sessao[] = [];
  const atividades = vigentesDoEstudante.filter((e) => ATIVIDADES.includes(e.tipo)).sort(porInstante);
  let grupo: Evento[] = [];
  const fechar = () => {
    if (!grupo.length) return;
    const instantes = grupo.map((e) => new Date(e.quando).getTime());
    let minutos = 0;
    instantes.forEach((t, i) => {
      const depois = instantes[i + 1];
      minutos += depois === undefined ? 1 : Math.min(TETO_ENTRE_ATIVIDADES_MIN, (depois - t) / 60000);
    });
    sessoes.push({
      id: grupo[0].id, origem: 'automatica', inicio: grupo[0].quando, fim: grupo[grupo.length - 1].quando,
      dia: diaLocal(grupo[0]), eventos: grupo, minutos: Math.round(minutos), editada: false,
    });
    grupo = [];
  };
  for (const e of atividades) {
    const anterior = grupo[grupo.length - 1];
    if (anterior && (new Date(e.quando).getTime() - new Date(anterior.quando).getTime()) / 60000 > LACUNA_DA_SESSAO_MIN) fechar();
    grupo.push(e);
  }
  fechar();

  for (const e of vigentesDoEstudante.filter((e) => e.tipo === 'estudo_externo')) {
    sessoes.push({
      id: e.id, origem: 'manual', inicio: e.quando, fim: e.quando, dia: diaLocal(e), eventos: [],
      minutos: e.minutos ?? 0, editada: false, objetivo: e.objetivo, assunto: e.assunto,
    });
  }

  return sessoes
    .filter((s) => !excluidas.has(s.id))
    .map((s) => {
      const ed = edicoes.get(s.id);
      if (!ed) return s;
      return { ...s, editada: ed.minutos !== undefined, minutos: ed.minutos ?? s.minutos, objetivo: ed.objetivo ?? s.objetivo };
    })
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
}

/** Minutos das sessões que começaram em `dias` (AAAA-MM-DD). */
export function minutosNosDias(sessoes: Sessao[], dias: Set<string>): number {
  return sessoes.filter((s) => dias.has(s.dia)).reduce((soma, s) => soma + s.minutos, 0);
}
