/* ---------------------------------------------------------------------------
 * Recomendador de aulas: regras puras, sem DOM e sem armazenamento.
 *
 * Entra o catálogo (as aulas do índice), as preferências da pessoa (matérias de interesse e 👍/👎
 * em aulas) e o que ela já concluiu. Sai uma lista de aulas com o motivo de cada uma. Não há
 * modelo treinado: cada aula tem "etiquetas" (matéria, grupo e os termos mais raros do título) e a
 * nota é a soma dos pesos das etiquetas que a pessoa demonstrou gostar. Tudo dá para conferir à mão.
 * ------------------------------------------------------------------------- */

export interface ItemRec {
  /** Id da aula no progresso: "enem/fisica/optica". */
  id: string;
  titulo: string;
  /** Matéria dentro da aba: "enem/fisica". */
  materia: string;
  materiaNome: string;
  /** Grupo do painel: a área do ENEM ou o nome da aba. */
  grupo: string;
  /** Cartões de revisão da aula; só serve de referência "popular" na avaliação. */
  cartoes?: number;
}

export interface Preferencias {
  /** Matérias escolhidas ("enem/fisica"). */
  interesses: string[];
  /** Aula → 1 (gostei) ou -1 (não quero algo assim). */
  feedback: Record<string, 1 | -1>;
}

export interface Recomendacao {
  item: ItemRec;
  pontos: number;
  /** Frases curtas, em ordem de importância: "Você escolheu Física". */
  porque: string[];
}

export interface ResultadoRec {
  itens: Recomendacao[];
  /** Sem interesse nem feedback não há o que recomendar: a interface pede para escolher matérias. */
  semPerfil: boolean;
}

export const INTERESSES_MAX = 12;
export const FEEDBACK_MAX = 500;
export const SUGESTOES_PADRAO = 8;

const ID_AULA = /^(enem|escolar|ds)\/[a-z0-9/_-]+$/;
const ID_MATERIA = /^(enem|escolar|ds)\/[a-z0-9_-]+$/;
const TERMOS_POR_AULA = 4;

/** Quanto cada tipo de etiqueta pesa. A matéria manda; os termos do título só desempatam. */
const PESO_MATERIA = 1;
const PESO_GRUPO = 0.5;
const PESO_TERMO = 0.5;
/** Cada 👍/👎 vale metade de um interesse declarado. */
const FORCA_FEEDBACK = 0.5;
/** "Parecida com…" só aparece quando a aula curtida divide pelo menos a matéria. */
const MINIMO_PARECIDA = 1;

const PALAVRAS_COMUNS = new Set(
  'a as o os um uma uns umas de da das do dos em na nas no nos para por com sem sob sobre entre ao aos ou e que se como mais menos seu sua seus suas ate'.split(' '),
);

/** Minúsculas e sem acento, para comparar termos. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function termosDoTitulo(titulo: string): string[] {
  const vistos = new Set<string>();
  for (const t of semAcento(titulo).split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !PALAVRAS_COMUNS.has(t) && !/^\d+$/.test(t)) vistos.add(t);
  }
  return [...vistos];
}

/** Aceita qualquer coisa vinda do armazenamento ou de um arquivo importado e devolve só o que presta. */
export function normalizarPreferencias(bruto: unknown): Preferencias {
  const prefs: Preferencias = { interesses: [], feedback: {} };
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return prefs;
  const { interesses, feedback } = bruto as { interesses?: unknown; feedback?: unknown };
  if (Array.isArray(interesses)) {
    for (const m of interesses) {
      if (prefs.interesses.length >= INTERESSES_MAX) break;
      if (typeof m === 'string' && ID_MATERIA.test(m) && !prefs.interesses.includes(m)) prefs.interesses.push(m);
    }
  }
  if (feedback && typeof feedback === 'object' && !Array.isArray(feedback)) {
    for (const [id, v] of Object.entries(feedback as Record<string, unknown>)) {
      if (Object.keys(prefs.feedback).length >= FEEDBACK_MAX) break;
      if (ID_AULA.test(id) && (v === 1 || v === -1)) prefs.feedback[id] = v;
    }
  }
  return prefs;
}

/** Soma o que veio de fora ao que já existe aqui; onde há conflito, vale o que já existe. */
export function mesclarPreferencias(aqui: Preferencias, externas: Preferencias): Preferencias {
  return normalizarPreferencias({
    interesses: [...aqui.interesses, ...externas.interesses],
    feedback: { ...externas.feedback, ...aqui.feedback },
  });
}

/** Marca ou desmarca: clicar de novo no mesmo botão tira o feedback. */
export function comFeedback(prefs: Preferencias, id: string, valor: 1 | -1): Preferencias {
  const feedback = { ...prefs.feedback };
  if (feedback[id] === valor) delete feedback[id];
  else feedback[id] = valor;
  return normalizarPreferencias({ ...prefs, feedback });
}

export function comInteresse(prefs: Preferencias, materia: string, ligado: boolean): Preferencias {
  const resto = prefs.interesses.filter((m) => m !== materia);
  return normalizarPreferencias({ ...prefs, interesses: ligado ? [...resto, materia] : resto });
}

type Pesos = Map<string, number>;

/** Etiquetas de cada aula com o peso de cada uma. Os termos raros do catálogo pesam mais. */
function etiquetasDoCatalogo(catalogo: ItemRec[]): Map<string, Pesos> {
  const df = new Map<string, number>();
  const termos = new Map<string, string[]>();
  for (const it of catalogo) {
    const t = termosDoTitulo(it.titulo);
    termos.set(it.id, t);
    for (const x of t) df.set(x, (df.get(x) ?? 0) + 1);
  }
  const idf = (x: string) => Math.log((catalogo.length + 1) / ((df.get(x) ?? 0) + 1)) + 1;
  const maior = Math.max(1, ...[...df.keys()].map(idf));

  const saida = new Map<string, Pesos>();
  for (const it of catalogo) {
    const pesos: Pesos = new Map([
      [`m:${it.materia}`, PESO_MATERIA],
      [`g:${it.grupo}`, PESO_GRUPO],
    ]);
    const maisRaros = (termos.get(it.id) ?? [])
      .map((x) => [x, idf(x)] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TERMOS_POR_AULA);
    for (const [x, v] of maisRaros) pesos.set(`t:${x}`, (PESO_TERMO * v) / maior);
    saida.set(it.id, pesos);
  }
  return saida;
}

const somaDosPesos = (a: Pesos, b: Pesos) => {
  let s = 0;
  for (const [k, v] of a) if (b.has(k)) s += v;
  return s;
};

/**
 * Sugere aulas. Fora da lista: o que já foi concluído e o que a pessoa já avaliou (👍 ou 👎): avaliar é decidir. A nota de uma
 * aula é a soma dos pesos das suas etiquetas no perfil; só entram as de nota positiva.
 */
export function recomendar(p: {
  catalogo: ItemRec[];
  prefs: Preferencias;
  concluidas?: Iterable<string>;
  n?: number;
}): ResultadoRec {
  const prefs = normalizarPreferencias(p.prefs);
  const semPerfil = prefs.interesses.length === 0 && Object.keys(prefs.feedback).length === 0;
  if (semPerfil) return { itens: [], semPerfil: true };

  const n = Math.min(50, Math.max(1, p.n ?? SUGESTOES_PADRAO));
  const feitas = new Set(p.concluidas ?? []);
  const etiquetas = etiquetasDoCatalogo(p.catalogo);
  const porId = new Map(p.catalogo.map((it) => [it.id, it]));

  // Perfil: etiqueta → peso. Interesse soma na matéria; cada feedback soma (ou tira) nas etiquetas da aula.
  const perfil = new Map<string, number>();
  const soma = (k: string, v: number) => perfil.set(k, (perfil.get(k) ?? 0) + v);
  for (const m of prefs.interesses) soma(`m:${m}`, 1);
  const curtidas: ItemRec[] = [];
  for (const [id, v] of Object.entries(prefs.feedback)) {
    const it = porId.get(id);
    if (!it) continue;
    if (v === 1) curtidas.push(it);
    for (const k of etiquetas.get(id)!.keys()) soma(k, v * FORCA_FEEDBACK);
  }

  const itens: Recomendacao[] = [];
  for (const it of p.catalogo) {
    if (feitas.has(it.id) || it.id in prefs.feedback) continue;
    const meus = etiquetas.get(it.id)!;
    let pontos = 0;
    for (const [k, peso] of meus) pontos += (perfil.get(k) ?? 0) * peso;
    if (pontos <= 0) continue;

    const porque: string[] = [];
    if (prefs.interesses.includes(it.materia)) porque.push(`Você escolheu ${it.materiaNome}`);
    let melhor: ItemRec | null = null;
    let melhorPeso = MINIMO_PARECIDA - 1e-9;
    for (const c of curtidas) {
      if (c.id === it.id) continue;
      const compartilhado = somaDosPesos(meus, etiquetas.get(c.id)!);
      if (compartilhado > melhorPeso) [melhor, melhorPeso] = [c, compartilhado];
    }
    if (melhor) porque.push(`Parecida com “${melhor.titulo}”, que você curtiu`);
    if (!porque.length) porque.push(`Do mesmo grupo (${it.grupo}) de aulas que você curtiu`);
    itens.push({ item: it, pontos: Math.round(pontos * 1000) / 1000, porque });
  }
  itens.sort((a, b) => b.pontos - a.pontos || a.item.id.localeCompare(b.item.id));
  return { itens: itens.slice(0, n), semPerfil: false };
}
