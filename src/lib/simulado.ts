/* ---------------------------------------------------------------------------
 * Simulado: regras puras (sorteio, resultado, tempo, estado salvo).
 * A página (src/pages/simulado.astro) e o script (src/scripts/simulado.ts) usam isto;
 * os testes ficam em simulado.test.ts (`npm test`).
 * ------------------------------------------------------------------------- */

/** Uma questão que existe numa aula: a aula (id "enem/quimica/estequiometria"), a matéria e a posição no gabarito. */
export interface QuestaoDisponivel {
  aula: string;
  materia: string;
  n: number;
}

/** Minutos por questão sugeridos: o ENEM dá 5h30 para 90 questões e a redação, cerca de 3 min cada. */
export const MINUTOS_POR_QUESTAO = 3;

/** Embaralha sem mudar a lista recebida (Fisher-Yates). */
export function embaralhar<T>(lista: readonly T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Sorteia `total` questões das matérias escolhidas, divididas igualmente entre elas.
 * O que sobra da divisão vai para as primeiras matérias; matéria sem questões suficientes
 * entra com todas as que tem e a diferença passa para as outras. Sem repetição. As questões
 * saem misturadas entre as matérias, como na prova.
 */
export function sortear(
  disponiveis: readonly QuestaoDisponivel[],
  materias: readonly string[],
  total: number,
  aleatorio: () => number = Math.random
): QuestaoDisponivel[] {
  const porMateria = new Map<string, QuestaoDisponivel[]>();
  for (const m of materias) porMateria.set(m, embaralhar(disponiveis.filter((q) => q.materia === m), aleatorio));
  const ativas = materias.filter((m) => (porMateria.get(m)?.length ?? 0) > 0);
  const cotas = new Map(ativas.map((m) => [m, 0]));

  let restante = Math.max(0, Math.floor(total));
  // Distribui uma a uma, em rodízio, só entre as matérias que ainda têm questão.
  while (restante > 0) {
    const comSobra = ativas.filter((m) => cotas.get(m)! < porMateria.get(m)!.length);
    if (!comSobra.length) break;
    for (const m of comSobra) {
      if (restante === 0) break;
      cotas.set(m, cotas.get(m)! + 1);
      restante--;
    }
  }

  const escolhidas = ativas.flatMap((m) => porMateria.get(m)!.slice(0, cotas.get(m)));
  return embaralhar(escolhidas, aleatorio);
}

export interface Resposta {
  materia: string;
  correta: number;
  /** Índice marcado (0-4) ou -1 se ficou em branco. */
  escolha: number;
}

export interface Resultado {
  acertos: number;
  respondidas: number;
  total: number;
  porMateria: { materia: string; acertos: number; total: number }[];
}

export function resultado(respostas: readonly Resposta[]): Resultado {
  const porMateria = new Map<string, { acertos: number; total: number }>();
  let acertos = 0;
  let respondidas = 0;
  for (const r of respostas) {
    const m = porMateria.get(r.materia) ?? { acertos: 0, total: 0 };
    m.total++;
    if (r.escolha >= 0) respondidas++;
    if (r.escolha === r.correta) {
      acertos++;
      m.acertos++;
    }
    porMateria.set(r.materia, m);
  }
  return {
    acertos,
    respondidas,
    total: respostas.length,
    porMateria: [...porMateria].map(([materia, v]) => ({ materia, ...v })),
  };
}

/** "07:05" ou, passando de uma hora, "1:02:09". Negativo vira zero. */
export function formatarTempo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const dd = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(s % 60)}` : `${dd(m)}:${dd(s % 60)}`;
}

/** Simulado em andamento, guardado no navegador para sobreviver a um recarregamento. */
export interface SimuladoSalvo {
  questoes: QuestaoDisponivel[];
  respostas: number[];
  inicio: number;
  /** Duração do cronômetro em ms; null quando o tempo não é contado. */
  limite: number | null;
}

/** Lê o estado salvo; qualquer coisa fora do formato (versão antiga, edição à mão) vira null. */
export function lerSalvo(bruto: unknown): SimuladoSalvo | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const s = bruto as Record<string, unknown>;
  if (!Array.isArray(s.questoes) || !Array.isArray(s.respostas) || typeof s.inicio !== 'number') return null;
  if (s.limite !== null && typeof s.limite !== 'number') return null;
  const questoes = s.questoes.filter(
    (q): q is QuestaoDisponivel =>
      !!q && typeof q === 'object' && typeof q.aula === 'string' && typeof q.materia === 'string' && Number.isInteger(q.n) && q.n >= 0
  );
  if (!questoes.length || questoes.length !== s.questoes.length || s.respostas.length !== questoes.length) return null;
  const respostas = s.respostas.map((r) => (Number.isInteger(r) && r >= -1 && r <= 4 ? (r as number) : -1));
  return { questoes, respostas, inicio: s.inicio, limite: s.limite as number | null };
}
