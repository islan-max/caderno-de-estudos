/* ---------------------------------------------------------------------------
 * Sumário da aula: a lista de tópicos (## e ###) que abre pelo botão "Sumário".
 *
 * Montado a partir dos títulos que já estão na página, depois de topicos.ts: assim
 * "Antes de Começar" e as seções recolhidas já existem e podem ser abertas ao pular.
 * Clicar num item expande o que estiver recolhido no caminho, fecha o painel e rola
 * até o título, que recebe o foco (teclado e leitor de tela continuam de onde pararam).
 * ------------------------------------------------------------------------- */

function movimentoReduzido(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.movimento === 'sim'
  );
}

export function montarSumario() {
  const lista = document.querySelector<HTMLElement>('[data-sumario-lista]');
  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  if (!lista || !artigo || lista.dataset.pronto === 'true') return;
  lista.dataset.pronto = 'true';

  // h2/h3 com data-visual são títulos rebaixados (niveis-de-titulo.mjs), pequenos demais para o sumário.
  const titulos = Array.from(artigo.querySelectorAll<HTMLElement>('h2, h3')).filter(
    (h) => !h.hasAttribute('data-visual')
  );

  let subLista: HTMLOListElement | null = null;
  titulos.forEach((h, i) => {
    const item = document.createElement('li');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.alvo = String(i);
    botao.textContent = (h.textContent ?? '').trim();

    if (h.tagName === 'H2') {
      item.className = 'sumario__secao';
      botao.className = 'sumario__item sumario__item--secao';
      item.append(botao);
      lista.append(item);
      subLista = null;
    } else {
      item.className = 'sumario__sub';
      botao.className = 'sumario__item';
      item.append(botao);
      if (!subLista) {
        subLista = document.createElement('ol');
        subLista.className = 'sumario__sublista';
        (lista.lastElementChild ?? lista).append(subLista);
      }
      subLista.append(item);
    }
  });

  lista.addEventListener('click', (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-alvo]');
    if (!botao) return;
    const alvo = titulos[Number(botao.dataset.alvo)];
    if (!alvo) return;

    // Abre tudo o que estiver recolhido no caminho até o título.
    let abriu = false;
    for (let d = alvo.closest('details'); d; d = d.parentElement?.closest('details') ?? null) {
      if (!d.open) {
        d.open = true;
        abriu = true;
      }
    }
    botao.closest('dialog')?.close();

    // Um bloco que acabou de abrir ainda está crescendo: espera a animação para medir o destino.
    window.setTimeout(
      () => {
        alvo.scrollIntoView({ block: 'start', behavior: movimentoReduzido() ? 'auto' : 'smooth' });
        alvo.tabIndex = -1;
        alvo.focus({ preventScroll: true });
      },
      abriu && !movimentoReduzido() ? 340 : 0
    );
  });
}
