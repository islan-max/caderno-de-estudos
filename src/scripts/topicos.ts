/* ---------------------------------------------------------------------------
 * Tópicos retráteis da aula.
 *
 * Cada seção principal (## no MDX) vira um <details>: quem já leu, ou quer ir
 * direto ao ponto, recolhe o tópico e a página fica mais curta. É um <details>
 * nativo, então teclado, leitor de tela e Ctrl+F funcionam sem código nosso.
 *
 * Duas aparências:
 *  - "Antes de Começar" vira um bloco recolhido, igual ao "Raio-X do tema" e ao
 *    "Palavras e siglas": é consulta, e quem não quer ver não precisa rolar por ela;
 *  - as demais seções ficam abertas, com o título de sempre e uma seta para recolher.
 *
 * O HTML é montado no navegador, em cima do que o markdown já gerou. Sem JS a
 * aula continua inteira e legível. Precisa rodar DEPOIS de montarQuiz(): o quiz
 * procura as questões entre os filhos diretos do artigo.
 * ------------------------------------------------------------------------- */

interface Grupo {
  titulo: HTMLElement;
  corpo: Element[];
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function icone(nome: string, extra = ''): HTMLElement {
  const i = document.createElement('i');
  i.className = `fa-solid fa-${nome} ${extra}`.trim();
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function criar<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = classe;
  return el;
}

function agrupar(artigo: HTMLElement): Grupo[] {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  for (const el of Array.from(artigo.children) as HTMLElement[]) {
    // h2 com data-visual é um título rebaixado de outro nível (niveis-de-titulo.mjs): não abre seção.
    if (el.tagName === 'H2' && !el.hasAttribute('data-visual')) {
      atual = { titulo: el, corpo: [] };
      grupos.push(atual);
    } else {
      atual?.corpo.push(el);
    }
  }
  return grupos;
}

function seta(): HTMLElement {
  const s = criar('span', 'acordeao__seta');
  s.setAttribute('aria-hidden', 'true');
  s.append(icone('chevron-down'));
  return s;
}

/** "Antes de Começar": mesmo desenho do Raio-X e do glossário, recolhido. */
function montarComoAcordeao(g: Grupo, dica: string) {
  const detalhes = criar('details', 'acordeao topico-retratil topico-retratil--antes');
  // O bloco ocupa o lugar do título ANTES de o título mudar de pai.
  g.titulo.before(detalhes);
  const cabeca = criar('summary', 'acordeao__cabeca not-prose');

  const ic = criar('span', 'acordeao__icone');
  const lampada = icone('lightbulb', 'fa-duo');
  lampada.style.cssText = '--fa-primary-color: var(--acordeao-tinta); color: var(--acordeao-tinta);';
  ic.append(lampada);

  const textos = criar('span', 'acordeao__textos');
  g.titulo.classList.add('acordeao__titulo');
  const linhaDica = criar('span', 'acordeao__dica');
  linhaDica.textContent = dica;
  textos.append(g.titulo, linhaDica);

  cabeca.append(ic, textos, seta());

  const corpo = criar('div', 'acordeao__corpo');
  corpo.append(...g.corpo);

  detalhes.append(cabeca, corpo);
}

/** Demais seções: abertas, com o título original e uma seta ao lado. */
function montarComoSecao(g: Grupo) {
  const detalhes = criar('details', 'topico-retratil topico-retratil--secao');
  detalhes.open = true;
  // Sem "not-prose": o título continua sendo o <h2> da aula, com o tamanho e o peso de sempre.
  const cabeca = criar('summary', 'topico-retratil__cabeca');
  const corpo = criar('div', 'topico-retratil__corpo');
  corpo.append(...g.corpo);

  g.titulo.before(detalhes);
  cabeca.append(g.titulo, seta());
  detalhes.append(cabeca, corpo);
}

/** Link ou endereço com #âncora para algo dentro de um tópico recolhido: abre o tópico. */
function abrirPeloEndereco() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const alvo = document.getElementById(id);
  const dono = alvo?.closest<HTMLDetailsElement>('details.topico-retratil');
  if (dono && !dono.open) {
    dono.open = true;
    alvo!.scrollIntoView({ block: 'start' });
  }
}

export function montarTopicos() {
  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  if (!artigo || artigo.dataset.topicosPronto === 'true') return;
  artigo.dataset.topicosPronto = 'true';

  const dica =
    artigo.dataset.secao === 'enem'
      ? 'O que o ENEM cobra e o que saber antes de começar'
      : 'O que a aula cobra e o que saber antes de começar';

  for (const g of agrupar(artigo)) {
    if (normalizar(g.titulo.textContent ?? '') === 'antes de comecar') montarComoAcordeao(g, dica);
    else montarComoSecao(g);
  }

  abrirPeloEndereco();
  window.addEventListener('hashchange', abrirPeloEndereco);
}
