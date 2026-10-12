/* ---------------------------------------------------------------------------
 * Cabeçalho fixo com marcadores e a pílula de voltar.
 * ------------------------------------------------------------------------- */
import { escapar } from './util';

let observadorMarca: IntersectionObserver | null = null;

let observadorAbas: IntersectionObserver | null = null;

export function ligarCabecalhoFixo() {
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

/** A pílula de voltar (último link do caminho) guarda o nome da página e, escondido, "Voltar":
 *  no hover um sobe e o outro entra. O segundo fica fora do leitor de tela. */
export function ligarPilulaVoltar() {
  document.querySelectorAll<HTMLAnchorElement>("nav[aria-label='Você está aqui'] a:last-of-type").forEach((a) => {
    if (a.querySelector('.volta__texto')) return;
    const nome = a.textContent?.trim() ?? '';
    if (!nome) return;
    a.innerHTML = `<span class="volta__texto"><i>${escapar(nome)}</i><i aria-hidden="true">Voltar</i></span>`;
  });
}
