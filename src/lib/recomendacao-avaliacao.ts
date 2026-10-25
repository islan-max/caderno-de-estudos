/* ---------------------------------------------------------------------------
 * Avaliação offline do recomendador, com pessoas sintéticas e semente fixa (o resultado se repete).
 *
 * Cada pessoa sintética gosta de um grupo inteiro (ex.: Ciências da Natureza), mas diz ao sistema só
 * uma matéria desse grupo (interesse) e dá 👍 a duas aulas de OUTRA matéria do mesmo grupo. Vale
 * como acerto toda aula do grupo que ela ainda não viu. Compara o recomendador com "só interesses",
 * com a lista de aulas de mais cartões e com sorteio.
 *
 * Limite assumido: o grupo é também uma etiqueta que o recomendador usa. Isto é um teste de sanidade
 * (o feedback melhora o resultado?), não prova de que as sugestões servem a uma pessoa de verdade.
 * ------------------------------------------------------------------------- */
import { recomendar } from './recomendacao.ts';
import type { ItemRec, Preferencias } from './recomendacao.ts';

export interface Metrica {
  /** Média da fração dos k primeiros que são do grupo de gosto. */
  precisao: number;
  /** Fração das pessoas com pelo menos uma aula da matéria curtida (não declarada) entre os k primeiros. */
  achouAOutraMateria: number;
}

export interface Avaliacao {
  pessoas: number;
  k: number;
  recomendador: Metrica;
  soInteresses: Metrica;
  maisCartoes: Metrica;
  sorteio: Metrica;
}

/** Gerador pseudoaleatório com semente (mulberry32). */
export function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar<T>(lista: T[], rnd: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function avaliarRecomendador(catalogo: ItemRec[], opcoes: { pessoas?: number; semente?: number; k?: number } = {}): Avaliacao {
  const k = opcoes.k ?? 5;
  const pessoas = opcoes.pessoas ?? 200;
  const rnd = sorteador(opcoes.semente ?? 1);

  // Grupos com duas matérias de pelo menos 3 aulas cada: só neles dá para montar a pessoa sintética.
  const porGrupo = new Map<string, Map<string, ItemRec[]>>();
  for (const it of catalogo) {
    const g = porGrupo.get(it.grupo) ?? new Map<string, ItemRec[]>();
    g.set(it.materia, [...(g.get(it.materia) ?? []), it]);
    porGrupo.set(it.grupo, g);
  }
  const elegiveis = [...porGrupo].filter(([, m]) => [...m.values()].filter((l) => l.length >= 3).length >= 2);
  if (!elegiveis.length) throw new Error('O catálogo não tem um grupo com duas matérias de 3 aulas ou mais.');

  const somas = { recomendador: [0, 0], soInteresses: [0, 0], maisCartoes: [0, 0], sorteio: [0, 0] };
  const maisCartoes = [...catalogo].sort((a, b) => (b.cartoes ?? 0) - (a.cartoes ?? 0) || a.id.localeCompare(b.id));

  for (let i = 0; i < pessoas; i++) {
    const [grupo, materias] = elegiveis[Math.floor(rnd() * elegiveis.length)];
    const [declarada, outra] = embaralhar(
      [...materias].filter(([, l]) => l.length >= 3).map(([m]) => m),
      rnd,
    );
    const curtidas = embaralhar(materias.get(outra)!, rnd).slice(0, 2);
    const vistas = new Set(curtidas.map((c) => c.id));
    const prefs: Preferencias = { interesses: [declarada], feedback: Object.fromEntries(curtidas.map((c) => [c.id, 1 as const])) };

    const medir = (nome: keyof typeof somas, ids: string[]) => {
      const topo = ids.filter((id) => !vistas.has(id)).slice(0, k);
      const porId = new Map(catalogo.map((it) => [it.id, it]));
      const certas = topo.filter((id) => porId.get(id)!.grupo === grupo).length;
      somas[nome][0] += topo.length ? certas / topo.length : 0;
      somas[nome][1] += topo.some((id) => porId.get(id)!.materia === outra) ? 1 : 0;
    };
    const ids = (r: { itens: { item: ItemRec }[] }) => r.itens.map((x) => x.item.id);
    medir('recomendador', ids(recomendar({ catalogo, prefs, concluidas: vistas, n: k })));
    medir('soInteresses', ids(recomendar({ catalogo, prefs: { ...prefs, feedback: {} }, concluidas: vistas, n: k })));
    medir('maisCartoes', maisCartoes.map((c) => c.id));
    // Sorteio: média de 20 sorteios por pessoa, para não depender de um só.
    const antes = [...somas.sorteio];
    for (let r = 0; r < 20; r++) medir('sorteio', embaralhar(catalogo, rnd).map((c) => c.id));
    somas.sorteio = [antes[0] + (somas.sorteio[0] - antes[0]) / 20, antes[1] + (somas.sorteio[1] - antes[1]) / 20];
  }

  const m = ([a, b]: number[]): Metrica => ({ precisao: a / pessoas, achouAOutraMateria: b / pessoas });
  return { pessoas, k, recomendador: m(somas.recomendador), soInteresses: m(somas.soInteresses), maisCartoes: m(somas.maisCartoes), sorteio: m(somas.sorteio) };
}
