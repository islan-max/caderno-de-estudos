/* ---------------------------------------------------------------------------
 * Regras do ciclo de estudo: errar, rever, revisar com intervalos e escolher o que fazer hoje.
 *
 * Só funções puras: sem DOM, sem localStorage, sem imports. Tudo o que a interface mostra é
 * CALCULADO do registro de eventos (nada de total guardado), então apagar um evento corrige
 * todos os números sem deixar nada inconsistente. Testes em estudo.test.ts.
 * ------------------------------------------------------------------------- */

/** Um fato do estudo. Só se acrescenta; apagar é filtrar pelo id. */
export type Evento =
  | {
      id: string;
      t: number;
      k: 'q';
      /** Id da aula: "enem/matematica-basica/fracoes". */
      a: string;
      /** Número da questão na aula, a partir de 0. */
      n: number;
      /** Seção da aula que o gabarito manda rever ("3. Comparando e ordenando frações"). */
      s?: string;
      ok: boolean;
    }
  | {
      id: string;
      t: number;
      k: 'c';
      /** Id do cartão: "<aula>#<posição>". */
      c: string;
      /** Como foi lembrar: 0 não lembrei, 1 com dificuldade, 2 lembrei. */
      r: 0 | 1 | 2;
      /** A correção (ou a própria pessoa) marcou a aula para rever: entra em "Rever" como uma questão errada. */
      rv?: true;
      /** Seção da aula a rever (o título do cartão). */
      s?: string;
      /** O que a correção disse, só para o histórico. */
      v?: 'certo' | 'parcial' | 'errado';
    }
  | { id: string; t: number; k: 'x'; m: string; tx?: string; min?: number };

export interface Registro {
  v: 1;
  eventos: Evento[];
}

/* ------------------------------------------------------------------ datas */

/** Dia no fuso do aparelho ("2026-10-12"): é o dia que a pessoa sente, não o do servidor. */
export function diaLocal(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + n).getTime());
}

/* --------------------------------------------------------- leitura segura */

function validarEvento(e: any): Evento | null {
  if (!e || typeof e.id !== 'string' || !e.id || !Number.isFinite(e.t)) return null;
  if (e.k === 'q' && typeof e.a === 'string' && Number.isInteger(e.n) && e.n >= 0 && typeof e.ok === 'boolean') {
    const base = { id: e.id, t: e.t, k: 'q' as const, a: e.a, n: e.n, ok: e.ok };
    return typeof e.s === 'string' && e.s ? { ...base, s: e.s.slice(0, 160) } : base;
  }
  if (e.k === 'c' && typeof e.c === 'string' && (e.r === 0 || e.r === 1 || e.r === 2)) {
    const base = { id: e.id, t: e.t, k: 'c' as const, c: e.c, r: e.r as 0 | 1 | 2 };
    const rv = e.rv === true ? { rv: true as const } : {};
    const s = typeof e.s === 'string' && e.s ? { s: e.s.slice(0, 160) } : {};
    const v = e.v === 'certo' || e.v === 'parcial' || e.v === 'errado' ? { v: e.v as 'certo' | 'parcial' | 'errado' } : {};
    return { ...base, ...rv, ...s, ...v };
  }
  if (e.k === 'x' && typeof e.m === 'string' && e.m) {
    const base = { id: e.id, t: e.t, k: 'x' as const, m: e.m.slice(0, 80) };
    const tx = typeof e.tx === 'string' && e.tx ? { tx: e.tx.slice(0, 200) } : {};
    const min = Number.isFinite(e.min) && e.min > 0 && e.min <= 1440 ? { min: Math.round(e.min) } : {};
    return { ...base, ...tx, ...min };
  }
  return null;
}

/** Aceita qualquer coisa vinda do armazenamento ou de um arquivo importado e devolve só o que presta. */
export function normalizarRegistro(bruto: unknown): Registro {
  const lista = (bruto as { eventos?: unknown } | null)?.eventos;
  const eventos: Evento[] = [];
  if (Array.isArray(lista)) {
    for (const e of lista) {
      const v = validarEvento(e);
      if (v) eventos.push(v);
    }
  }
  return { v: 1, eventos };
}

/** Une dois registros sem duplicar (mesmo id = mesmo evento). */
export function mesclarRegistros(a: Registro, b: Registro): Registro {
  const porId = new Map<string, Evento>();
  for (const e of [...a.eventos, ...b.eventos]) if (!porId.has(e.id)) porId.set(e.id, e);
  return { v: 1, eventos: [...porId.values()].sort((x, y) => x.t - y.t) };
}

export function semEvento(reg: Registro, id: string): Registro {
  return { v: 1, eventos: reg.eventos.filter((e) => e.id !== id) };
}

/* ------------------------------------------------- erros e seções a rever */

/** O gabarito termina com "Revisar: Aula Teórica › N. Nome da seção". Separa o texto da seção. */
export function parseRevisar(porque: string): { texto: string; secao: string | null } {
  const m = porque.match(/\s*Revisar:\s*Aula Teórica\s*›\s*(.+?)\.?\s*$/);
  if (!m) return { texto: porque.trim(), secao: null };
  return { texto: porque.slice(0, m.index).trim(), secao: m[1].trim() };
}

export type EstadoSecao = 'rever' | 'acertou' | 'firme';

export interface SecaoEstado {
  /** Chave estável: o nome da seção, ou "#q3" quando a questão não aponta seção. */
  chave: string;
  secao: string | null;
  /** Texto para mostrar: o nome da seção ou "Questão 3". */
  rotulo: string;
  estado: EstadoSecao;
  /** Números das questões (a partir de 0) que caem nesta seção. */
  questoes: number[];
  /** Quando foi a última resposta (ms). */
  t: number;
  /** Em "rever": a partir de quando um acerto passa a valer (ms). */
  desde: number | null;
  /** Em "rever": errou, ou acertou cedo demais depois do erro. */
  motivo: 'errou' | 'cedo' | null;
}

interface Tentativa {
  t: number;
  ok: boolean;
}

/**
 * Acertar logo depois de ver a explicação mede a memória da resposta, não o que se aprendeu.
 * Por isso um erro só sai de "Rever" quando o acerto vem pelo menos este tempo depois dele.
 */
export const INTERVALO_REVER_MS = 30 * 60 * 1000;

function tentativasDaAula(eventos: Evento[], aula: string) {
  const porQuestao = new Map<number, { tentativas: Tentativa[]; secao: string | null; t: number }>();
  const lista = eventos.filter((e): e is Extract<Evento, { k: 'q' }> => e.k === 'q' && e.a === aula).sort((x, y) => x.t - y.t);
  for (const e of lista) {
    const atual = porQuestao.get(e.n) ?? { tentativas: [], secao: null, t: 0 };
    atual.tentativas.push({ t: e.t, ok: e.ok });
    if (e.s) atual.secao = e.s;
    atual.t = e.t;
    porQuestao.set(e.n, atual);
  }
  return porQuestao;
}

export interface Avaliacao {
  estado: EstadoSecao;
  /** Em "rever": a partir de quando um acerto passa a valer (o último erro + o intervalo). */
  desde: number | null;
  /** Em "rever": a última resposta foi errada, ou foi certa mas cedo demais. */
  motivo: 'errou' | 'cedo' | null;
}

/**
 * rever: a última resposta foi errada, ou foi certa mas veio logo depois do erro.
 * firme: depois do último erro, acertou em 2 dias diferentes (cada acerto já fora do intervalo).
 * acertou: o resto.
 */
export function avaliarTentativas(ts: Tentativa[]): Avaliacao {
  if (!ts.length) return { estado: 'rever', desde: null, motivo: 'errou' };
  let ultimoErro = -1;
  ts.forEach((x, i) => {
    if (!x.ok) ultimoErro = i;
  });
  const desde = ultimoErro >= 0 ? ts[ultimoErro].t + INTERVALO_REVER_MS : null;
  const ultima = ts[ts.length - 1];
  if (!ultima.ok) return { estado: 'rever', desde, motivo: 'errou' };
  if (desde !== null && ultima.t < desde) return { estado: 'rever', desde, motivo: 'cedo' };
  const dias = new Set(ts.slice(ultimoErro + 1).filter((x) => desde === null || x.t >= desde).map((x) => diaLocal(x.t)));
  return { estado: dias.size >= 2 ? 'firme' : 'acertou', desde: null, motivo: null };
}

/** Compatível com o uso anterior: só o estado. */
export function estadoDeTentativas(ts: Tentativa[]): EstadoSecao {
  return avaliarTentativas(ts).estado;
}

/** Cartões que a correção (ou a pessoa) marcou para rever: cada resposta vira uma tentativa (acertou = lembrei sem marca). */
function cartoesMarcados(eventos: Evento[], aula: string) {
  const porCartao = new Map<string, { tentativas: Tentativa[]; secao: string | null; t: number; marcado: boolean }>();
  const lista = eventos.filter((e): e is Extract<Evento, { k: 'c' }> => e.k === 'c' && e.c.startsWith(aula + '#')).sort((x, y) => x.t - y.t);
  for (const e of lista) {
    const atual = porCartao.get(e.c) ?? { tentativas: [], secao: null, t: 0, marcado: false };
    atual.tentativas.push({ t: e.t, ok: !e.rv && e.r === 2 });
    if (e.rv) atual.marcado = true;
    if (e.s) atual.secao = e.s;
    atual.t = e.t;
    porCartao.set(e.c, atual);
  }
  return [...porCartao.entries()].filter(([, c]) => c.marcado);
}

export function secoesDaAula(eventos: Evento[], aula: string): SecaoEstado[] {
  const grupos = new Map<string, SecaoEstado & { avaliacoes: Avaliacao[] }>();
  const grupo = (chave: string, secao: string | null, rotulo: string) => {
    const g = grupos.get(chave) ?? {
      chave,
      secao,
      rotulo,
      estado: 'firme' as EstadoSecao,
      questoes: [],
      t: 0,
      desde: null,
      motivo: null,
      avaliacoes: [],
    };
    grupos.set(chave, g);
    return g;
  };
  for (const [n, q] of tentativasDaAula(eventos, aula)) {
    const g = grupo(q.secao ?? `#q${n}`, q.secao, q.secao ?? `Questão ${n + 1}`);
    g.questoes.push(n);
    g.avaliacoes.push(avaliarTentativas(q.tentativas));
    g.t = Math.max(g.t, q.t);
  }
  for (const [id, c] of cartoesMarcados(eventos, aula)) {
    const g = grupo(c.secao ?? `#c${id}`, c.secao, c.secao ?? `Tópico ${id.split('#')[1]}`);
    g.avaliacoes.push(avaliarTentativas(c.tentativas));
    g.t = Math.max(g.t, c.t);
  }
  return [...grupos.values()].map(({ avaliacoes, ...g }) => {
    const rever = avaliacoes.filter((x) => x.estado === 'rever');
    if (rever.length) {
      const desde = rever.reduce<number | null>((m, x) => (x.desde === null ? m : Math.max(m ?? 0, x.desde)), null);
      return { ...g, estado: 'rever' as const, desde, motivo: rever.some((x) => x.motivo === 'errou') ? ('errou' as const) : ('cedo' as const) };
    }
    return { ...g, estado: avaliacoes.every((x) => x.estado === 'firme') ? ('firme' as const) : ('acertou' as const) };
  });
}

export type EstadoAula = 'nao-iniciada' | 'andamento' | 'concluida' | 'rever';

export interface AndamentoBruto {
  l: number;
  q: number;
  z: number;
}

/** Um cálculo só para a trilha, o aviso da aula e o Meu estudo. */
export function estadoDaAula(p: {
  eventos: Evento[];
  aula: string;
  vista: boolean;
  andamento?: AndamentoBruto;
}): { estado: EstadoAula; rever: SecaoEstado[] } {
  const rever = secoesDaAula(p.eventos, p.aula)
    .filter((s) => s.estado === 'rever')
    .sort((x, y) => y.t - x.t);
  if (rever.length) return { estado: 'rever', rever };
  if (p.vista) return { estado: 'concluida', rever };
  const a = p.andamento;
  return { estado: a && (a.l > 0 || a.q) ? 'andamento' : 'nao-iniciada', rever };
}

/* ------------------------------------------------------------- cartões */

/** Dias até a próxima revisão em cada caixa (a caixa 0 é "nunca revisado"). */
export const INTERVALOS = [0, 1, 3, 7, 14, 30, 60];
const CAIXA_MAX = INTERVALOS.length - 1;

export type RespostaCartao = 0 | 1 | 2;

/** Caixa depois de uma resposta. Não lembrei volta à 1; com dificuldade fica; lembrei sobe. */
export function proximaCaixa(caixa: number, r: RespostaCartao): number {
  if (r === 0) return 1;
  if (r === 1) return Math.max(1, caixa);
  return caixa === 0 ? 2 : Math.min(CAIXA_MAX, caixa + 1);
}

export interface EstadoCartao {
  caixa: number;
  /** Dia da última revisão, ou null se nunca foi revisado. */
  ultimo: string | null;
}

/** Duas revisões no mesmo dia valem uma só: a última. */
export function estadoDoCartao(revisoes: { t: number; r: RespostaCartao }[]): EstadoCartao {
  const porDia = new Map<string, { t: number; r: RespostaCartao }>();
  for (const x of [...revisoes].sort((a, b) => a.t - b.t)) porDia.set(diaLocal(x.t), x);
  let caixa = 0;
  let ultimo: string | null = null;
  for (const [dia, x] of [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    caixa = proximaCaixa(caixa, x.r);
    ultimo = dia;
  }
  return { caixa, ultimo };
}

export interface Cartao {
  /** "enem/matematica-basica/fracoes#3": a aula e a posição do tópico (a partir de 1). */
  id: string;
  aula: string;
  n: number;
  /** Dia em que entra (ou entrou) na fila. */
  vence: string;
  caixa: number;
}

export interface Fila {
  /** Tudo o que já chegou ao dia de revisão. */
  vencidos: Cartao[];
  /** O que cabe na sessão de hoje (limite diário), os mais atrasados primeiro. */
  hoje: Cartao[];
  /** Quando volta a haver cartão, se nada está vencido. */
  proxima: string | null;
}

/**
 * Os cartões de uma aula entram na fila no dia seguinte a concluí-la. Depois seguem os
 * intervalos por caixa. Errar uma questão da aula antecipa os cartões dela para o dia seguinte.
 */
export function montarFila(p: {
  eventos: Evento[];
  /** Aula concluída → quando (ms). */
  conclusoes: Record<string, number>;
  /** Aula → quantos tópicos (cartões) ela tem. */
  cartoes: Record<string, number>;
  hoje: string;
  limite: number;
}): Fila {
  const revisoes = new Map<string, { t: number; r: RespostaCartao }[]>();
  const erroPorAula = new Map<string, string>();
  for (const e of p.eventos) {
    if (e.k === 'c') {
      const l = revisoes.get(e.c) ?? [];
      l.push({ t: e.t, r: e.r });
      revisoes.set(e.c, l);
    } else if (e.k === 'q' && !e.ok) {
      const d = diaLocal(e.t);
      if (d > (erroPorAula.get(e.a) ?? '')) erroPorAula.set(e.a, d);
    }
  }

  const vencidos: Cartao[] = [];
  let proxima: string | null = null;
  for (const [aula, quando] of Object.entries(p.conclusoes)) {
    const total = p.cartoes[aula] ?? 0;
    for (let n = 1; n <= total; n++) {
      const id = `${aula}#${n}`;
      const { caixa, ultimo } = estadoDoCartao(revisoes.get(id) ?? []);
      let vence = ultimo ? somarDias(ultimo, INTERVALOS[caixa]) : somarDias(diaLocal(quando), 1);
      const erro = erroPorAula.get(aula);
      if (erro && erro > (ultimo ?? '')) {
        const antecipado = somarDias(erro, 1);
        if (antecipado < vence) vence = antecipado;
      }
      if (vence <= p.hoje) vencidos.push({ id, aula, n, vence, caixa });
      else if (!proxima || vence < proxima) proxima = vence;
    }
  }
  vencidos.sort((a, b) => a.vence.localeCompare(b.vence) || a.id.localeCompare(b.id, 'pt-BR', { numeric: true }));
  return { vencidos, hoje: vencidos.slice(0, Math.max(0, p.limite)), proxima: vencidos.length ? null : proxima };
}

export const LIMITES_FILA = { curta: 10, media: 20, longa: 40 } as const;
export type TamanhoFila = keyof typeof LIMITES_FILA;
/** Cartões por dia na revisão: a pessoa escolhe livremente entre estes limites. */
export const FILA_MIN = 1;
export const FILA_MAX = 200;

/** Quantas matérias podem ficar em foco em cada categoria; cada categoria conta à parte. */
export const LIMITE_FOCO: Record<string, number> = { enem: 3, escolar: 1, ds: 2 };

/** Mantém só as matérias em foco que cabem no limite da categoria de cada uma ("enem/fisica" → "enem"). */
export function limparFoco(foco: string[]): string[] {
  const usadas: Record<string, number> = {};
  return [...new Set(foco)].filter((s) => {
    const aba = s.split('/')[0];
    const limite = LIMITE_FOCO[aba];
    if (!limite || (usadas[aba] ?? 0) >= limite) return false;
    usadas[aba] = (usadas[aba] ?? 0) + 1;
    return true;
  });
}

/* ------------------------------------------------------------------- Hoje */

export interface AulaIdx {
  id: string;
  /** Título. */
  t: string;
  /** Nome da matéria. */
  m: string;
  /** "enem/fisica": a aba e a matéria. */
  s: string;
  h: string;
}

export interface Sugestao {
  /** Estável: serve para dispensar ("revisao", "rever:<aula>", "aula:<aula>"). */
  id: string;
  tipo: 'revisao' | 'rever' | 'continuar' | 'proxima' | 'comecar';
  titulo: string;
  motivo: string;
  href: string;
  acao: string;
}

const JANELA_USO = 14 * 24 * 3600 * 1000;

/** Matéria mais estudada nos últimos 14 dias; com foco definido, só entre as do foco. */
function materiaEmUso(p: {
  eventos: Evento[];
  aulas: AulaIdx[];
  vistas: Record<string, number>;
  andamentos: Record<string, { t?: number }>;
  foco: string[];
  agora: number;
}): string | null {
  const materiaDe = new Map(p.aulas.map((a) => [a.id, a.s]));
  const desde = p.agora - JANELA_USO;
  const uso = new Map<string, number>();
  const conta = (aula: string, t: number) => {
    const s = materiaDe.get(aula);
    if (s && t >= desde) uso.set(s, (uso.get(s) ?? 0) + 1);
  };
  for (const e of p.eventos) {
    if (e.k === 'q') conta(e.a, e.t);
    else if (e.k === 'c') conta(e.c.split('#')[0], e.t);
  }
  for (const [id, t] of Object.entries(p.vistas)) conta(id, t);
  for (const [id, a] of Object.entries(p.andamentos)) if (a.t) conta(id, a.t);

  const candidatas = p.foco.length ? p.foco : [...uso.keys()];
  const melhor = candidatas
    .filter((s) => p.aulas.some((a) => a.s === s))
    .sort((a, b) => (uso.get(b) ?? 0) - (uso.get(a) ?? 0))[0];
  return melhor ?? null;
}

/**
 * No máximo três ações, nesta ordem: revisão de cartões, seção a rever, UMA ação longa (aula
 * começada ou a próxima da trilha). Cada ação traz o motivo. Nada é guardado como plano: a
 * lista é recalculada a cada visita, então não existe plano atrasado para reorganizar.
 */
export function sugestoesDeHoje(p: {
  eventos: Evento[];
  aulas: AulaIdx[];
  vistas: Record<string, number>;
  andamentos: Record<string, AndamentoBruto & { t?: number }>;
  fila: Fila;
  dispensados: string[];
  foco: string[];
  agora: number;
  hrefRevisao: string;
}): Sugestao[] {
  const saida: Sugestao[] = [];
  const livre = (id: string) => !p.dispensados.includes(id);

  const n = p.fila.hoje.length;
  if (n > 0 && livre('revisao')) {
    const aulasComCartao = new Set(p.fila.vencidos.map((c) => c.aula)).size;
    const minutos = Math.max(1, Math.round(n / 2));
    saida.push({
      id: 'revisao',
      tipo: 'revisao',
      titulo: n === 1 ? 'Revisar 1 cartão' : `Revisar ${n} cartões`,
      motivo:
        `${p.fila.vencidos.length === 1 ? 'Um tópico' : `${p.fila.vencidos.length} tópicos`} de ` +
        `${aulasComCartao === 1 ? 'uma aula que você concluiu chegou' : `${aulasComCartao} aulas que você concluiu chegaram`} ` +
        `ao dia de revisão. Cerca de ${minutos} min.`,
      href: p.hrefRevisao,
      acao: 'Revisar',
    });
  }

  const porId = new Map(p.aulas.map((a) => [a.id, a]));
  const comErro = p.aulas
    .map((a) => ({ a, r: estadoDaAula({ eventos: p.eventos, aula: a.id, vista: Boolean(p.vistas[a.id]) }).rever }))
    .filter((x) => x.r.length && livre(`rever:${x.a.id}`))
    .sort((x, y) => y.r[0].t - x.r[0].t)[0];
  if (comErro) {
    const alvo = comErro.r[0];
    saida.push({
      id: `rever:${comErro.a.id}`,
      tipo: 'rever',
      titulo: `Rever: ${alvo.rotulo}`,
      motivo: `Você errou uma questão sobre isso em “${comErro.a.t}” e ainda não acertou de novo em outro dia.`,
      href: comErro.a.h,
      acao: 'Rever',
    });
  }

  // Ação longa: primeiro a aula começada e não terminada, a mais recente.
  const comecada = Object.entries(p.andamentos)
    .filter(([id, a]) => porId.has(id) && !p.vistas[id] && (a.l > 0 || a.q) && livre(`aula:${id}`))
    .sort((x, y) => (y[1].t ?? 0) - (x[1].t ?? 0))[0];
  if (comecada) {
    const a = porId.get(comecada[0])!;
    saida.push({
      id: `aula:${a.id}`,
      tipo: 'continuar',
      titulo: a.t,
      motivo: `Você começou esta aula de ${a.m} e ainda não terminou.`,
      href: a.h,
      acao: 'Continuar',
    });
  } else {
    const s = materiaEmUso(p);
    const doMateria = s ? p.aulas.filter((a) => a.s === s) : p.aulas;
    const feitas = doMateria.map((a, i) => (p.vistas[a.id] ? i : -1));
    const depois = Math.max(...feitas, -1);
    const pendentes = doMateria.filter((a) => !p.vistas[a.id] && livre(`aula:${a.id}`));
    const proxima = pendentes.find((a) => doMateria.indexOf(a) > depois) ?? pendentes[0];
    if (proxima) {
      const anterior = depois >= 0 ? doMateria[depois] : null;
      const emFoco = s && p.foco.includes(s);
      saida.push({
        id: `aula:${proxima.id}`,
        tipo: s ? 'proxima' : 'comecar',
        titulo: proxima.t,
        motivo: !s
          ? 'Uma boa aula para começar. Daqui, o caderno aprende o que você estuda.'
          : anterior
            ? `Próxima da trilha de ${proxima.m}, depois de “${anterior.t}”.`
            : emFoco
              ? `Primeira aula de ${proxima.m}, matéria que você pôs em foco.`
              : `Primeira aula de ${proxima.m}, matéria que você tem usado.`,
        href: proxima.h,
        acao: 'Começar',
      });
    }
  }
  return saida.slice(0, 3);
}

/* ------------------------------------------- "Agora não" do bloco Hoje */

/** "Agora não" esconde a ação por uma hora; depois disso ela volta se ainda fizer sentido. */
export const DISPENSA_MS = 60 * 60 * 1000;

/** id → quando volta (ms). */
export type Dispensas = Record<string, number>;

/** Só o que ainda não venceu e está bem formado (o valor vem do armazenamento: não é de confiança). */
export function dispensasAtivas(bruto: unknown, agora: number): Dispensas {
  const saida: Dispensas = {};
  if (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) {
    for (const [id, ate] of Object.entries(bruto as Record<string, unknown>)) {
      if (typeof ate === 'number' && Number.isFinite(ate) && ate > agora) saida[id] = ate;
    }
  }
  return saida;
}

/** Quando a primeira ação dispensada volta (para redesenhar o bloco na hora certa). */
export function proximoRetorno(d: Dispensas): number | null {
  const tempos = Object.values(d);
  return tempos.length ? Math.min(...tempos) : null;
}

/* ------------------------------------------------------- dias de estudo */

/** Ações com significado por dia: aula concluída, questão corrigida, cartão revisto, estudo fora do site. */
export function acoesPorDia(eventos: Evento[], vistas: Record<string, number>): Map<string, number> {
  const dias = new Map<string, number>();
  const soma = (t: number) => dias.set(diaLocal(t), (dias.get(diaLocal(t)) ?? 0) + 1);
  for (const e of eventos) soma(e.t);
  for (const t of Object.values(vistas)) if (Number.isFinite(t)) soma(t);
  return dias;
}

/** 0 = sem ação. Os degraus são fixos para a cor não depender do melhor dia de cada pessoa. */
export function nivelDoDia(acoes: number): 0 | 1 | 2 | 3 | 4 {
  if (acoes <= 0) return 0;
  if (acoes === 1) return 1;
  if (acoes <= 4) return 2;
  if (acoes <= 9) return 3;
  return 4;
}

/* -------------------------------------------------- transparência (10) */

export interface ComoCalculamos {
  titulo: string;
  entra: string;
  calculo: string;
  naoMede: string;
  melhorar: string;
}

/** Toda métrica ou estado mostrado no site tem uma entrada aqui, com os quatro textos. */
export const COMO_CALCULAMOS = {
  rever: {
    titulo: 'Rever',
    entra: 'Suas respostas às questões da aula, uma por questão.',
    calculo:
      'A seção fica em “Rever” quando a sua última resposta a uma questão dela foi errada. Acertar logo depois do erro (menos de 30 minutos) não tira a seção de “Rever”: nesse caso o caderno diz a partir de que horas um acerto passa a valer.',
    naoMede: 'Se você entendeu o assunto. Acertar logo depois de ler a explicação mede só a memória da resposta.',
    melhorar: 'Releia a seção da aula e refaça a questão depois de um tempo. Um acerto fora do intervalo tira a seção de “Rever” na hora, e o aviso some.',
  },
  firme: {
    titulo: 'Firme',
    entra: 'Suas respostas às questões da aula, uma por questão.',
    calculo: 'A seção fica “Firme” quando, depois do último erro, você acertou em pelo menos dois dias diferentes (cada acerto já fora do intervalo de 30 minutos).',
    naoMede: 'Se você resolve uma questão nova sobre o assunto. Só diz que você acerta estas.',
    melhorar: 'Revise os cartões da aula e refaça as questões depois de alguns dias.',
  },
  dias: {
    titulo: 'Dias de estudo',
    entra: 'Aulas concluídas, questões corrigidas, cartões revistos e estudos fora do site que você registrou.',
    calculo: 'Cada quadrado é um dia. A cor depende de quantas ações houve: 1, de 2 a 4, de 5 a 9 e 10 ou mais.',
    naoMede: 'Tempo de estudo nem aprendizagem. Um dia sem quadrado é “sem registro”, não é falha.',
    melhorar: 'Não há meta. Pouco e com frequência costuma fixar mais do que muito de uma vez.',
  },
  materia: {
    titulo: 'Por matéria',
    entra: 'As aulas marcadas como vistas e as seções com resposta registrada.',
    calculo:
      'Aulas concluídas ÷ aulas publicadas da matéria (aula “Em breve” não conta). Seções firmes e seções a rever vêm das respostas às questões.',
    naoMede: 'Domínio da matéria. Concluir uma aula quer dizer que você a leu e respondeu as questões.',
    melhorar: 'Abra as seções a rever e revise os cartões das aulas concluídas.',
  },
  revisao: {
    titulo: 'Revisão',
    entra: 'Os cartões (tópicos-chave) das aulas concluídas e a sua resposta a cada um.',
    calculo:
      'O cartão volta em 1 dia se você não lembrou, no mesmo intervalo se teve dificuldade e em 3, 7, 14, 30 e 60 dias a cada “lembrei”. Errar uma questão da aula antecipa os cartões dela.',
    naoMede: 'Se você de fato lembra: a resposta é sua avaliação, o caderno não corrige.',
    melhorar: 'Responda com sinceridade. “Com dificuldade” é uma resposta útil.',
  },
} satisfies Record<string, ComoCalculamos>;
