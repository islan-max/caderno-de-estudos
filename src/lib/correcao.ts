/* ---------------------------------------------------------------------------
 * Correção de um cartão de revisão, sem servidor: compara a resposta escrita com os termos em
 * negrito do tópico (as palavras-chave que o formato das aulas já exige em todo Tópico-Chave).
 *
 * Limite honesto: confere se os termos aparecem, não se a ideia está certa. É a correção de
 * reserva quando não há uma IA configurada (src/scripts/corretor.ts).
 * ------------------------------------------------------------------------- */

export type Veredito = 'certo' | 'parcial' | 'errado';

export interface Correcao {
  veredito: Veredito;
  /** O que a pessoa escreveu e bate com o tópico. */
  citados: string[];
  /** O que o tópico traz e não apareceu na resposta. */
  faltaram: string[];
  /** A correção recomenda rever a aula (resposta errada). Na parcial a pessoa decide. */
  revisarAula: boolean;
  /** Frase pronta para mostrar. */
  texto: string;
}

export function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Letras e números separados por espaço único. */
function palavras(texto: string): string[] {
  return semAcento(texto)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Termo que é conta ou fórmula (a/b = a ÷ b): não se exige que a pessoa a reescreva igual. */
function ehFormula(termo: string): boolean {
  return /[=÷×+*/^]|\d/.test(termo);
}

/** A palavra aparece na resposta, mesmo no plural ou no feminino ("fração" ~ "frações"). */
function apareceu(palavra: string, resposta: string[]): boolean {
  const raiz = palavra.length >= 5 ? palavra.slice(0, Math.max(4, palavra.length - 2)) : palavra;
  return resposta.some((r) => r === palavra || (raiz.length >= 4 && r.startsWith(raiz)));
}

export function corrigirPorTermos(resposta: string, termosBrutos: string[]): Correcao {
  const dela = palavras(resposta);
  const termos = [...new Set(termosBrutos.map((t) => t.trim()).filter(Boolean))].filter((t) => !ehFormula(t));
  const citados: string[] = [];
  const faltaram: string[] = [];
  for (const termo of termos) {
    const ps = palavras(termo);
    (ps.length && ps.every((p) => apareceu(p, dela)) ? citados : faltaram).push(termo);
  }
  const total = citados.length + faltaram.length;
  const proporcao = total ? citados.length / total : 0;
  const curta = dela.length < 3;
  const veredito: Veredito = curta ? 'errado' : proporcao >= 0.7 ? 'certo' : proporcao >= 0.3 ? 'parcial' : 'errado';

  const lista = (xs: string[]) => xs.slice(0, 6).join(', ');
  const partes: string[] = [];
  if (curta) partes.push('A resposta ficou curta demais para conferir.');
  else if (citados.length) partes.push(`Você citou: ${lista(citados)}.`);
  if (faltaram.length && veredito !== 'certo') partes.push(`Faltou: ${lista(faltaram)}.`);
  if (veredito === 'certo') partes.push('Você cobriu os pontos principais do tópico.');
  if (veredito === 'parcial') partes.push('Dá para complementar aqui mesmo: leia a resposta do caderno abaixo e compare com a sua.');
  if (veredito === 'errado') partes.push('Vale voltar à aula neste tópico antes de seguir.');
  return { veredito, citados, faltaram, revisarAula: veredito === 'errado', texto: partes.join(' ') };
}

/* ---------------------------------------------------------------------------
 * Correção por significado: o tópico é quebrado em pontos (frases) e cada ponto é comparado com o
 * que a pessoa escreveu. Quem mede a semelhança é um modelo pequeno que roda no aparelho
 * (src/scripts/ia.ts); aqui só ficam as contas, que não dependem dele e têm teste.
 * ------------------------------------------------------------------------- */

export interface Ponto {
  /** A frase do tópico, como está na aula. */
  texto: string;
  /** Termos em negrito que aparecem nesta frase. */
  termos: string[];
}

export interface CorrecaoPorSentido extends Correcao {
  cobertos: string[];
  /** Pontos do tópico que a resposta não cobriu: é o que dá para complementar na hora. */
  pontosFaltantes: string[];
}

/** Semelhança de cosseno (os vetores do modelo já vêm normalizados, mas não custa conferir). */
export function cosseno(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** Frases do texto, sem as que são só conta ou curtas demais para dizer algo. */
export function quebrarEmPontos(texto: string): string[] {
  return texto
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && /[a-zA-ZÀ-ÿ]{3,}.*[a-zA-ZÀ-ÿ]{3,}.*[a-zA-ZÀ-ÿ]{3,}/.test(s));
}

/** Trechos da resposta para comparar: cada frase e a resposta inteira (a ideia pode estar numa frase só ou espalhada). */
export function quebrarResposta(texto: string): string[] {
  const frases = texto
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const inteiro = texto.replace(/\s+/g, ' ').trim();
  return frases.length > 1 ? [...frases, inteiro] : [inteiro];
}

/**
 * Um trecho da resposta cobre o ponto de que ele mais se aproxima, se a semelhança passa de
 * LIMIAR_PONTO. Cobre também outro ponto se passa de LIMIAR_FORTE (a pessoa pôs duas ideias numa
 * frase só). Sem essa regra, uma resposta que só trata da primeira ideia "cobria" a segunda por
 * parecer com ela. Valores calibrados em 12/10/2026 com o modelo paraphrase-multilingual-MiniLM, em respostas certas, parafraseadas, parciais, vagas e fora do assunto.
 */
export const LIMIAR_PONTO = 0.5;
export const LIMIAR_FORTE = 0.68;

/**
 * `semelhancas[i][j]` é a semelhança do ponto i com o trecho j da resposta. Um ponto também conta
 * se todos os termos em negrito dele aparecem na resposta (a pessoa pode ter usado a palavra
 * certa numa frase diferente da aula).
 *
 * Limite: mede se a pessoa falou das mesmas ideias, não se a conclusão está certa.
 */
export function corrigirPorSentido(resposta: string, pontos: Ponto[], semelhancas: number[][]): CorrecaoPorSentido {
  const dela = palavras(resposta);
  const cobre = pontos.map(() => false);
  const trechos = semelhancas[0]?.length ?? 0;
  for (let j = 0; j < trechos; j++) {
    let melhor = 0;
    pontos.forEach((_, i) => {
      if ((semelhancas[i]?.[j] ?? -1) > (semelhancas[melhor]?.[j] ?? -1)) melhor = i;
    });
    pontos.forEach((_, i) => {
      const s = semelhancas[i]?.[j] ?? 0;
      if ((i === melhor && s >= LIMIAR_PONTO) || s >= LIMIAR_FORTE) cobre[i] = true;
    });
  }
  const cobertos: string[] = [];
  const pontosFaltantes: string[] = [];
  pontos.forEach((p, i) => {
    const porTermos = p.termos.length >= 2 && p.termos.every((t) => palavras(t).every((w) => apareceu(w, dela)));
    (cobre[i] || porTermos ? cobertos : pontosFaltantes).push(p.texto);
  });
  const total = pontos.length;
  const proporcao = total ? cobertos.length / total : 0;
  const curta = dela.length < 3;
  const veredito: Veredito = curta ? 'errado' : proporcao >= 0.7 ? 'certo' : proporcao >= 0.3 ? 'parcial' : 'errado';
  const partes: string[] = [];
  if (curta) partes.push('A resposta ficou curta demais para conferir.');
  else if (veredito === 'certo') partes.push('Você cobriu as ideias principais do tópico.');
  else if (veredito === 'parcial') partes.push(`Você cobriu ${cobertos.length} de ${total} ideias do tópico. Dá para complementar aqui mesmo: veja abaixo o que faltou.`);
  else partes.push('A resposta não chegou nas ideias principais do tópico. Vale voltar à aula neste ponto antes de seguir.');
  return {
    veredito,
    citados: [],
    faltaram: [],
    cobertos,
    pontosFaltantes,
    revisarAula: veredito === 'errado',
    texto: partes.join(' '),
  };
}
