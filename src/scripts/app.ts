/* ---------------------------------------------------------------------------
 * Comportamento do caderno no navegador.
 *
 * Tudo aqui é progressivo: sem JS a página continua navegável, só perde
 * as conveniências (tema, busca, progresso, atalhos).
 *
 * Nada sai do dispositivo — o progresso vive só no localStorage do usuário.
 * ------------------------------------------------------------------------- */

// Registra <circle-progress>, o anel de progresso (SVG) das trilhas e do painel de progresso.
import 'js-circle-progress';
import { montarQuiz } from './quiz';
import { montarTopicos } from './topicos';
import { montarSumario } from './sumario';
import { montarBarrasDeRolagem } from './barra-rolagem';

const CHAVE_TEMA = 'cdt:tema';
const CHAVE_PROGRESSO = 'cdt:progresso';
const CHAVE_ULTIMA = 'cdt:ultima';
const CHAVE_FONTE_PX = 'cdt:fonte-px';
const CHAVE_DISPENSADOS = 'cdt:dispensados';
const CHAVE_ANDAMENTO = 'cdt:andamento';

/** Quanto de cada aula já foi feito: leitura (0 a 100), se as questões foram respondidas e se a
 *  aula tem questões. A aula só conclui com tudo; sem questões, a leitura vale 100%. */
interface Andamento {
  l: number;
  q: number;
  z: number;
  /** Quando foi aberta pela última vez (ms). */
  t?: number;
}
/** Parte do total que as questões respondidas valem (fixa). A leitura vale o resto. */
const PESO_QUESTOES = 20;

function andamentos(): Record<string, Andamento> {
  return ler<Record<string, Andamento>>(CHAVE_ANDAMENTO, {});
}

function percentualDaAula(a?: Andamento): number {
  if (!a) return 0;
  const bruto = a.z ? (a.l * (100 - PESO_QUESTOES)) / 100 + (a.q ? PESO_QUESTOES : 0) : a.l;
  return Math.min(100, Math.round(bruto));
}

type Progresso = Record<string, number>;

interface AulaBusca {
  id: string;
  t: string;
  m: string;
  /** aba e matéria: "enem/fisica" (a mesma matéria pode existir em mais de uma aba) */
  s: string;
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

let transicaoDoTema: ViewTransition | null = null;

function alternarTema(origem?: HTMLElement | null) {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  gravar(CHAVE_TEMA, novo);

  const raiz = document.documentElement;
  const reduzido =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || raiz.dataset.movimento === 'sim';

  // As cores mudam de uma vez, sem as transições de cor do site: com elas, cada elemento
  // recalculava o estilo duas vezes (antes e depois) e repintava a cada quadro, o que
  // travava a troca em páginas longas. A flag liga junto com o tema novo e sai depois.
  const aplicarSemTransicoes = () => {
    raiz.dataset.temaInstantaneo = '';
    aplicarTema(novo);
  };
  const liberarTransicoes = () => delete raiz.dataset.temaInstantaneo;

  if (reduzido || typeof document.startViewTransition !== 'function') {
    aplicarSemTransicoes();
    requestAnimationFrame(() => requestAnimationFrame(liberarTransicoes));
  } else {
    // O tema novo se revela em círculo a partir do botão, em vez de piscar a página toda. O
    // círculo é uma animação do navegador (Web Animations) sobre a imagem da página: gravar o
    // centro e o raio como variáveis CSS no <html> fazia o navegador recalcular o estilo de
    // todos os elementos só para isso.
    const caixa = origem?.getBoundingClientRect();
    const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth / 2;
    const y = caixa ? caixa.top + caixa.height / 2 : 0;
    const raio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    raiz.dataset.trocandoTema = novo;
    const transicao = document.startViewTransition(aplicarSemTransicoes);
    transicao.ready
      .then(() => {
        // Para o claro, o sol nasce (a página nova abre em círculo); para o escuro, a antiga fecha.
        const abre = novo === 'claro';
        const circulo = (r: number) => `circle(${r}px at ${x}px ${y}px)`;
        raiz.animate(
          { clipPath: abre ? [circulo(0), circulo(raio)] : [circulo(raio), circulo(0)] },
          {
            duration: abre ? 500 : 450,
            easing: abre ? 'cubic-bezier(0.25, 0.6, 0.3, 1)' : 'cubic-bezier(0.6, 0.1, 0.75, 0.4)',
            fill: 'forwards',
            pseudoElement: abre ? '::view-transition-new(root)' : '::view-transition-old(root)',
          }
        );
      })
      .catch(() => {});
    // Num duplo clique a segunda troca aborta a primeira: só a transição mais recente limpa as
    // flags, senão a segunda perderia a ordem das camadas e as transições desligadas.
    transicaoDoTema = transicao;
    transicao.finished
      .catch(() => {})
      .finally(() => {
        if (transicaoDoTema !== transicao) return;
        delete raiz.dataset.trocandoTema;
        liberarTransicoes();
      });
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

/* ------------------------------------------------------ confirmação */

interface PedidoConfirmacao {
  titulo: string;
  texto: string;
  confirmar: string;
  /** Opção extra, com caixa de marcar (desmarcada por padrão). */
  extra?: string;
}

/** Janela de confirmação da própria página (o confirm() nativo é bloqueado em alguns
 *  navegadores e devolve "não" sem mostrar nada). Cancelar, Esc e clique fora devolvem false. */
function confirmarAcao(p: PedidoConfirmacao): Promise<{ ok: boolean; extra: boolean }> {
  const dlg = document.getElementById('confirmar');
  if (!(dlg instanceof HTMLDialogElement)) return Promise.resolve({ ok: false, extra: false });

  dlg.querySelector('[data-confirmar-titulo]')!.textContent = p.titulo;
  dlg.querySelector('[data-confirmar-texto]')!.textContent = p.texto;
  dlg.querySelector('[data-confirmar-ok]')!.textContent = p.confirmar;
  const extra = dlg.querySelector<HTMLElement>('[data-confirmar-extra]')!;
  const caixa = dlg.querySelector<HTMLInputElement>('[data-confirmar-extra-caixa]')!;
  extra.hidden = !p.extra;
  caixa.checked = false;
  dlg.querySelector('[data-confirmar-extra-texto]')!.textContent = p.extra ?? '';

  return new Promise((resolver) => {
    let respondido = false;
    const responder = (ok: boolean) => {
      if (respondido) return;
      respondido = true;
      const marcado = ok && Boolean(p.extra) && caixa.checked;
      if (dlg.open) dlg.close();
      resolver({ ok, extra: marcado });
    };
    dlg.querySelector('[data-confirmar-ok]')!.addEventListener('click', () => responder(true), { once: true });
    dlg.addEventListener('close', () => responder(false), { once: true });
    dlg.showModal();
  });
}

// Outros scripts da página (folha de redação) usam a mesma janela.
(window as unknown as { cdtConfirmar?: typeof confirmarAcao }).cdtConfirmar = confirmarAcao;

async function zerarProgresso() {
  // Apaga dados do usuário sem volta: pede confirmação (WCAG 3.3.4).
  const r = await confirmarAcao({
    titulo: 'Zerar o progresso?',
    texto:
      'As aulas que você marcou como vistas e o andamento de cada uma voltam ao zero neste navegador. Isso não pode ser desfeito.',
    confirmar: 'Zerar progresso',
    extra: 'Restaurar também os ajustes de acessibilidade (tamanho do texto, contraste etc.) ao padrão',
  });
  if (!r.ok) return;
  if (!gravar(CHAVE_PROGRESSO, {})) {
    toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
    return;
  }
  if (r.extra) restaurarAcessibilidade();
  try {
    localStorage.removeItem(CHAVE_ULTIMA);
    localStorage.removeItem(CHAVE_ANDAMENTO);
  } catch {}
  refletirProgresso();
  toast('Progresso zerado', 'rotate-left');
  document.querySelectorAll<HTMLElement>('[data-recarrega-progresso]').forEach((el) => {
    el.dataset.recarrega = String(Date.now());
  });
  window.setTimeout(() => location.reload(), 600);
}

/* ------------------------------------------------- avisos dispensáveis */

function dispensados(): string[] {
  return ler<string[]>(CHAVE_DISPENSADOS, []);
}

/** O CSS esconde o aviso quando a chave dele está em data-dispensados no <html>. */
function aplicarDispensados() {
  const lista = dispensados();
  if (lista.length) document.documentElement.dataset.dispensados = lista.join(' ');
  else delete document.documentElement.dataset.dispensados;
}

function dispensar(chave: string) {
  const lista = dispensados();
  if (!lista.includes(chave)) lista.push(chave);
  gravar(CHAVE_DISPENSADOS, lista);
  aplicarDispensados();
  atualizarRestaurar();
  toast('Certo, não mostro mais isso', 'circle-check');
}

/** Volta fonte, preferências de acessibilidade e avisos dispensados ao padrão. */
function restaurarAcessibilidade() {
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
  const and = andamentos();
  document.querySelectorAll<HTMLElement>('[data-aula-id]').forEach((el) => {
    const vista = Boolean(p[el.dataset.aulaId!]);
    el.dataset.vista = String(vista);
    // O anel em volta do número da aula mostra o andamento só com cor; cheio só quando concluída.
    // O valor vai por atributo: vale antes e depois de o componente <circle-progress> ser registrado.
    const anel = el.querySelector('circle-progress');
    if (anel) {
      anel.setAttribute('animation', movimentoReduzido() ? 'none' : 'easeOutCubic');
      anel.setAttribute('value', String(vista ? 100 : Math.min(99, percentualDaAula(and[el.dataset.aulaId!]))));
    }
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

  // "Continuar de onde parou": o título é a aula em que a pessoa parou; a linha de baixo, menor,
  // diz qual aula vem a seguir (a próxima ainda não vista da matéria). A seta leva para onde
  // continuar: a própria aula, se ainda não foi concluída, ou a recomendada.
  const ultima = ler<Ultima>(CHAVE_ULTIMA, {});
  const bloco = hub.querySelector<HTMLElement>('[data-continuar]');
  if (bloco && ultima.href && ultima.titulo) {
    const materia = ultima.materia ?? 'ENEM';
    const parou = bloco.querySelector<HTMLAnchorElement>('[data-continuar-parou]')!;
    const rotulo = bloco.querySelector<HTMLElement>('[data-continuar-rotulo]')!;
    const proxima = bloco.querySelector<HTMLAnchorElement>('[data-continuar-proxima]')!;
    const seta = bloco.querySelector<HTMLAnchorElement>('[data-continuar-seta]')!;

    parou.href = ultima.href;
    parou.textContent = ultima.titulo;
    // O cartão leva a cor da matéria em que a pessoa parou (id: "enem/<matéria>/<tema>").
    const slugMateria = ultima.id?.split('/')[1];
    if (slugMateria) bloco.style.setProperty('--cor-continuar', `var(--color-${slugMateria})`);

    /** Define a linha de baixo: texto simples ou texto + link da aula recomendada. */
    const sugerir = (texto: string, destino?: { href: string; titulo: string }) => {
      rotulo.textContent = texto;
      proxima.hidden = !destino;
      if (destino) {
        proxima.href = destino.href;
        proxima.textContent = destino.titulo;
      }
      seta.href = destino?.href ?? ultima.href;
      seta.setAttribute('aria-label', `Continuar: ${destino?.titulo ?? ultima.titulo}`);
      bloco.hidden = false;
    };

    if (!ultima.id || !vistas()[ultima.id]) {
      sugerir(`Você parou aqui, em ${materia}. Continue de onde parou.`);
    } else {
      // Já concluída: enquanto o índice carrega, vale reler; depois aparece a aula recomendada.
      sugerir(`Você terminou esta aula, de ${materia}.`);
      carregarIndice().then((dados) => {
        const p = vistas();
        const i = dados.findIndex((a) => a.id === ultima.id);
        if (i < 0) return;
        const slug = dados[i].s;
        const naMateria = (a: AulaBusca) => a.s === slug && !p[a.id];
        const seguinte = dados.slice(i + 1).find(naMateria) ?? dados.find(naMateria);
        if (seguinte) {
          sugerir('Próxima aula:', { href: seguinte.h, titulo: `${seguinte.t} (${seguinte.m})` });
          return;
        }
        const outra = dados.find((a) => !p[a.id]);
        if (outra) {
          sugerir(`Você concluiu ${dados[i].m}. Sugestão:`, { href: outra.h, titulo: `${outra.t} (${outra.m})` });
        } else {
          sugerir('Você já viu todas as aulas do caderno.');
        }
      });
    }
  }


  // Vistas recentemente: todas as aulas já vistas, da mais nova para a mais velha. A lista
  // rola dentro da caixa e a seção pode ser recolhida (details, guardado em ligarDobras).
  const secao = hub.querySelector<HTMLElement>('[data-recentes]');
  const lista = hub.querySelector<HTMLElement>('[data-recentes-lista]');
  if (!secao || !lista) return;

  const p = vistas();
  const and = andamentos();
  // Entram as aulas concluídas e as que já foram abertas e lidas em parte.
  const ids = [...new Set([...Object.keys(p), ...Object.keys(and).filter((id) => and[id].l > 0 || and[id].q)])];
  if (!ids.length) return;

  carregarIndice().then((dados) => {
    const porId = new Map(dados.map((a) => [a.id, a]));
    const quando = (id: string) => Math.max(p[id] ?? 0, and[id]?.t ?? 0);
    const recentes = ids
      .filter((id) => porId.has(id))
      .sort((a, b) => quando(b) - quando(a))
      .map((id) => porId.get(id)!);
    if (!recentes.length) return;

    const dica = secao.querySelector('.acordeao__dica');
    if (dica) {
      dica.textContent =
        `${recentes.length} ${recentes.length === 1 ? 'aula' : 'aulas'}, ` +
        'da mais recente para a mais antiga';
    }

    lista.innerHTML = recentes
      .map(
        (a) => `
      <li>
        <a class="busca-item" href="${a.h}" ${p[a.id] ? 'data-vista="true"' : ''}>
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}${p[a.id] ? '' : ` · ${percentualDaAula(and[a.id])}% feito`}</span>
          </span>
          ${p[a.id] ? '<i class="fa-solid fa-circle-check busca-item__marca" aria-hidden="true"></i>' : ''}
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
        <div class="prog-anel">
          <circle-progress class="prog-anel__arco" value="0" max="100" text-format="none" aria-hidden="true"></circle-progress>
          <span>0%</span>
        </div>
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
        const arco = anel.querySelector('circle-progress');
        arco?.setAttribute('animation', movimentoReduzido() ? 'none' : 'easeOutCubic');
        arco?.setAttribute('animation-duration', '800');
        arco?.setAttribute('value', String(pct));
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
          if (!virou) {
            // Desmarcou na mão: o andamento zera e a aula não se conclui sozinha de novo nesta visita.
            semConclusaoAutomatica.add(id);
            const t = andamentos();
            delete t[id];
            gravar(CHAVE_ANDAMENTO, t);
          }
          if (marcar(id, virou)) {
            refletirProgresso();
            toast(virou ? 'Aula marcada como vista' : 'Marcação removida', virou ? 'circle-check' : 'rotate-left');
          } else {
            toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
          }
          return;
        }
        case 'zerar-progresso':
          zerarProgresso();
          return;
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

    const x = alvo.closest<HTMLElement>('[data-dispensar]');
    const aviso = x?.closest<HTMLElement>('[data-dispensavel]');
    if (aviso) {
      dispensar(aviso.dataset.dispensavel!);
      return;
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

/* ------------------------------------------------------ notinha solta (hover) */

/** Troca o balão nativo (atributo title) por uma etiqueta no estilo do caderno.
 *  O texto vai para data-nota; o title sai para o navegador não mostrar o balão dele, e o
 *  nome acessível é preservado (aria-label em botão só de ícone, aria-description no resto). */
function ligarNotasSoltas() {
  if ((window as any).__cdtNotas) return;
  (window as any).__cdtNotas = true;

  let alvo: HTMLElement | null = null;
  let espera = 0;

  const migrar = (el: HTMLElement): string => {
    const t = el.getAttribute('title');
    if (t) {
      el.dataset.nota = t;
      el.removeAttribute('title');
      const rotulo = el.getAttribute('aria-label');
      const visivel = el.textContent?.trim();
      if (!rotulo && !visivel) el.setAttribute('aria-label', t);
      else if (rotulo !== t && visivel !== t && !rotulo?.includes(t)) el.setAttribute('aria-description', t);
    }
    return el.dataset.nota ?? '';
  };

  const folha = (): HTMLElement => {
    let n = document.getElementById('nota-solta');
    if (!n) {
      n = document.createElement('div');
      n.id = 'nota-solta';
      n.className = 'nota-solta';
      n.setAttribute('role', 'tooltip');
      n.hidden = true;
      document.body.appendChild(n);
    }
    return n;
  };

  const esconder = () => {
    window.clearTimeout(espera);
    alvo = null;
    const n = document.getElementById('nota-solta');
    if (n) {
      n.dataset.visivel = 'false';
      n.hidden = true;
    }
  };

  const mostrar = (el: HTMLElement) => {
    const texto = migrar(el);
    if (!texto) return;
    alvo = el;
    const n = folha();
    n.textContent = texto;
    n.hidden = false;
    n.dataset.visivel = 'false';

    const r = el.getBoundingClientRect();
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    const margem = 8;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(margem, Math.min(x, window.innerWidth - w - margem));
    let y = r.bottom + 12;
    let lado = 'baixo';
    if (y + h > window.innerHeight - margem) {
      y = Math.max(margem, r.top - h - 12);
      lado = 'cima';
    }
    n.dataset.lado = lado;
    // A setinha aponta para o centro do elemento, mesmo quando a dica foi empurrada para dentro da tela.
    const seta = Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x));
    n.style.setProperty('--seta', `${Math.round(seta)}px`);
    n.style.left = `${Math.round(x)}px`;
    n.style.top = `${Math.round(y)}px`;
    requestAnimationFrame(() => {
      if (alvo === el) n.dataset.visivel = 'true';
    });
  };

  const dono = (e: Event): HTMLElement | null =>
    e.target instanceof Element ? e.target.closest<HTMLElement>('[title], [data-nota]') : null;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = dono(e);
    if (!el) return;
    migrar(el); // tira o title já, antes de o navegador mostrar o balão dele
    if (el === alvo) return;
    window.clearTimeout(espera);
    espera = window.setTimeout(() => mostrar(el), 280);
  });
  document.addEventListener('pointerout', (e) => {
    if (!alvo && !espera) return;
    const para = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    const el = dono(e);
    if (el && para && el.contains(para)) return;
    esconder();
  });
  document.addEventListener('focusin', (e) => {
    const el = dono(e);
    if (el && el.matches(':focus-visible')) mostrar(el);
  });
  document.addEventListener('focusout', esconder);
  document.addEventListener('pointerdown', esconder);
  document.addEventListener('scroll', esconder, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') esconder();
  });
  document.addEventListener('astro:before-swap', esconder);
}

/* ---------------------------------------------- cabeçalho fixo (marcadores) */

let observadorMarca: IntersectionObserver | null = null;
let observadorAbas: IntersectionObserver | null = null;

function movimentoReduzido(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.movimento === 'sim'
  );
}

function ligarCabecalhoFixo() {
  const marca = document.querySelector('[data-marca]');
  const abas = document.querySelector('[data-abas]');

  // A marca grande fora de vista quer dizer que a página já rolou: entra o botão
  // "voltar ao topo".
  observadorMarca?.disconnect();
  if (marca) {
    observadorMarca = new IntersectionObserver(
      ([entrada]) => {
        const escondida = !entrada.isIntersecting;
        document.querySelectorAll<HTMLElement>('[data-topo]').forEach((el) => {
          el.dataset.visivel = String(escondida);
          el.tabIndex = escondida ? 0 : -1;
          el.setAttribute('aria-hidden', String(!escondida));
        });
      },
      { threshold: 0 }
    );
    observadorMarca.observe(marca);
  }

  // Os marcadores fixos só entram quando as abas reais já saíram da tela, para as duas
  // versões nunca aparecerem juntas. Fora de vista, eles também saem do foco e da leitura.
  observadorAbas?.disconnect();
  if (abas) {
    observadorAbas = new IntersectionObserver(
      ([entrada]) => {
        const escondidas = !entrada.isIntersecting;
        document.querySelectorAll<HTMLElement>('[data-fixo]').forEach((el) => {
          el.dataset.visivel = String(escondidas);
          el.inert = !escondidas;
        });
      },
      { threshold: 0 }
    );
    observadorAbas.observe(abas);
  }
  ligarRolandoMarcadores();
}

/** Marca o <html> enquanto a página rola: os marcadores fixos somem atrás da folha e só
 *  voltam quando a rolagem para por um instante. */
let rolandoLigado = false;
function ligarRolandoMarcadores() {
  if (rolandoLigado) return;
  rolandoLigado = true;
  let timer = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (!document.documentElement.dataset.rolando) document.documentElement.dataset.rolando = 'sim';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => delete document.documentElement.dataset.rolando, 617);
    },
    { passive: true }
  );
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

/** Aulas que a pessoa desmarcou na mão: não se concluem sozinhas de novo nesta visita. */
const semConclusaoAutomatica = new Set<string>();
let limpezaAulaAtual: AbortController | null = null;

/** Mede o andamento da aula aberta: quanto da leitura já foi vista (até o começo das questões,
 *  ou o fim do texto se não houver questões) e se as questões foram respondidas. Com isso a
 *  aula conclui sozinha; só ler não basta quando há questões. O que fica salvo alimenta o anel
 *  em volta do número da aula nas listas. */
function ligarAulaAtual() {
  limpezaAulaAtual?.abort();
  limpezaAulaAtual = new AbortController();
  const { signal } = limpezaAulaAtual;

  const marcador = document.querySelector<HTMLElement>('[data-acao="marcar-aula"]');
  if (!marcador) return;
  const id = marcador.dataset.aula!;
  registrarUltima(marcador);

  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  if (!artigo) return;

  const atual: Andamento = andamentos()[id] ?? { l: 0, q: 0, z: 0 };
  let mudou = false;

  const salvar = () => {
    if (!mudou) return;
    mudou = false;
    atual.t = Date.now();
    const todos = andamentos();
    todos[id] = atual;
    gravar(CHAVE_ANDAMENTO, todos);
    if (!vistas()[id] && !semConclusaoAutomatica.has(id) && percentualDaAula(atual) >= 100) {
      marcar(id, true);
      toast('Aula concluída', 'circle-check');
    }
    refletirProgresso();
  };

  const medirLeitura = () => {
    const quiz = artigo.querySelector('.quiz');
    if (quiz && !atual.z) {
      atual.z = 1;
      mudou = true;
    }
    // O quiz mora dentro de um <details> que pode estar recolhido (sem caixa): o ponto de medida
    // é o cabeçalho dele, que sempre tem posição.
    const ancora = quiz ? (quiz.closest('details') ?? quiz) : null;
    const topo = artigo.getBoundingClientRect().top + window.scrollY;
    const fim = (ancora ?? artigo).getBoundingClientRect()[ancora ? 'top' : 'bottom'] + window.scrollY;
    const alcance = window.scrollY + window.innerHeight;
    const fracao = Math.min(1, Math.max(0, (alcance - topo) / Math.max(1, fim - topo)));
    const l = Math.round(fracao * 100);
    if (l > atual.l) {
      atual.l = l;
      mudou = true;
    }
  };

  let agendado = false;
  const aoMudar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      medirLeitura();
      salvar();
    });
  };

  window.addEventListener('scroll', aoMudar, { passive: true, signal });
  window.addEventListener('resize', aoMudar, { signal });
  document.addEventListener(
    'cdt:questoes',
    (e) => {
      const { respondidas, total } = (e as CustomEvent<{ respondidas: number; total: number }>).detail;
      if (total > 0 && !atual.z) {
        atual.z = 1;
        mudou = true;
      }
      // Só sobe: refazer as questões não tira o que já foi conquistado.
      if (total > 0 && respondidas >= total && !atual.q) {
        atual.q = 1;
        mudou = true;
      }
      salvar();
    },
    { signal }
  );

  // Primeira medida depois que o quiz e os tópicos foram montados.
  requestAnimationFrame(() => requestAnimationFrame(aoMudar));
}

/** A pílula de voltar (último link do caminho) guarda o nome da página e, escondido, "Voltar":
 *  no hover um sobe e o outro entra. O segundo fica fora do leitor de tela. */
function ligarPilulaVoltar() {
  document.querySelectorAll<HTMLAnchorElement>("nav[aria-label='Você está aqui'] a:last-of-type").forEach((a) => {
    if (a.querySelector('.volta__texto')) return;
    const nome = a.textContent?.trim() ?? '';
    if (!nome) return;
    a.innerHTML = `<span class="volta__texto"><i>${escapar(nome)}</i><i aria-hidden="true">Voltar</i></span>`;
  });
}

/* ---------------------------------------------------------------- arranque */

function iniciar() {
  // O primeiro carregamento dispara `astro:page-load` e também a chamada direta lá embaixo:
  // sem esta marca, tudo era ligado duas vezes (ex.: os `toggle` das dobras). O <body> é
  // trocado a cada navegação, então a marca some junto e a página nova inicia normalmente.
  if (document.body.dataset.cdtIniciado) return;
  document.body.dataset.cdtIniciado = '1';
  aplicarTema(temaSalvo());
  aplicarDispensados();
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
  refletirProgresso();
  montarHub();
  ligarAtalhos();
  ligarNotasSoltas();
  ligarDobras();
  ligarCabecalhoFixo();
  ligarAulaAtual();
  ligarPilulaVoltar();
  // Ordem importa: o quiz lê os filhos do artigo, os tópicos os embrulham em seguida e
  // as barras de rolagem medem a página já com os tópicos no lugar.
  montarQuiz();
  montarTopicos();
  montarSumario();
  montarBarrasDeRolagem();
}

document.addEventListener('astro:page-load', () => {
  delete document.documentElement.dataset.navegando;
  iniciar();
});
// Marca o <html> NOVO enquanto a troca de página acontece: a rolagem suave do CSS faria o
// "voltar" correr por baixo da página que já entrou (ver html[data-navegando] em global.css).
document.addEventListener('astro:before-swap', (e) => {
  (e as Event & { newDocument: Document }).newDocument.documentElement.dataset.navegando = '';
});
// Roda no documento novo, antes de pintar: evita perder tema e fonte (e o flash).
document.addEventListener('astro:after-swap', () => {
  aplicarTema(temaSalvo());
  aplicarDispensados();
  aplicarFontePx(lerFontePx());
  aplicarBrilho(lerBrilho());
  aplicarA11y(preferencias());
});
if (document.readyState !== 'loading') iniciar();
else document.addEventListener('DOMContentLoaded', iniciar, { once: true });

// Exposto para depuração e para trechos inline que precisam avisar o usuário.
(window as any).cdt = { toast, vistas, abrirBusca };
