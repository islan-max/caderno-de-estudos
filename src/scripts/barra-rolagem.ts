/* ---------------------------------------------------------------------------
 * Barra de rolagem própria: o corretivo de fita do caderno.
 *
 * A rolagem continua sendo a do navegador (roda do mouse, teclado, toque,
 * leitor de tela, Ctrl+F). A barra só desenha a posição (o corretivo) e deixa
 * uma fita colada até o ponto mais longe já alcançado, e oferece um jeito de arrastar; por isso fica aria-hidden e esconde a barra nativa apenas depois de
 * montada (sem JS, ou em Cores Forçadas, a nativa continua lá).
 *
 * Dois tipos de alvo:
 *  - a página (documento): barra fixa na borda da janela, com uma divisória
 *    para cada <h2> da aula e, ao arrastar, um recado com a seção atual;
 *  - um contêiner marcado com [data-rolagem] (diálogos, lista da busca), cuja
 *    área rolável é o filho [data-rolagem-area] (ou o próprio host, se ele
 *    mesmo rola e não tem esse filho).
 * ------------------------------------------------------------------------- */

type Eixo = 'y' | 'x';

/** Comprimento fixo do corretivo: não varia com o tamanho da página, para a peça ter sempre o mesmo desenho. */
const POLEGAR = 44;
/** Parte do comprimento que é o nariz do corretivo, na ponta (pseudo-elemento ::after no CSS). */
const NARIZ = 8;
const OCIOSO_MS = 1100;
const MAX_DIVISORIAS = 40;

const registro = new Set<Barra>();

function movimentoReduzido(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.movimento === 'sim'
  );
}

function comportamento(): ScrollBehavior {
  return movimentoReduzido() ? 'auto' : 'smooth';
}

function criar<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = classe;
  return el;
}

class Barra {
  private readonly barra = criar('div', 'barra');
  private readonly trilho = criar('div', 'barra__trilho');
  private readonly fita = criar('div', 'barra__fita');
  private readonly polegar = criar('div', 'barra__polegar');
  private readonly rotulo = criar('div', 'barra__rotulo');
  private readonly marcas: HTMLElement[] = [];
  private titulos: { el: HTMLElement; texto: string; frac: number; secao: boolean }[] = [];

  private readonly escuta = new AbortController();
  private readonly observadores: Array<{ disconnect(): void }> = [];

  private sujo = true;
  private agendado = false;
  private ocioso = 0;
  private arrastando = false;
  /** Posição de rolagem mais distante já alcançada: até onde a fita está colada. */
  private alcance = 0;

  // Medidas em cache (refeitas só quando o conteúdo ou a janela mudam).
  private total = 0;
  private visivel = 0;
  private trilhoLen = 0;
  private polegarLen = 0;

  constructor(
    private readonly area: HTMLElement,
    private readonly host: HTMLElement,
    private readonly eixo: Eixo,
    private readonly documento: boolean
  ) {
    this.barra.dataset.eixo = eixo;
    this.barra.dataset.alvo = documento ? 'pagina' : 'contenedor';
    // Nas aulas o corretivo deixa a fita por onde a leitura já passou, o que ajuda a retomar
    // um texto longo. No resto do site (listas, painéis, navegação) essa memória não significa
    // nada: lá a peça é um giz de cera, que só desliza pela linha e não deixa rastro.
    this.barra.dataset.modelo = document.querySelector('[data-conteudo-aula]') ? 'corretivo' : 'giz';
    this.barra.setAttribute('aria-hidden', 'true');
    this.barra.hidden = true;
    this.trilho.append(this.fita, this.polegar);
    this.barra.append(this.trilho, this.rotulo);
    host.append(this.barra);
    // Só some a barra nativa depois que a própria existe.
    area.setAttribute('data-barra-propria', '');

    this.ligar();
    this.agendar();
  }

  destruir() {
    this.escuta.abort();
    window.clearTimeout(this.ocioso);
    this.observadores.forEach((o) => o.disconnect());
    this.barra.remove();
    this.area.removeAttribute('data-barra-propria');
    registro.delete(this);
  }

  /* ----------------------------------------------------------- leitura */

  private pos(): number {
    if (this.documento) return this.eixo === 'y' ? window.scrollY : window.scrollX;
    return this.eixo === 'y' ? this.area.scrollTop : this.area.scrollLeft;
  }

  private get maximo(): number {
    return Math.max(0, this.total - this.visivel);
  }

  /** Cabeçalho fixo do painel (se houver): o trilho começa logo abaixo dele, qualquer que
   *  seja a altura que ele tenha com o texto ampliado. */
  private get cabecalho(): HTMLElement | null {
    return this.documento ? null : this.area.querySelector<HTMLElement>('.painel__cabeca');
  }

  private medir() {
    const cab = this.cabecalho;
    if (cab) {
      const abaixo = cab.getBoundingClientRect().bottom - this.host.getBoundingClientRect().top;
      this.barra.style.top = `${Math.round(abaixo - this.host.clientTop) + 2}px`;
    }
    const el = this.documento ? document.documentElement : this.area;
    const y = this.eixo === 'y';
    this.total = y ? el.scrollHeight : el.scrollWidth;
    this.visivel = y ? el.clientHeight : el.clientWidth;
    this.trilhoLen = y ? this.trilho.clientHeight : this.trilho.clientWidth;
    this.polegarLen = Math.min(this.trilhoLen, POLEGAR);
    this.polegar.style[y ? 'height' : 'width'] = `${Math.max(0, this.polegarLen - NARIZ)}px`;
    if (this.documento && y) this.medirTitulos();
    this.sujo = false;
  }

  /** Uma divisória por <h2> visível da aula, na altura em que o polegar ficaria
   *  ao chegar nela; os <h3> entram só no recado do arrasto. Cabeçalhos dentro de
   *  blocos recolhidos (sem caixa) ficam de fora. */
  private medirTitulos() {
    const max = this.maximo;
    const achados = Array.from(
      document.querySelectorAll<HTMLElement>('[data-conteudo-aula] :is(h2, h3)')
    ).filter((h) => h.getClientRects().length > 0);

    const base = window.scrollY;
    this.titulos =
      max > 0
        ? achados.map((el) => ({
            el,
            texto: (el.textContent ?? '').trim(),
            secao: el.tagName === 'H2',
            frac: Math.min(1, Math.max(0, (el.getBoundingClientRect().top + base) / max)),
          }))
        : [];

    const secoes = this.titulos.filter((t) => t.secao);
    const mostrar = secoes.length <= MAX_DIVISORIAS ? this.titulos : [];
    const indices = mostrar.length ? this.titulos.flatMap((t, i) => (t.secao ? [i] : [])) : [];

    while (this.marcas.length > indices.length) this.marcas.pop()!.remove();
    while (this.marcas.length < indices.length) {
      const m = criar('i', 'barra__marca');
      this.trilho.append(m);
      this.marcas.push(m);
    }
    indices.forEach((ti, mi) => {
      const t = this.titulos[ti];
      const marca = this.marcas[mi];
      marca.dataset.i = String(ti);
      marca.style.top = `${t.frac * (this.trilhoLen - this.polegarLen) + this.polegarLen / 2}px`;
    });
  }

  /* ------------------------------------------------------------ desenho */

  private agendar() {
    if (this.agendado) return;
    this.agendado = true;
    requestAnimationFrame(() => {
      this.agendado = false;
      this.desenhar();
    });
  }

  private desenhar() {
    if (!this.barra.isConnected) return;
    const y = this.eixo === 'y';
    // Medir exige a barra visível (o trilho precisa de caixa): destrava, mede, decide.
    if (this.sujo) {
      this.barra.hidden = false;
      this.medir();
    }
    const tem = this.maximo > 1;
    this.barra.hidden = !tem;
    if (!tem) return;

    const livre = this.trilhoLen - this.polegarLen;
    const frac = Math.min(1, Math.max(0, this.pos() / this.maximo));
    const deslocamento = frac * livre;
    this.polegar.style.transform = y
      ? `translate3d(0, ${deslocamento}px, 0)`
      : `translate3d(${deslocamento}px, 0, 0)`;

    // A fita sai pelo rolete (a ponta do corretivo) e só cresce: voltar não a descola.
    this.alcance = Math.min(this.maximo, Math.max(this.alcance, this.pos()));
    const fim = (this.alcance / this.maximo) * livre + this.polegarLen;
    const escala = Math.min(1, fim / this.trilhoLen);
    this.fita.style.transform = y ? `scaleY(${escala})` : `scaleX(${escala})`;

    if (this.titulos.length) {
      const atual = this.secaoAtual(frac);
      const dona = this.titulos.findLastIndex((t, i) => t.secao && i <= atual);
      this.marcas.forEach((m) => m.toggleAttribute('data-atual', Number(m.dataset.i) === dona));
      if (this.arrastando) this.mostrarRotulo(deslocamento + this.polegarLen / 2, atual, frac);
    }
    this.barra.style.setProperty('--p', String(frac));
  }

  /** Última seção cujo topo já passou da posição de leitura. */
  private secaoAtual(frac: number): number {
    let atual = -1;
    this.titulos.forEach((t, i) => {
      if (t.frac <= frac + 0.0005) atual = i;
    });
    return atual;
  }

  private mostrarRotulo(centro: number, secao: number, frac: number) {
    const pct = Math.round(frac * 100);
    const nome = secao >= 0 ? this.titulos[secao].texto : '';
    this.rotulo.textContent = nome ? `${nome} · ${pct}%` : `${pct}%`;
    this.rotulo.style.top = `${centro}px`;
    this.rotulo.dataset.visivel = 'true';
  }

  private esconderRotulo() {
    this.rotulo.dataset.visivel = 'false';
  }

  private ativar() {
    this.barra.setAttribute('data-ativa', '');
    window.clearTimeout(this.ocioso);
    this.ocioso = window.setTimeout(() => {
      if (!this.arrastando) this.barra.removeAttribute('data-ativa');
    }, OCIOSO_MS);
  }

  /* ------------------------------------------------------------ eventos */

  private rolarPara(valor: number, comp: ScrollBehavior) {
    const v = Math.min(this.maximo, Math.max(0, valor));
    const alvo = this.documento ? window : this.area;
    alvo.scrollTo(this.eixo === 'y' ? { top: v, behavior: comp } : { left: v, behavior: comp });
  }

  private ligar() {
    const { signal } = this.escuta;
    const fonte: EventTarget = this.documento ? document : this.area;
    fonte.addEventListener(
      'scroll',
      () => {
        this.ativar();
        this.agendar();
      },
      { passive: true, signal }
    );

    const sujar = () => {
      this.sujo = true;
      this.agendar();
    };
    window.addEventListener('resize', sujar, { signal });
    const ro = new ResizeObserver(sujar);
    if (this.documento) {
      ro.observe(document.body);
    } else {
      ro.observe(this.area);
      const cab = this.cabecalho;
      if (cab) ro.observe(cab);
      // Conteúdo trocado (nova busca, painel que carrega): a leitura recomeça, a fita também.
      const mo = new MutationObserver(() => {
        this.alcance = 0;
        sujar();
      });
      mo.observe(this.area, { childList: true, subtree: true });
      this.observadores.push(mo);
    }
    this.observadores.push(ro);

    // Ao entrar com o mouse, mostra a barra; a saída é tratada pelo tempo ocioso.
    this.barra.addEventListener('pointerenter', () => this.ativar(), { signal });
    this.barra.addEventListener('pointerdown', (e) => this.aoPressionar(e), { signal });

    // A barra cobre uma faixa da área: sem isto, a roda do mouse parada nela não rolaria.
    if (!this.documento) {
      this.barra.addEventListener(
        'wheel',
        (e) => {
          const k = e.deltaMode === 1 ? 16 : 1;
          this.area.scrollBy({ top: e.deltaY * k, left: e.deltaX * k });
          e.preventDefault();
        },
        { passive: false, signal }
      );
    }

    // Divisória: passa o mouse e mostra o nome da seção.
    this.trilho.addEventListener(
      'pointerover',
      (e) => {
        const m = (e.target as HTMLElement).closest<HTMLElement>('.barra__marca');
        if (!m || this.arrastando) return;
        const t = this.titulos[Number(m.dataset.i)];
        if (!t) return;
        this.rotulo.textContent = t.texto;
        this.rotulo.style.top = m.style.top;
        this.rotulo.dataset.visivel = 'true';
      },
      { signal }
    );
    this.trilho.addEventListener(
      'pointerout',
      (e) => {
        if (!this.arrastando && (e.target as HTMLElement).closest('.barra__marca')) {
          this.esconderRotulo();
        }
      },
      { signal }
    );
  }

  private aoPressionar(e: PointerEvent) {
    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    const y = this.eixo === 'y';

    const marca = alvo.closest<HTMLElement>('.barra__marca');
    if (marca) {
      const t = this.titulos[Number(marca.dataset.i)];
      // scrollIntoView respeita o scroll-padding-top da página (cabeçalho fixo).
      t?.el.scrollIntoView({ block: 'start', behavior: comportamento() });
      this.esconderRotulo();
      e.preventDefault();
      return;
    }

    if (alvo.closest('.barra__polegar')) {
      this.arrastar(e);
      return;
    }

    // Clique no trilho: uma "página" na direção do clique, como a barra nativa.
    const r = this.polegar.getBoundingClientRect();
    const ponto = y ? e.clientY : e.clientX;
    const antes = ponto < (y ? r.top : r.left);
    const passo = this.visivel * 0.9;
    this.rolarPara(this.pos() + (antes ? -passo : passo), comportamento());
    e.preventDefault();
  }

  private arrastar(e: PointerEvent) {
    const y = this.eixo === 'y';
    const inicioPonteiro = y ? e.clientY : e.clientX;
    const inicioPos = this.pos();
    const livre = Math.max(1, this.trilhoLen - this.polegarLen);
    const razao = this.maximo / livre;

    this.arrastando = true;
    this.barra.setAttribute('data-arrastando', '');
    this.ativar();
    this.polegar.setPointerCapture(e.pointerId);
    e.preventDefault();

    const mover = (ev: PointerEvent) => {
      const d = (y ? ev.clientY : ev.clientX) - inicioPonteiro;
      this.rolarPara(inicioPos + d * razao, 'instant' as ScrollBehavior);
    };
    const soltar = () => {
      this.arrastando = false;
      this.barra.removeAttribute('data-arrastando');
      this.esconderRotulo();
      this.ativar();
      this.polegar.removeEventListener('pointermove', mover);
      this.polegar.removeEventListener('pointerup', soltar);
      this.polegar.removeEventListener('pointercancel', soltar);
    };
    this.polegar.addEventListener('pointermove', mover);
    this.polegar.addEventListener('pointerup', soltar);
    this.polegar.addEventListener('pointercancel', soltar);
  }
}

/* ------------------------------------------------------------- arranque */

function desmontar() {
  registro.forEach((b) => b.destruir());
  registro.clear();
}

/** Monta a barra da página (vertical e, se a janela rolar de lado, horizontal) e a de cada
 *  [data-rolagem]. Pode ser chamada de novo a cada navegação: refaz tudo do zero. */
export function montarBarrasDeRolagem() {
  desmontar();
  if (typeof ResizeObserver === 'undefined') return;

  const raiz = document.documentElement;
  const pagina = [new Barra(raiz, document.body, 'y', true), new Barra(raiz, document.body, 'x', true)];
  pagina.forEach((b) => registro.add(b));

  document.querySelectorAll<HTMLElement>('[data-rolagem]').forEach((host) => {
    const area = host.querySelector<HTMLElement>(':scope > [data-rolagem-area]') ?? host;
    registro.add(new Barra(area, host, 'y', false));
  });
}

// A página nova já vem com barras novas (o <body> é trocado); limpar antes evita
// observadores presos ao documento antigo.
document.addEventListener('astro:before-swap', desmontar);
