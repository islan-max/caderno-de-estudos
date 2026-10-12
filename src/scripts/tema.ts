/* ---------------------------------------------------------------------------
 * Tema claro e escuro, com a transição entre eles.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';
import { ler, gravar } from './util';

const CHAVE_TEMA = 'cdt:tema';

export function aplicarTema(tema: 'claro' | 'escuro') {
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
export function temaSalvo(): 'claro' | 'escuro' {
  return ler<string>(CHAVE_TEMA, 'claro') === 'escuro' ? 'escuro' : 'claro';
}

let transicaoDoTema: ViewTransition | null = null;

export function alternarTema(origem?: HTMLElement | null) {
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
