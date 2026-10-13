/* ---------------------------------------------------------------------------
 * Modelo de linguagem que roda no aparelho, para corrigir os cartões de revisão pelo SENTIDO da
 * resposta (não só por palavras). Nada é enviado a servidor nenhum: o que a pessoa escreve fica
 * no navegador. O navegador baixa, uma vez, o código (transformers.js, via jsDelivr) e o modelo
 * (Hugging Face); depois os dois ficam guardados no cache do próprio navegador.
 *
 * Só é carregado quando a pessoa aceita e clica em "Corrigir": quem não quer baixar 118 MB
 * continua com a correção por palavras-chave (src/lib/correcao.ts).
 * ------------------------------------------------------------------------- */
import { cosseno } from '../lib/correcao';
import { gravar, ler } from './util';

/** Versão fixa: o código vem de um CDN, então ele só muda quando esta linha mudar. */
const VERSAO = '4.2.0';
const URL_BIBLIOTECA = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${VERSAO}`;
const MODELO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
/** Tamanho do modelo quantizado (model_quantized.onnx), em MB: é o que se avisa antes de baixar. */
export const TAMANHO_MB = 118;

const CHAVE_IA = 'cdt:ia';
export type PreferenciaIA = 'sim' | 'nao' | null;

export function lerPreferenciaIA(): PreferenciaIA {
  const v = ler<string | null>(CHAVE_IA, null);
  return v === 'sim' || v === 'nao' ? v : null;
}

export function gravarPreferenciaIA(v: PreferenciaIA) {
  if (v) gravar(CHAVE_IA, v);
  else {
    try {
      localStorage.removeItem(CHAVE_IA);
    } catch {}
  }
}

/** O aparelho consegue rodar o modelo (WebAssembly) e a pessoa não pediu economia de dados. */
export function iaPossivel(): boolean {
  const conexao = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return typeof WebAssembly !== 'undefined' && !conexao?.saveData;
}

type Extrator = (textos: string[], opcoes: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][]; dispose?: () => void }>;

let extrator: Promise<Extrator> | null = null;
let pronto = false;

/** O modelo já está na memória desta página (a segunda correção não espera nada). */
export function modeloPronto(): boolean {
  return pronto;
}

/** Baixa e prepara o modelo. A promessa é guardada: chamadas seguintes esperam a mesma carga. */
export function carregarModelo(aoProgredir?: (percentual: number) => void): Promise<Extrator> {
  if (extrator) return extrator;
  const arquivos = new Map<string, { carregado: number; total: number }>();
  extrator = (async () => {
    // @vite-ignore: o endereço é de um CDN, não de um módulo do projeto.
    const lib = await import(/* @vite-ignore */ URL_BIBLIOTECA);
    const e = (await lib.pipeline('feature-extraction', MODELO, {
      dtype: 'q8',
      progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file || !p.total) return;
        arquivos.set(p.file, { carregado: p.loaded ?? 0, total: p.total });
        let c = 0;
        let t = 0;
        for (const a of arquivos.values()) {
          c += a.carregado;
          t += a.total;
        }
        aoProgredir?.(Math.min(100, Math.round((c / t) * 100)));
      },
    })) as Extrator;
    pronto = true;
    return e;
  })().catch((erro) => {
    extrator = null;
    throw erro;
  });
  return extrator;
}

/** Semelhança de cada ponto com cada trecho da resposta: matriz [ponto][trecho]. */
export async function medirSemelhanca(pontos: string[], trechos: string[], aoProgredir?: (p: number) => void): Promise<number[][]> {
  const e = await carregarModelo(aoProgredir);
  const saida = await e([...pontos, ...trechos], { pooling: 'mean', normalize: true });
  const v = saida.tolist();
  saida.dispose?.();
  const dosPontos = v.slice(0, pontos.length);
  const dosTrechos = v.slice(pontos.length);
  return dosPontos.map((p) => dosTrechos.map((t) => cosseno(p, t)));
}
