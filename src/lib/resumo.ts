/* ---------------------------------------------------------------------------
 * Resumo de transcrição de vídeo: regras puras, sem DOM, sem rede e sem armazenamento.
 *
 * O caderno não baixa nada do YouTube: a pessoa cola ou envia a transcrição (.vtt, .srt ou o texto
 * copiado de "Mostrar transcrição") e o resumo é feito aqui, no navegador. É um resumo EXTRATIVO:
 * cada ponto é uma frase da própria transcrição, sem reescrita, então dá para conferir de onde veio
 * e nada é inventado. A escolha das frases é por palavras raras do trecho (tf-idf), não por "entender".
 * ------------------------------------------------------------------------- */

export interface Fala {
  /** Segundos desde o começo do vídeo; null quando a transcrição não tem marcas de tempo. */
  inicio: number | null;
  texto: string;
}

export interface Transcricao {
  falas: Fala[];
  formato: 'vtt' | 'srt' | 'texto com marcas' | 'texto';
  temMarcas: boolean;
  palavras: number;
  /** Maior marca de tempo (segundos); null sem marcas. */
  duracao: number | null;
  /** Legendas automáticas costumam vir sem pontuação. */
  semPontuacao: boolean;
}

export interface Ponto {
  inicio: number | null;
  texto: string;
}

export interface Trecho {
  inicio: number | null;
  fim: number | null;
  palavras: number;
  pontos: Ponto[];
  /** Trecho com pouco texto: o resumo dele diz pouco. */
  pouco: boolean;
}

export interface Resumo {
  trechos: Trecho[];
  avisos: string[];
}

export const LIMITES = {
  caracteres: 1_000_000,
  palavras: 60_000,
  segundos: 3 * 3600,
  minPalavras: 20,
  curta: 150,
} as const;

const PALAVRAS_POR_TRECHO = 250;
const SEGUNDOS_POR_TRECHO = 120;
const PALAVRAS_POR_FRASE_MAX = 25;
const PALAVRAS_POR_FRASE_MIN = 6;
const PONTOS_POR_TRECHO_MAX = 3;
const TRECHO_POUCO = 40;

/* ---------------------------------------------------------------- endereço do vídeo */

const HOSTS_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;

/** Só endereços de vídeo do YouTube. O endereço serve para montar os links com o minuto; nada é buscado. */
export function lerEnderecoDoVideo(entrada: string): { ok: true; id: string } | { ok: false; motivo: string } {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    return { ok: false, motivo: 'Isso não parece um endereço. Cole o link do vídeo, como https://www.youtube.com/watch?v=…' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, motivo: 'Use um link que comece com http ou https.' };
  if (!HOSTS_YOUTUBE.has(url.hostname.toLowerCase())) return { ok: false, motivo: 'Só links de vídeo do YouTube são aceitos.' };
  const partes = url.pathname.split('/').filter(Boolean);
  const candidato = url.hostname.toLowerCase() === 'youtu.be' ? partes[0] : ['embed', 'shorts', 'live', 'v'].includes(partes[0]) ? partes[1] : url.searchParams.get('v');
  if (!candidato || !ID_VIDEO.test(candidato)) return { ok: false, motivo: 'Não achei o código do vídeo nesse link.' };
  return { ok: true, id: candidato };
}

export const linkDoMomento = (id: string, segundos: number | null) =>
  `https://www.youtube.com/watch?v=${id}${segundos === null ? '' : `&t=${Math.floor(segundos)}s`}`;

/** 75 → "1:15"; 3725 → "1:02:05". */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/* ------------------------------------------------------------------ ler a transcrição */

/** "00:01:15.500", "01:15,5", "1:15" ou "75" → segundos; null se não for um horário. */
export function lerTempo(texto: string): number | null {
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(texto.trim());
  if (!m) return null;
  const [, h, min, s, ms] = m;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(s) + (ms ? Number(ms.padEnd(3, '0')) / 1000 : 0);
}

const ENTIDADES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Tira marcações, sons de fundo ("[Música]", ♪) e entidades de uma linha de legenda. */
export function limparLinha(linha: string): string {
  return linha
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e])
    .replace(/\[[^\]]{0,40}\]/g, '')
    .replace(/♪[^♪]*♪|♪/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LINHA_DE_HORARIO = /^\s*(\S+)\s+-->\s+(\S+)/;
const SO_MARCA = /^\d{1,2}(?::\d{2}){1,2}$/;
const MARCA_E_TEXTO = /^(\d{1,2}(?::\d{2}){1,2})\s+(\S.*)$/;

function falasDeLegenda(bruto: string): Fala[] {
  const falas: Fala[] = [];
  let ultima = '';
  let fimAnterior = -1;
  for (const bloco of bruto.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const linhas = bloco.split('\n');
    const i = linhas.findIndex((l) => LINHA_DE_HORARIO.test(l));
    if (i < 0) continue; // cabeçalho (WEBVTT), NOTE, STYLE ou lixo
    const horario = LINHA_DE_HORARIO.exec(linhas[i])!;
    const inicio = lerTempo(horario[1]);
    if (inicio === null) continue;
    // Legenda automática "rolante": a primeira linha do cartão repete a última do anterior, que ainda está na tela.
    const rolante = inicio <= fimAnterior + 0.05;
    linhas.slice(i + 1).forEach((l, k) => {
      const texto = limparLinha(l);
      if (!texto || (k === 0 && rolante && texto === ultima)) return;
      falas.push({ inicio, texto });
      ultima = texto;
    });
    fimAnterior = lerTempo(horario[2]) ?? fimAnterior;
  }
  return falas;
}

function falasDeTextoCopiado(linhas: string[]): Fala[] | null {
  const soMarca = linhas.filter((l) => SO_MARCA.test(l.trim())).length;
  const marcaETexto = linhas.filter((l) => MARCA_E_TEXTO.test(l.trim())).length;
  if (soMarca < 3 && marcaETexto < 3) return null;
  const falas: Fala[] = [];
  let atual: number | null = null;
  for (const bruta of linhas) {
    const l = bruta.trim();
    const junto = MARCA_E_TEXTO.exec(l);
    if (SO_MARCA.test(l)) atual = lerTempo(l);
    else if (junto && lerTempo(junto[1]) !== null) {
      const texto = limparLinha(junto[2]);
      if (texto) falas.push({ inicio: lerTempo(junto[1]), texto });
      atual = null;
    } else {
      const texto = limparLinha(l);
      if (texto) falas.push({ inicio: atual, texto });
    }
  }
  return falas;
}

const contarPalavras = (texto: string) => (texto.match(/\S+/g) ?? []).length;

export function lerTranscricao(bruto: string): { ok: true; transcricao: Transcricao } | { ok: false; erro: string } {
  if (bruto.length > LIMITES.caracteres) return { ok: false, erro: 'O texto é grande demais (mais de 1 MB). Envie um trecho menor.' };
  const texto = bruto.replace(/^﻿/, '');
  let formato: Transcricao['formato'];
  let falas: Fala[];
  if (/-->/.test(texto)) {
    formato = /^\s*WEBVTT/.test(texto) ? 'vtt' : 'srt';
    falas = falasDeLegenda(texto);
  } else {
    const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
    const copiadas = falasDeTextoCopiado(linhas);
    formato = copiadas ? 'texto com marcas' : 'texto';
    falas = copiadas ?? linhas.map((l) => ({ inicio: null, texto: limparLinha(l) })).filter((f) => f.texto);
  }
  const palavras = falas.reduce((n, f) => n + contarPalavras(f.texto), 0);
  if (palavras < LIMITES.minPalavras) return { ok: false, erro: 'Não achei texto suficiente nessa transcrição (menos de 20 palavras).' };
  if (palavras > LIMITES.palavras) return { ok: false, erro: 'A transcrição passa de 60 mil palavras, o limite deste resumo. Envie um trecho.' };

  const marcas = falas.map((f) => f.inicio).filter((x): x is number => x !== null);
  const temMarcas = marcas.length > 0 && marcas.length >= falas.length * 0.8;
  const duracao = temMarcas ? Math.max(...marcas) : null;
  if (duracao !== null && duracao > LIMITES.segundos) return { ok: false, erro: 'O vídeo passa de 3 horas, o limite deste resumo. Envie um trecho.' };

  const pontuacao = (falas.map((f) => f.texto).join(' ').match(/[.!?…]/g) ?? []).length;
  const semPontuacao = pontuacao < palavras / 60;
  return {
    ok: true,
    transcricao: { falas: temMarcas ? falas : falas.map((f) => ({ ...f, inicio: null })), formato, temMarcas, palavras, duracao, semPontuacao },
  };
}

/* --------------------------------------------------------------------- frases e trechos */

interface Frase {
  inicio: number | null;
  texto: string;
  palavras: number;
}

/** Agrupa as falas em frases: termina em pontuação final ou ao chegar a 25 palavras (legenda sem pontuação). */
export function frasesDaTranscricao(falas: Fala[]): Frase[] {
  const frases: Frase[] = [];
  let atual: { inicio: number | null; partes: string[] } | null = null;
  const fechar = () => {
    if (!atual) return;
    const texto = atual.partes.join(' ').trim();
    if (texto) frases.push({ inicio: atual.inicio, texto, palavras: contarPalavras(texto) });
    atual = null;
  };
  for (const fala of falas) {
    const pedacos = fala.texto.split(/(?<=[.!?…])\s+/);
    pedacos.forEach((pedaco, i) => {
      if (i > 0) fechar();
      atual ??= { inicio: fala.inicio, partes: [] };
      atual.partes.push(pedaco);
      if (/[.!?…]["')\]]?$/.test(pedaco) || contarPalavras(atual.partes.join(' ')) >= PALAVRAS_POR_FRASE_MAX) fechar();
    });
  }
  fechar();
  return frases;
}

const SEM_VALOR = new Set(
  ('a as o os um uma uns umas de da das do dos em na nas no nos num numa para por com sem sob sobre entre ao aos ou e que se como mais menos seu sua seus suas ate ja so mas ' +
    'eu tu ele ela nos vos eles elas me te lhe isso isto esse essa esses essas este esta estes estas aquele aquela ser foi era sao tem ter vai vou tambem muito bem entao aqui ali la ' +
    'the and for are but not you all can had her was one our out has have this that with from they will what when your said there each which their about would these other into more').split(' '),
);

function termos(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !SEM_VALOR.has(t) && !/^\d+$/.test(t));
}

/** Corta as frases em trechos de ~250 palavras (ou ~2 minutos, quando há marcas de tempo). */
function trechosDeFrases(frases: Frase[], temMarcas: boolean): Frase[][] {
  const trechos: Frase[][] = [];
  let atual: Frase[] = [];
  let palavras = 0;
  for (const f of frases) {
    const comeco = atual[0]?.inicio ?? null;
    const estourou = palavras >= PALAVRAS_POR_TRECHO || (temMarcas && comeco !== null && f.inicio !== null && f.inicio - comeco >= SEGUNDOS_POR_TRECHO);
    if (atual.length && estourou) {
      trechos.push(atual);
      atual = [];
      palavras = 0;
    }
    atual.push(f);
    palavras += f.palavras;
  }
  if (atual.length) trechos.push(atual);
  return trechos;
}

export function resumir(t: Transcricao): Resumo {
  const frases = frasesDaTranscricao(t.falas);
  const grupos = trechosDeFrases(frases, t.temMarcas);

  // idf: palavra que aparece em poucos trechos diz mais sobre o trecho em que aparece.
  const df = new Map<string, number>();
  const tfs = grupos.map((g) => {
    const tf = new Map<string, number>();
    for (const x of g.flatMap((f) => termos(f.texto))) tf.set(x, (tf.get(x) ?? 0) + 1);
    for (const x of tf.keys()) df.set(x, (df.get(x) ?? 0) + 1);
    return tf;
  });
  const idf = (x: string) => Math.log(1 + grupos.length / (df.get(x) ?? 1));

  const trechos: Trecho[] = grupos.map((g, i) => {
    const palavras = g.reduce((n, f) => n + f.palavras, 0);
    const candidatas = g
      .map((f, ordem) => {
        const ts = [...new Set(termos(f.texto))];
        const nota = ts.reduce((s, x) => s + (tfs[i].get(x) ?? 0) * idf(x), 0) / Math.sqrt(Math.max(1, ts.length));
        return { f, ordem, nota };
      })
      .filter((c) => c.f.palavras >= PALAVRAS_POR_FRASE_MIN);
    const quantas = Math.min(PONTOS_POR_TRECHO_MAX, Math.max(1, Math.round(g.length / 6)));
    const escolhidas = candidatas.sort((a, b) => b.nota - a.nota || a.ordem - b.ordem).slice(0, quantas).sort((a, b) => a.ordem - b.ordem);
    const ultimo = g[g.length - 1].inicio;
    return {
      inicio: g[0].inicio,
      fim: ultimo,
      palavras,
      pontos: escolhidas.map((c) => ({ inicio: c.f.inicio, texto: c.f.texto })),
      pouco: palavras < TRECHO_POUCO,
    };
  });

  const avisos: string[] = ['O resumo escolhe frases da própria transcrição, sem reescrever: confira cada ponto no vídeo.'];
  if (!t.temMarcas) avisos.push('A transcrição não tem marcas de tempo: os pontos não levam ao momento do vídeo.');
  if (t.semPontuacao) avisos.push('A transcrição quase não tem pontuação (parece legenda automática): pode ter erros de reconhecimento e as frases foram cortadas por tamanho.');
  if (t.palavras < LIMITES.curta) avisos.push('Transcrição curta: um resumo diz pouco além do que já está no texto.');
  if (trechos.some((x) => x.pouco) && t.palavras >= LIMITES.curta) avisos.push('Alguns trechos têm pouco texto; os pontos deles são fracos.');
  if (trechos.some((x) => !x.pontos.length)) avisos.push('Alguns trechos só têm frases muito curtas e ficaram sem ponto.');
  return { trechos, avisos };
}

/* -------------------------------------------------------------------------- exportar */

/** Markdown com os pontos escolhidos, cada um com o link do minuto quando há marca de tempo. */
export function paraMarkdown(p: { resumo: Resumo; incluidos: ReadonlySet<string>; videoId: string | null; titulo?: string }): string {
  const linhas = [`# ${p.titulo?.trim() || 'Resumo de vídeo'}`, ''];
  if (p.videoId) linhas.push(`Vídeo: ${linkDoMomento(p.videoId, null)}`, '');
  linhas.push('> Resumo extrativo feito no navegador: cada ponto é uma frase da transcrição, sem reescrita. Confira no vídeo.', '');
  p.resumo.trechos.forEach((tr, i) => {
    const marcados = tr.pontos.filter((_, j) => p.incluidos.has(`${i}.${j}`));
    if (!marcados.length) return;
    for (const pt of marcados) {
      const quando = pt.inicio === null ? '' : p.videoId ? `[${formatarTempo(pt.inicio)}](${linkDoMomento(p.videoId, pt.inicio)}) ` : `${formatarTempo(pt.inicio)} `;
      linhas.push(`- ${quando}${pt.texto}`);
    }
  });
  return linhas.join('\n') + '\n';
}
