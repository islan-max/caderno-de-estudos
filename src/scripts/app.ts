/* ---------------------------------------------------------------------------
 * Comportamento do caderno no navegador.
 *
 * Tudo aqui é progressivo: sem JS a página continua navegável, só perde
 * as conveniências (tema, busca, progresso, atalhos).
 *
 * Nada sai do dispositivo — o progresso vive só no localStorage do usuário.
 * ------------------------------------------------------------------------- */

const CHAVE_TEMA = 'cdt:tema';
const CHAVE_TEXTO = 'cdt:texto';
const CHAVE_PROGRESSO = 'cdt:progresso';
const CHAVE_ULTIMA = 'cdt:ultima';

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
  el.setAttribute('role', 'status');
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

  const cor = tema === 'escuro' ? '#171a21' : '#edeadf';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);

  document.querySelectorAll<HTMLElement>('[data-acao="tema"]').forEach((btn) => {
    const escuro = tema === 'escuro';
    btn.setAttribute('aria-pressed', String(escuro));
    btn.setAttribute('title', escuro ? 'Voltar para o tema claro' : 'Usar o tema escuro');
    const icone = btn.querySelector('i');
    if (icone) icone.className = `fa-solid fa-${escuro ? 'sun' : 'moon'}`;
    const rotulo = btn.querySelector('[data-rotulo]');
    if (rotulo) rotulo.textContent = escuro ? 'Claro' : 'Escuro';
  });
}

function temaAtual(): 'claro' | 'escuro' {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

function alternarTema() {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(novo);
  gravar(CHAVE_TEMA, novo);
  toast(novo === 'escuro' ? 'Tema escuro ativado' : 'Tema claro ativado', novo === 'escuro' ? 'moon' : 'sun');
}

/* ------------------------------------------------------- tamanho do texto */

const NIVEIS_TEXTO = ['normal', 'grande', 'maior'] as const;
type NivelTexto = (typeof NIVEIS_TEXTO)[number];

function aplicarTexto(nivel: NivelTexto) {
  const raiz = document.documentElement;
  if (nivel === 'normal') delete raiz.dataset.texto;
  else raiz.dataset.texto = nivel;

  document.querySelectorAll<HTMLElement>('[data-acao="texto"]').forEach((btn) => {
    btn.setAttribute('title', `Tamanho do texto: ${nivel}`);
    btn.dataset.nivel = nivel;
  });
}

function avancarTexto() {
  const atual = (document.documentElement.dataset.texto ?? 'normal') as NivelTexto;
  const proximo = NIVEIS_TEXTO[(NIVEIS_TEXTO.indexOf(atual) + 1) % NIVEIS_TEXTO.length];
  aplicarTexto(proximo);
  gravar(CHAVE_TEXTO, proximo);
  const nomes: Record<NivelTexto, string> = {
    normal: 'Texto no tamanho padrão',
    grande: 'Texto um pouco maior',
    maior: 'Texto no tamanho máximo',
  };
  toast(nomes[proximo], 'font');
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
    el.dataset.vista = String(Boolean(p[el.dataset.aulaId!]));
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
      barra.parentElement?.setAttribute('aria-valuenow', String(pct));
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
  btn.setAttribute('aria-pressed', String(vista));
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
      <li>
        <a class="busca-item" href="${a.h}" data-indice="${i}" data-vista="${Boolean(p[a.id])}">
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}</span>
          </span>
          <i class="fa-solid fa-${p[a.id] ? 'circle-check' : 'arrow-right'} busca-item__marca" aria-hidden="true"></i>
        </a>
      </li>`
    )
    .join('');

  vazio.hidden = resultados.length > 0;
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
  itens.forEach((el, i) => el.setAttribute('data-ativo', String(i === alvo)));
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

function ligarAtalhos() {
  if ((window as any).__cdtAtalhos) return;
  (window as any).__cdtAtalhos = true;

  document.addEventListener('keydown', (e) => {
    const buscaAberta = (document.getElementById('busca') as HTMLDialogElement | null)?.open;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      abrirBusca();
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

    if (ehCampoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '/') {
      e.preventDefault();
      abrirBusca();
    } else if (e.key === 'ArrowLeft') {
      document.querySelector<HTMLAnchorElement>('[data-pager="anterior"]')?.click();
    } else if (e.key === 'ArrowRight') {
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
          alternarTema();
          return;
        case 'texto':
          avancarTexto();
          return;
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
          if (gravar(CHAVE_PROGRESSO, {})) {
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if ((e.target as HTMLElement)?.matches?.('[data-busca-campo]')) filtrarBusca();
  });
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

/* ----------------------------------------------------- rolagem / cabeçalho */

function ligarRolagem() {
  const barra = document.querySelector<HTMLElement>('[data-leitura]');
  if (!barra) return;

  // A altura do documento é medida fora do laço de rolagem. Lê-la a cada
  // quadro forçava o navegador a recalcular o layout no meio da rolagem —
  // era leitura de layout síncrona, e aparecia como engasgo.
  let total = 0;
  const medir = () => {
    total = document.documentElement.scrollHeight - window.innerHeight;
  };

  let ticking = false;
  const aoRolar = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      barra.style.transform = `scaleX(${total > 0 ? Math.min(window.scrollY / total, 1) : 0})`;
      ticking = false;
    });
  };

  medir();
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', () => {
    medir();
    aoRolar();
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
  aplicarTema(temaAtual());
  aplicarTexto((document.documentElement.dataset.texto ?? 'normal') as NivelTexto);
  refletirProgresso();
  montarHub();
  ligarAtalhos();
  ligarDobras();
  ligarRolagem();
  ligarAulaAtual();
}

document.addEventListener('astro:page-load', iniciar);
if (document.readyState !== 'loading') iniciar();
else document.addEventListener('DOMContentLoaded', iniciar, { once: true });

// Exposto para depuração e para trechos inline que precisam avisar o usuário.
(window as any).cdt = { toast, vistas, abrirBusca };
