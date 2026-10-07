/* ---------------------------------------------------------------------------
 * Comportamento do caderno no navegador.
 *
 * Tudo aqui é progressivo: sem JS a página continua navegável, só perde
 * as conveniências (tema, busca, progresso, atalhos).
 *
 * Nada sai do dispositivo — o progresso vive só no localStorage do usuário.
 * ------------------------------------------------------------------------- */

import { montarQuiz } from './quiz';
import { montarTopicos } from './topicos';
import { montarSumario } from './sumario';
import { montarBarrasDeRolagem } from './barra-rolagem';

const CHAVE_TEMA = 'cdt:tema';
const CHAVE_PROGRESSO = 'cdt:progresso';
const CHAVE_ULTIMA = 'cdt:ultima';
const CHAVE_FONTE_PX = 'cdt:fonte-px';

type Progresso = Record<string, number>;

interface AulaBusca {
  id: string;
  t: string;
  m: string;
  a: string;
  h: string;
  i: string;
  c: string;
}

/* -------------------------------------------------------------- utilidades */

function ler<T>(chave: string, padrao: T): T {
  try {
    const cru = localStorage.getItem(chave);
    return cru ? (JSON.parse(cru) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function base(): string {
  return document.documentElement.dataset.base || '/';
}

/* ------------------------------------------------------------------ toasts */

let toastTimer = 0;

export function toast(mensagem: string, icone = 'circle-check') {
  const pilha = document.getElementById('toasts');
  if (!pilha) return;

  // Uma mensagem por vez: o feedback é curto, empilhar só polui a tela.
  pilha.querySelectorAll('.toast').forEach((t) => sairToast(t as HTMLElement));

  const el = document.createElement('div');
  el.className = 'toast';
  // Sem role próprio: quem anuncia é a região viva #toasts (Base.astro).
  el.innerHTML = `<i class="fa-solid fa-${icone}" aria-hidden="true"></i><span></span>`;
  el.querySelector('span')!.textContent = mensagem;
  pilha.appendChild(el);

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => sairToast(el), 2200);
}

function sairToast(el: HTMLElement) {
  if (el.dataset.saindo === 'true') return;
  el.dataset.saindo = 'true';
  el.addEventListener('animationend', () => el.remove(), { once: true });
  window.setTimeout(() => el.remove(), 400);
}

/* -------------------------------------------------------------------- tema */

function aplicarTema(tema: 'claro' | 'escuro') {
  const raiz = document.documentElement;
  if (tema === 'escuro') raiz.dataset.tema = 'escuro';
  else delete raiz.dataset.tema;

  const cor = tema === 'escuro' ? '#0d0f14' : '#edeadf';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);

  document.querySelectorAll<HTMLElement>('[data-acao="tema"]').forEach((btn) => {
    const escuro = tema === 'escuro';
    btn.setAttribute('aria-pressed', String(escuro));
    btn.setAttribute('title', escuro ? 'Voltar para o tema claro' : 'Usar o tema escuro');
  });
}

function temaAtual(): 'claro' | 'escuro' {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

/** O tema salvo é a fonte da verdade: a navegação do Astro troca os atributos do <html>. */
function temaSalvo(): 'claro' | 'escuro' {
  return ler<string>(CHAVE_TEMA, 'claro') === 'escuro' ? 'escuro' : 'claro';
}

function alternarTema(origem?: HTMLElement | null) {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  gravar(CHAVE_TEMA, novo);

  const raiz = document.documentElement;
  const reduzido =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || raiz.dataset.movimento === 'sim';

  if (reduzido || typeof document.startViewTransition !== 'function') {
    aplicarTema(novo);
  } else {
    // O tema novo se revela em círculo a partir do botão, em vez de piscar a página toda.
    const caixa = origem?.getBoundingClientRect();
    const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth / 2;
    const y = caixa ? caixa.top + caixa.height / 2 : 0;
    const raio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    raiz.style.setProperty('--tema-x', `${x}px`);
    raiz.style.setProperty('--tema-y', `${y}px`);
    raiz.style.setProperty('--tema-raio', `${raio}px`);
    raiz.dataset.trocandoTema = '';
    const transicao = document.startViewTransition(() => aplicarTema(novo));
    transicao.finished.finally(() => delete raiz.dataset.trocandoTema);
  }
  toast(novo === 'escuro' ? 'Tema escuro ativado' : 'Tema claro ativado', novo === 'escuro' ? 'moon' : 'sun');
}

/* ------------------------------------------------------- tamanho do texto */

const FONTE_MINIMA = 14;
const FONTE_PADRAO = 16;
const FONTE_MAXIMA = 28;

function aplicarFontePx(px: number) {
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

/* ------------------------------------------------------ brilho do tema claro */

const CHAVE_BRILHO = 'cdt:brilho';
const BRILHO_MINIMO = 75;
const BRILHO_PADRAO = 100;

function lerBrilho(): number {
  return ler<number>(CHAVE_BRILHO, BRILHO_PADRAO);
}

/** Escurece só o tema claro (o CSS ignora o escuro). 100 = sem ajuste. */
function aplicarBrilho(pct: number) {
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
    lerFontePx() !== FONTE_PADRAO || lerBrilho() !== BRILHO_PADRAO || temPreferenciaA11y();
  document.querySelectorAll<HTMLButtonElement>('[data-acao="restaurar-a11y"]').forEach((btn) => {
    btn.disabled = !alterado;
  });
}

function temPreferenciaA11y(): boolean {
  const p = preferencias();
  return Object.keys(p).some((k) => (LIGADAS_POR_PADRAO.includes(k) ? p[k] === false : p[k]));
}

/** Volta fonte e preferências de acessibilidade ao padrão. */
function restaurarAcessibilidade() {
  try {
    localStorage.removeItem(CHAVE_FONTE_PX);
    localStorage.removeItem(CHAVE_BRILHO);
    localStorage.removeItem(CHAVE_A11Y);
  } catch {}
  aplicarA11y({});
  aplicarFontePx(FONTE_PADRAO);
  aplicarBrilho(BRILHO_PADRAO);
}

function lerFontePx(): number {
  return ler<number>(CHAVE_FONTE_PX, FONTE_PADRAO);
}

/* --------------------------------------------------------------- progresso */

export function vistas(): Progresso {
  return ler<Progresso>(CHAVE_PROGRESSO, {});
}

function marcar(id: string, vista: boolean) {
  const p = vistas();
  if (vista) p[id] = Date.now();
  else delete p[id];
  return gravar(CHAVE_PROGRESSO, p);
}

/** Pinta as listas: cada item com data-aula-id ganha data-vista. */
function refletirProgresso() {
  const p = vistas();
  document.querySelectorAll<HTMLElement>('[data-aula-id]').forEach((el) => {
    const vista = Boolean(p[el.dataset.aulaId!]);
    el.dataset.vista = String(vista);
    // O check verde é só visual: o leitor de tela recebe a mesma informação em texto.
    const sr = el.querySelector('[data-vista-texto]');
    if (sr) sr.textContent = vista ? 'Aula já vista.' : '';
  });

  document.querySelectorAll<HTMLElement>('[data-progresso-de]').forEach((el) => {
    const ids = (el.dataset.progressoDe || '').split(' ').filter(Boolean);
    if (!ids.length) return;
    const feitas = ids.filter((id) => p[id]).length;
    const pct = Math.round((feitas / ids.length) * 100);
    el.style.setProperty('--pct', `${pct}%`);
    el.dataset.pct = String(pct);
    const texto = el.querySelector('[data-progresso-texto]');
    if (texto) texto.textContent = `${feitas} de ${ids.length}`;
    const barra = el.querySelector<HTMLElement>('[data-progresso-barra]');
    if (barra) {
      barra.style.transform = `scaleX(${pct / 100})`;
      // Só anuncia em quem de fato é um progressbar. As barras decorativas
      // são aria-hidden: o número já está escrito ao lado, em texto.
      const trilho = barra.parentElement;
      if (trilho?.getAttribute('role') === 'progressbar') {
        trilho.setAttribute('aria-valuenow', String(pct));
      }
    }
    el.dataset.completo = String(feitas === ids.length && ids.length > 0);
  });

  atualizarBotaoVista();
}

function atualizarBotaoVista() {
  const btn = document.querySelector<HTMLElement>('[data-acao="marcar-aula"]');
  if (!btn) return;
  const id = btn.dataset.aula!;
  const vista = Boolean(vistas()[id]);
  // Sem aria-pressed: o próprio rótulo muda ("Marcar como vista" / "Aula concluída").
  // Os dois juntos fariam o leitor dizer "Aula concluída, pressionado".
  btn.dataset.vista = String(vista);
  const icone = btn.querySelector('i');
  if (icone) icone.className = `fa-solid fa-${vista ? 'circle-check' : 'circle'}`;
  const rotulo = btn.querySelector('[data-rotulo]');
  if (rotulo) rotulo.textContent = vista ? 'Aula concluída' : 'Marcar como vista';
}

/** Guarda a última aula aberta para o card "continuar de onde parou". */
function registrarUltima(el: HTMLElement) {
  gravar(CHAVE_ULTIMA, {
    id: el.dataset.aula,
    titulo: el.dataset.titulo,
    materia: el.dataset.materia,
    href: location.pathname,
    ts: Date.now(),
  });
}

/* ------------------------------------------------------------------- busca */

let indice: AulaBusca[] | null = null;
let carregando: Promise<AulaBusca[]> | null = null;

function carregarIndice(): Promise<AulaBusca[]> {
  if (indice) return Promise.resolve(indice);
  if (carregando) return carregando;
  carregando = fetch(`${base()}aulas.json`.replace(/\/{2,}/g, '/'))
    .then((r) => r.json())
    .then((dados: AulaBusca[]) => {
      indice = dados;
      return dados;
    })
    .catch(() => {
      carregando = null;
      return [];
    });
  return carregando;
}

function abrirBusca(termoInicial = '') {
  const dialogo = document.getElementById('busca') as HTMLDialogElement | null;
  if (!dialogo) return;
  const campo = dialogo.querySelector<HTMLInputElement>('[data-busca-campo]')!;
  if (!dialogo.open) dialogo.showModal();
  campo.value = termoInicial;
  campo.focus();
  campo.select();
  carregarIndice().then(() => filtrarBusca());
}

function fecharBusca() {
  (document.getElementById('busca') as HTMLDialogElement | null)?.close();
}

function filtrarBusca() {
  const dialogo = document.getElementById('busca') as HTMLDialogElement | null;
  if (!dialogo) return;
  const campo = dialogo.querySelector<HTMLInputElement>('[data-busca-campo]')!;
  const lista = dialogo.querySelector<HTMLElement>('[data-busca-lista]')!;
  const vazio = dialogo.querySelector<HTMLElement>('[data-busca-vazio]')!;
  const contador = dialogo.querySelector<HTMLElement>('[data-busca-contador]');

  const termo = normalizar(campo.value.trim());
  const dados = indice ?? [];
  const p = vistas();

  const resultados = (
    termo
      ? dados.filter((a) => normalizar(`${a.t} ${a.m} ${a.a}`).includes(termo))
      : dados.filter((a) => !p[a.id]) // sem termo: sugere o que ainda falta ver
  ).slice(0, 40);

  lista.innerHTML = resultados
    .map(
      (a, i) => `
      <li role="presentation">
        <a class="busca-item" id="busca-item-${i}" role="option" aria-selected="false" tabindex="-1"
           href="${a.h}" data-indice="${i}" data-vista="${Boolean(p[a.id])}">
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}${p[a.id] ? '<span class="apenas-leitor"> · aula já vista</span>' : ''}</span>
          </span>
          <i class="fa-solid fa-${p[a.id] ? 'circle-check' : 'arrow-right'} busca-item__marca" aria-hidden="true"></i>
        </a>
      </li>`
    )
    .join('');

  vazio.hidden = resultados.length > 0;
  if (!resultados.length) campo.removeAttribute('aria-activedescendant');
  if (contador) {
    contador.textContent = termo
      ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`
      : 'Sugestões do que ainda falta ver';
  }
  destacarBusca(0);
}

function escapar(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function destacarBusca(indiceAlvo: number) {
  const itens = document.querySelectorAll<HTMLElement>('#busca .busca-item');
  if (!itens.length) return;
  const alvo = (indiceAlvo + itens.length) % itens.length;
  itens.forEach((el, i) => {
    el.setAttribute('data-ativo', String(i === alvo));
    el.setAttribute('aria-selected', String(i === alvo));
  });
  // O foco fica no campo; o leitor de tela acompanha o destaque por aqui.
  document.querySelector('#busca [data-busca-campo]')?.setAttribute('aria-activedescendant', itens[alvo].id);
  itens[alvo].scrollIntoView({ block: 'nearest' });
}

function moverBusca(delta: number) {
  const itens = [...document.querySelectorAll<HTMLElement>('#busca .busca-item')];
  if (!itens.length) return;
  const atual = itens.findIndex((el) => el.dataset.ativo === 'true');
  destacarBusca((atual < 0 ? 0 : atual) + delta);
}

/* -------------------------------------------------------------- hub */

interface Ultima {
  id?: string;
  titulo?: string;
  materia?: string;
  href?: string;
  ts?: number;
}

function montarHub() {
  const hub = document.querySelector('[data-hub]');
  if (!hub) return;

  // "Continuar de onde parou": última aula aberta que ainda não foi concluída.
  const ultima = ler<Ultima>(CHAVE_ULTIMA, {});
  const bloco = hub.querySelector<HTMLElement>('[data-continuar]');
  if (bloco && ultima.href && ultima.titulo) {
    const concluida = Boolean(ultima.id && vistas()[ultima.id]);
    bloco.querySelector<HTMLAnchorElement>('[data-continuar-link]')!.href = ultima.href;
    bloco.querySelector('[data-continuar-titulo]')!.textContent = ultima.titulo;
    bloco.querySelector('[data-continuar-meta]')!.textContent =
      `${ultima.materia ?? 'ENEM'} · ${concluida ? 'você já concluiu — vale reler' : 'retomar a leitura'}`;
    bloco.hidden = false;
  }

  // Vistas recentemente: as 5 últimas marcações, da mais nova para a mais velha.
  const secao = hub.querySelector<HTMLElement>('[data-recentes]');
  const lista = hub.querySelector<HTMLElement>('[data-recentes-lista]');
  if (!secao || !lista) return;

  const p = vistas();
  const ids = Object.keys(p);
  if (!ids.length) return;

  carregarIndice().then((dados) => {
    const porId = new Map(dados.map((a) => [a.id, a]));
    const recentes = ids
      .filter((id) => porId.has(id))
      .sort((a, b) => p[b] - p[a])
      .slice(0, 5)
      .map((id) => porId.get(id)!);
    if (!recentes.length) return;

    lista.innerHTML = recentes
      .map(
        (a) => `
      <li>
        <a class="busca-item" href="${a.h}" data-vista="true">
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}</span>
          </span>
          <i class="fa-solid fa-circle-check busca-item__marca" aria-hidden="true"></i>
        </a>
      </li>`
      )
      .join('');
    secao.hidden = false;
  });
}

/* ------------------------------------------------- painel de progresso */

function montarProgresso() {
  const alvo = document.querySelector<HTMLElement>('[data-painel-progresso]');
  if (!alvo) return;

  carregarIndice().then((dados) => {
    if (!dados.length) {
      alvo.innerHTML = '<p class="painel__carregando">Não foi possível carregar o índice de aulas.</p>';
      return;
    }

    const p = vistas();
    const feitas = dados.filter((a) => p[a.id]).length;
    const pct = Math.round((feitas / dados.length) * 100);

    // Agrupa por área, preservando a ordem em que as áreas aparecem no índice.
    const areas = new Map<string, { total: number; feitas: number; cor: string }>();
    for (const a of dados) {
      const linha = areas.get(a.a) ?? { total: 0, feitas: 0, cor: a.c };
      linha.total += 1;
      if (p[a.id]) linha.feitas += 1;
      areas.set(a.a, linha);
    }

    const frase =
      pct === 0
        ? 'Comece por onde quiser — o caderno guarda o resto.'
        : pct === 100
          ? 'Caderno inteiro revisado. Respeito.'
          : `Faltam ${dados.length - feitas} ${dados.length - feitas === 1 ? 'aula' : 'aulas'} para fechar o caderno.`;

    alvo.innerHTML = `
      <div class="prog-resumo">
        <div class="prog-anel" style="--pct: 0"><span>0%</span></div>
        <div class="prog-resumo__texto">
          <strong>${feitas} de ${dados.length} aulas vistas</strong>
          <span>${escapar(frase)}</span>
        </div>
      </div>
      <ul class="prog-lista">
        ${[...areas.entries()]
          .map(
            ([nome, l]) => `
          <li class="prog-linha">
            <span class="prog-linha__nome">${escapar(nome)}</span>
            <span class="prog-linha__num">${l.feitas}/${l.total}</span>
            <span class="prog-barra" role="progressbar" aria-label="${escapar(nome)}"
                  aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((l.feitas / l.total) * 100)}">
              <i style="--cor: ${l.cor}" data-largura="${(l.feitas / l.total) * 100}"></i>
            </span>
          </li>`
          )
          .join('')}
      </ul>`;

    // Anima os valores no frame seguinte, para as transições valerem.
    requestAnimationFrame(() => {
      const anel = alvo.querySelector<HTMLElement>('.prog-anel');
      if (anel) {
        anel.style.setProperty('--pct', String(pct));
        anel.querySelector('span')!.textContent = `${pct}%`;
      }
      alvo.querySelectorAll<HTMLElement>('.prog-barra i').forEach((b) => {
        b.style.transform = `scaleX(${Number(b.dataset.largura) / 100})`;
      });
    });
  });
}

/* ---------------------------------------------------------------- atalhos */

function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return (
    alvo.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
  );
}

/** Atalhos de UMA tecla (/, ← →) podem ser desligados no painel de acessibilidade
 *  (WCAG 2.1.4). Ctrl+K tem modificador e fica sempre ativo. */
function atalhosDeUmaTecla(): boolean {
  return document.documentElement.dataset.atalhos !== 'nao';
}

/** Com a página ampliada a ponto de rolar na horizontal, as setas ← → são de rolagem. */
function rolaNaHorizontal(): boolean {
  const raiz = document.documentElement;
  return raiz.scrollWidth > raiz.clientWidth + 1;
}

function ligarAtalhos() {
  if ((window as any).__cdtAtalhos) return;
  (window as any).__cdtAtalhos = true;

  document.addEventListener('keydown', (e) => {
    const buscaAberta = (document.getElementById('busca') as HTMLDialogElement | null)?.open;

    // O atalho que abre a busca também a fecha.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (buscaAberta) fecharBusca();
      else abrirBusca();
      return;
    }

    if (buscaAberta) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moverBusca(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moverBusca(-1);
      } else if (e.key === 'Enter') {
        const ativo = document.querySelector<HTMLAnchorElement>('#busca .busca-item[data-ativo="true"]');
        if (ativo) {
          e.preventDefault();
          ativo.click();
        }
      }
      return;
    }

    if (e.defaultPrevented || ehCampoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!atalhosDeUmaTecla() || document.querySelector('dialog[open]')) return;

    if (e.key === '/') {
      e.preventDefault();
      abrirBusca();
    } else if (e.key === 'ArrowLeft' && !rolaNaHorizontal()) {
      // O pager do fim da aula (aula anterior) tem prioridade sobre o botão "voltar" do topo.
      (document.querySelector<HTMLAnchorElement>('.pager [data-pager="anterior"]') ??
        document.querySelector<HTMLAnchorElement>('[data-pager="anterior"]'))?.click();
    } else if (e.key === 'ArrowRight' && !rolaNaHorizontal()) {
      document.querySelector<HTMLAnchorElement>('[data-pager="proxima"]')?.click();
    }
  });

  // Delegação global: os botões são recriados a cada navegação.
  document.addEventListener('click', (e) => {
    const alvo = e.target;
    if (!(alvo instanceof Element)) return;

    const acao = alvo.closest<HTMLElement>('[data-acao]');
    if (acao) {
      switch (acao.dataset.acao) {
        case 'tema':
          alternarTema(acao);
          return;
        case 'restaurar-a11y':
          restaurarAcessibilidade();
          toast('Acessibilidade restaurada ao padrão', 'rotate-left');
          return;
        case 'acessibilidade':
        case 'texto': {
          const dlg = document.getElementById('acessibilidade');
          if (dlg instanceof HTMLDialogElement) dlg.showModal();
          return;
        }
        case 'busca':
          abrirBusca();
          return;
        case 'marcar-aula': {
          const id = acao.dataset.aula!;
          const virou = !vistas()[id];
          if (marcar(id, virou)) {
            refletirProgresso();
            toast(virou ? 'Aula marcada como vista' : 'Marcação removida', virou ? 'circle-check' : 'rotate-left');
          } else {
            toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
          }
          return;
        }
        case 'zerar-progresso': {
          // Apaga dados do usuário sem volta: pede confirmação (WCAG 3.3.4).
          if (!confirm('Zerar todo o progresso deste navegador? Isso não pode ser desfeito.')) return;
          const tambemA11y = confirm(
            'Restaurar também os ajustes de acessibilidade (tamanho do texto, contraste, espaçamento etc.) ao padrão?'
          );
          if (gravar(CHAVE_PROGRESSO, {})) {
            if (tambemA11y) restaurarAcessibilidade();
            try {
              localStorage.removeItem(CHAVE_ULTIMA);
            } catch {}
            refletirProgresso();
            toast('Progresso zerado', 'rotate-left');
            document.querySelectorAll<HTMLElement>('[data-recarrega-progresso]').forEach((el) => {
              el.dataset.recarrega = String(Date.now());
            });
            window.setTimeout(() => location.reload(), 600);
          }
          return;
        }
        case 'sortear': {
          carregarIndice().then((dados) => {
            if (!dados.length) return;
            const p = vistas();
            const pool = dados.filter((a) => !p[a.id]);
            const escolhida = (pool.length ? pool : dados)[
              Math.floor(Math.random() * (pool.length ? pool.length : dados.length))
            ];
            toast(`Sorteado: ${escolhida.t}`, 'dice');
            window.setTimeout(() => (location.href = escolhida.h), 450);
          });
          return;
        }
        case 'topo':
          window.scrollTo({ top: 0, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
          // O botão some ao chegar no topo: o foco vai junto, para o teclado não se perder.
          document.querySelector<HTMLElement>('[data-marca]')?.focus({ preventScroll: true });
          return;
        case 'copiar-link': {
          navigator.clipboard
            ?.writeText(location.href)
            .then(() => toast('Link da aula copiado', 'copy'))
            .catch(() => toast('Não foi possível copiar', 'xmark'));
          return;
        }
      }
    }

    const chave = alvo.closest<HTMLElement>('[data-a11y]');
    if (chave) {
      alternarA11y(chave.dataset.a11y!);
      return;
    }

    // Painéis (progresso, ajuda) e diálogos.
    const gatilho = alvo.closest<HTMLElement>('[data-abre]');
    if (gatilho) {
      const dlg = document.getElementById(gatilho.dataset.abre!);
      if (dlg instanceof HTMLDialogElement) {
        dlg.showModal();
        if (dlg.id === 'progresso') montarProgresso();
      }
      return;
    }

    const fechar = alvo.closest<HTMLElement>('[data-fecha]');
    if (fechar) {
      fechar.closest('dialog')?.close();
      return;
    }

    // Clique no backdrop fecha o diálogo.
    if (alvo.tagName === 'DIALOG') (alvo as HTMLDialogElement).close();
  });

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target?.matches?.('[data-busca-campo]')) {
      filtrarBusca();
    } else if (target?.matches?.('[data-slider-fonte]')) {
      const slider = target as HTMLInputElement;
      const px = Number(slider.value);
      gravar(CHAVE_FONTE_PX, px);
      aplicarFontePx(px);
    } else if (target?.matches?.('[data-slider-brilho]')) {
      const pct = Number((target as HTMLInputElement).value);
      gravar(CHAVE_BRILHO, pct);
      aplicarBrilho(pct);
    }
  });
}

/* ------------------------------------------------------ miniatura da marca */

let observadorMarca: IntersectionObserver | null = null;

function movimentoReduzido(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.movimento === 'sim'
  );
}

function ligarMarcaMini() {
  const marca = document.querySelector('[data-marca]');
  const mini = document.querySelector<HTMLElement>('[data-marca-mini]');
  if (!marca || !mini) return;

  observadorMarca?.disconnect();
  observadorMarca = new IntersectionObserver(
    ([entrada]) => {
      const escondida = !entrada.isIntersecting;
      mini.dataset.visivel = String(escondida);
      // Fora de vista, a miniatura também sai da ordem de leitura e de foco.
      mini.setAttribute('aria-hidden', String(!escondida));
      mini.tabIndex = escondida ? 0 : -1;
      // O botão "voltar ao topo" aparece junto: a marca grande fora de vista quer dizer
      // que a página já rolou.
      document.querySelectorAll<HTMLElement>('[data-topo], [data-flutuante]').forEach((el) => {
        el.dataset.visivel = String(escondida);
        el.tabIndex = escondida ? 0 : -1;
        el.setAttribute('aria-hidden', String(!escondida));
      });
    },
    { threshold: 0 }
  );
  observadorMarca.observe(marca);
}

/* ------------------------------------------------------- acessibilidade */

const CHAVE_A11Y = 'cdt:a11y';
type Preferencias = Record<string, boolean>;

function preferencias(): Preferencias {
  return ler<Preferencias>(CHAVE_A11Y, {});
}

/** Cada preferência vira um data-attribute no <html>; o CSS faz o resto. */
function aplicarA11y(p: Preferencias) {
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

function alternarA11y(chave: string) {
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

/* --------------------------------------------------------- blocos retráteis */

const CHAVE_DOBRAS = 'cdt:dobras';

function ligarDobras() {
  const dobras = ler<Record<string, boolean>>(CHAVE_DOBRAS, {});
  document.querySelectorAll<HTMLDetailsElement>('details[data-dobra]').forEach((el) => {
    const chave = el.dataset.dobra!;
    if (chave in dobras) el.open = dobras[chave];
    el.addEventListener('toggle', () => {
      const atual = ler<Record<string, boolean>>(CHAVE_DOBRAS, {});
      atual[chave] = el.open;
      gravar(CHAVE_DOBRAS, atual);
    });
  });
}


/* ------------------------------------------- marcação automática da aula */

function ligarAulaAtual() {
  const marcador = document.querySelector<HTMLElement>('[data-acao="marcar-aula"]');
  if (!marcador) return;
  const id = marcador.dataset.aula!;
  registrarUltima(marcador);

  // Depois de 25s na página (ou ao chegar no fim) a aula conta como vista.
  const concluir = () => {
    if (vistas()[id]) return;
    marcar(id, true);
    refletirProgresso();
    toast('Aula marcada como vista', 'circle-check');
  };

  const timer = window.setTimeout(concluir, 25000);
  const fim = document.querySelector('[data-fim-da-aula]');
  if (fim && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((x) => x.isIntersecting)) {
          obs.disconnect();
          concluir();
        }
      },
      { rootMargin: '0px 0px -20% 0px' }
    );
    obs.observe(fim);
  }
  window.addEventListener('beforeunload', () => window.clearTimeout(timer), { once: true });
}

/* ---------------------------------------------------------------- arranque */

function iniciar() {
  aplicarTema(temaSalvo());
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
  refletirProgresso();
  montarHub();
  ligarAtalhos();
  ligarDobras();
  ligarMarcaMini();
  ligarAulaAtual();
  // Ordem importa: o quiz lê os filhos do artigo, os tópicos os embrulham em seguida e
  // as barras de rolagem medem a página já com os tópicos no lugar.
  montarQuiz();
  montarTopicos();
  montarSumario();
  montarBarrasDeRolagem();
}

document.addEventListener('astro:page-load', iniciar);
// Roda no documento novo, antes de pintar: evita perder tema e fonte (e o flash).
document.addEventListener('astro:after-swap', () => {
  aplicarTema(temaSalvo());
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
});
if (document.readyState !== 'loading') iniciar();
else document.addEventListener('DOMContentLoaded', iniciar, { once: true });

// Exposto para depuração e para trechos inline que precisam avisar o usuário.
(window as any).cdt = { toast, vistas, abrirBusca };
