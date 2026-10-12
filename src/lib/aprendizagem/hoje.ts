import { preRequisitosPendentes } from './jornada.ts';

export interface AulaDoPlano {
  id: string;
  /** Título. */
  t: string;
  href: string;
  /** "enem/<matéria>". */
  s: string;
  /** Pré-requisitos (ids de aula). */
  p?: string[];
}

export interface Acao {
  tipo: 'revisao' | 'rever-aula' | 'aula' | 'cartoes-novos';
  titulo: string;
  /** Sempre em texto: por que esta sugestão aparece. */
  motivo: string;
  rotulo: string;
  href: string;
  /** No máximo uma ação longa (aula) por dia. */
  longa: boolean;
  /** Outras aulas possíveis, para o botão "Trocar". */
  alternativas?: Acao[];
}

export interface EntradaDoPlano {
  /** Só aulas que existem. */
  aulas: AulaDoPlano[];
  concluidas: Set<string>;
  ultimaId?: string;
  /** Slugs de matérias do ENEM. */
  prioridades: string[];
  /** Cartões já revisados que chegaram à data. */
  vencidos: number;
  /** Cartões nunca vistos. */
  novos: number;
  hrefRevisao: string;
  /** Aulas concluídas com "precisa revisar" (erro recente). */
  aulasParaRever: string[];
}

const MAXIMO_DE_ACOES = 3;

function acaoDeAula(aula: AulaDoPlano, motivo: string, rotulo: string): Acao {
  return { tipo: 'aula', titulo: aula.t, motivo, rotulo, href: aula.href, longa: true };
}

/**
 * Plano do dia: até três ações, em ordem fixa e sem agenda.
 * 1. Revisão vencida. 2. Aula com erro recente. 3. Uma aula (a começada, senão a próxima da matéria
 * prioritária que não dependa de aula pendente, senão a próxima da ordem). 4. Cartões novos, se sobrar lugar.
 */
export function planoDeHoje(e: EntradaDoPlano): Acao[] {
  const titulos = new Map(e.aulas.map((a) => [a.id, a.t]));
  const porId = new Map(e.aulas.map((a) => [a.id, a]));
  const acoes: Acao[] = [];

  if (e.vencidos > 0) {
    acoes.push({
      tipo: 'revisao',
      titulo: e.vencidos === 1 ? 'Revisar 1 cartão' : `Revisar ${e.vencidos} cartões`,
      motivo: 'Chegou a data de rever o que você já viu. Revisar no dia certo ajuda a fixar.',
      rotulo: 'Revisar agora',
      href: e.hrefRevisao,
      longa: false,
    });
  }

  const iniciada = e.ultimaId && !e.concluidas.has(e.ultimaId) ? porId.get(e.ultimaId) : undefined;
  const rever = e.aulasParaRever.map((id) => porId.get(id)).find(Boolean);
  // Se a aula a rever é a mesma que está em andamento, vira uma ação só (abaixo).
  const reverEIniciada = Boolean(rever && iniciada && rever.id === iniciada.id);
  if (rever && !reverEIniciada) {
    acoes.push({
      tipo: 'rever-aula',
      titulo: rever.t,
      motivo: 'Você errou algo desta aula recentemente. Rever a seção indicada na correção costuma resolver.',
      rotulo: 'Rever aula',
      href: rever.href,
      longa: false,
    });
  }

  const comAviso = (a: AulaDoPlano, motivo: string) => {
    const faltam = preRequisitosPendentes(a.p, e.concluidas).map((id) => titulos.get(id)).filter(Boolean);
    return faltam.length ? `${motivo} Ela pressupõe ${faltam.join(' e ')}; se travar, comece por lá.` : motivo;
  };

  if (iniciada) {
    acoes.push(
      acaoDeAula(
        iniciada,
        reverEIniciada
          ? 'Você já começou esta aula e errou algo nela. Rever a seção indicada na correção costuma resolver.'
          : 'Você já começou esta aula. Retomar costuma exigir menos esforço do que recomeçar em outro assunto.',
        'Continuar aula'
      )
    );
  } else {
    const pendentes = e.aulas.filter((a) => a.id.startsWith('enem/') && !e.concluidas.has(a.id));
    const prioritaria = (a: AulaDoPlano) => e.prioridades.some((m) => a.s === `enem/${m}`);
    const livre = (a: AulaDoPlano) => preRequisitosPendentes(a.p, e.concluidas).length === 0;
    // Prioridade declarada primeiro; dentro dela, quem não depende de aula pendente; ordem do mapa em empate.
    const ordenadas = [...pendentes].sort(
      (a, b) => Number(prioritaria(b)) - Number(prioritaria(a)) || Number(livre(b)) - Number(livre(a))
    );
    const candidatas = ordenadas.slice(0, 3).map((a) =>
      acaoDeAula(
        a,
        comAviso(a, prioritaria(a) ? 'Próxima aula de uma matéria que você marcou como prioridade.' : 'Próxima aula na ordem de aprendizado do ENEM.'),
        'Começar aula'
      )
    );
    if (candidatas.length) acoes.push({ ...candidatas[0], alternativas: candidatas });
  }

  if (acoes.length < MAXIMO_DE_ACOES && e.vencidos === 0 && e.novos > 0) {
    acoes.push({
      tipo: 'cartoes-novos',
      titulo: 'Cartões de revisão',
      motivo: 'Há cartões que você ainda não viu. Responder de memória ajuda a lembrar depois.',
      rotulo: 'Ver cartões',
      href: e.hrefRevisao,
      longa: false,
    });
  }

  return acoes.slice(0, MAXIMO_DE_ACOES);
}
