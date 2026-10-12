/* ---------------------------------------------------------------------------
 * Preferências de leitura: tamanho do texto, brilho, acessibilidade e avisos dispensados.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';
import { ler, gravar } from './util';

export const CHAVE_FONTE_PX = 'cdt:fonte-px';

const CHAVE_DISPENSADOS = 'cdt:dispensados';

const FONTE_MINIMA = 14;

const FONTE_PADRAO = 16;

const FONTE_MAXIMA = 28;

export function aplicarFontePx(px: number) {
  const raiz = document.documentElement;
  const valor = Math.max(FONTE_MINIMA, Math.min(FONTE_MAXIMA, px));
  // Só o texto de leitura usa a escala (ver global.css): 16px = 1.
  raiz.style.setProperty('--escala-texto', String(valor / FONTE_PADRAO));

  document.querySelectorAll<HTMLElement>('[data-acao="texto"]').forEach((btn) => {
    btn.setAttribute('title', `Tamanho: ${valor}px`);
    btn.setAttribute('aria-label', `Tamanho: ${valor}px`);
  });

  const slider = document.querySelector<HTMLInputElement>('[data-slider-fonte]');
  if (slider) {
    slider.value = String(valor);
    const display = slider.closest('[data-controle-fonte]')?.querySelector('[data-fonte-display]');
    if (display) display.textContent = `${valor}px${valor === FONTE_PADRAO ? ' · padrão' : ''}`;
    slider.setAttribute('aria-valuetext', `${valor} pixels${valor === FONTE_PADRAO ? ', tamanho padrão' : ''}`);
  }
  atualizarRestaurar();
}

export const CHAVE_BRILHO = 'cdt:brilho';

const BRILHO_MINIMO = 75;

const BRILHO_PADRAO = 100;

export function lerBrilho(): number {
  return ler<number>(CHAVE_BRILHO, BRILHO_PADRAO);
}

/** Escurece só o tema claro (o CSS ignora o escuro). 100 = sem ajuste. */
export function aplicarBrilho(pct: number) {
  const raiz = document.documentElement;
  const valor = Math.max(BRILHO_MINIMO, Math.min(BRILHO_PADRAO, Number(pct) || BRILHO_PADRAO));
  if (valor < BRILHO_PADRAO) {
    raiz.dataset.brilho = 'sim';
    raiz.style.setProperty('--brilho', String(valor / 100));
  } else {
    delete raiz.dataset.brilho;
    raiz.style.removeProperty('--brilho');
  }

  const slider = document.querySelector<HTMLInputElement>('[data-slider-brilho]');
  if (slider) {
    const texto = `${valor}%${valor === BRILHO_PADRAO ? ' · padrão' : ''}`;
    slider.value = String(valor);
    slider.setAttribute('aria-valuetext', valor === BRILHO_PADRAO ? '100%, brilho padrão' : `${valor}%`);
    const display = slider.closest('[data-controle-brilho]')?.querySelector('[data-brilho-display]');
    if (display) display.textContent = texto;
  }
  atualizarRestaurar();
}

function atualizarRestaurar() {
  const alterado =
    lerFontePx() !== FONTE_PADRAO ||
    lerBrilho() !== BRILHO_PADRAO ||
    temPreferenciaA11y() ||
    dispensados().length > 0;
  document.querySelectorAll<HTMLButtonElement>('[data-acao="restaurar-a11y"]').forEach((btn) => {
    btn.disabled = !alterado;
  });
}

function temPreferenciaA11y(): boolean {
  const p = preferencias();
  return Object.keys(p).some((k) => (LIGADAS_POR_PADRAO.includes(k) ? p[k] === false : p[k]));
}

function dispensados(): string[] {
  return ler<string[]>(CHAVE_DISPENSADOS, []);
}

/** O CSS esconde o aviso quando a chave dele está em data-dispensados no <html>. */
export function aplicarDispensados() {
  const lista = dispensados();
  if (lista.length) document.documentElement.dataset.dispensados = lista.join(' ');
  else delete document.documentElement.dataset.dispensados;
}

export function dispensar(chave: string) {
  const lista = dispensados();
  if (!lista.includes(chave)) lista.push(chave);
  gravar(CHAVE_DISPENSADOS, lista);
  aplicarDispensados();
  atualizarRestaurar();
  toast('Certo, não mostro mais isso', 'circle-check');
}

/** Volta fonte, preferências de acessibilidade e avisos dispensados ao padrão. */
export function restaurarAcessibilidade() {
  try {
    localStorage.removeItem(CHAVE_FONTE_PX);
    localStorage.removeItem(CHAVE_BRILHO);
    localStorage.removeItem(CHAVE_A11Y);
    localStorage.removeItem(CHAVE_DISPENSADOS);
  } catch {}
  aplicarDispensados();
  aplicarA11y({});
  aplicarFontePx(FONTE_PADRAO);
  aplicarBrilho(BRILHO_PADRAO);
}

export function lerFontePx(): number {
  return ler<number>(CHAVE_FONTE_PX, FONTE_PADRAO);
}

const CHAVE_A11Y = 'cdt:a11y';

type Preferencias = Record<string, boolean>;

export function preferencias(): Preferencias {
  return ler<Preferencias>(CHAVE_A11Y, {});
}

/** Cada preferência vira um data-attribute no <html>; o CSS faz o resto. */
export function aplicarA11y(p: Preferencias) {
  const raiz = document.documentElement;
  for (const chave of ['espacamento', 'contraste', 'movimento', 'links']) {
    if (p[chave]) raiz.dataset[chave] = 'sim';
    else delete raiz.dataset[chave];
  }
  // "atalhos" e "correcao" são o contrário das outras: vêm LIGADAS, e só o valor false as desliga.
  if (ligada(p, 'atalhos')) delete raiz.dataset.atalhos;
  else raiz.dataset.atalhos = 'nao';
  const modoAnterior = raiz.dataset.correcao;
  if (ligada(p, 'correcao')) delete raiz.dataset.correcao;
  else raiz.dataset.correcao = 'final';
  if (modoAnterior !== raiz.dataset.correcao) document.dispatchEvent(new CustomEvent('cdt:correcao'));
  document.querySelectorAll<HTMLElement>('[data-a11y]').forEach((btn) => {
    btn.setAttribute('aria-checked', String(ligada(p, btn.dataset.a11y!)));
  });
  atualizarRestaurar();
}

/** Preferências que já vêm ligadas: o que fica salvo só muda quando o usuário desliga. */
const LIGADAS_POR_PADRAO = ['atalhos', 'correcao'];

function ligada(p: Preferencias, chave: string): boolean {
  return LIGADAS_POR_PADRAO.includes(chave) ? p[chave] !== false : Boolean(p[chave]);
}

export function alternarA11y(chave: string) {
  const p = preferencias();
  p[chave] = !ligada(p, chave);
  gravar(CHAVE_A11Y, p);
  aplicarA11y(p);

  const nomes: Record<string, string> = {
    espacamento: 'Espaçamento de leitura',
    contraste: 'Alto contraste',
    movimento: 'Animações reduzidas',
    links: 'Links sublinhados',
    atalhos: 'Atalhos de uma tecla',
    correcao: 'Correção imediata das questões',
  };
  toast(`${nomes[chave]}: ${ligada(p, chave) ? 'ligado' : 'desligado'}`, 'universal-access');
}
