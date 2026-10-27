/* ---------------------------------------------------------------------------
 * App instalável e leitura sem internet (public/sw.js).
 *
 * - Registra o service worker uma vez, depois que a página carregou (não disputa a rede
 *   com o primeiro paint).
 * - Avisa quando a conexão cai e quando volta.
 * - Botão "Instalar" ([data-instalar], página /ajustes): aparece só quando o navegador
 *   oferece a instalação; no iPhone, que não oferece, a página mostra o passo a passo.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let pedidoInstalar: EventoInstalar | null = null;
let ligado = false;

export function ligarPwa() {
  refletirInstalar();
  if (ligado) return;
  ligado = true;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    const registrar = () => navigator.serviceWorker?.register(`${base}sw.js`, { scope: base }).catch(() => {});
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }

  window.addEventListener('offline', () => toast('Sem internet: as aulas que você já abriu continuam aqui', 'wifi'));
  window.addEventListener('online', () => toast('Conexão de volta'));

  window.addEventListener('beforeinstallprompt', (e) => {
    pedidoInstalar = e as EventoInstalar;
    refletirInstalar();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    refletirInstalar();
    toast('Caderno instalado na tela inicial');
  });

  document.addEventListener('click', async (e) => {
    const botao = (e.target as Element | null)?.closest('[data-instalar]');
    if (!botao || !pedidoInstalar) return;
    const pedido = pedidoInstalar;
    pedidoInstalar = null;
    await pedido.prompt();
    await pedido.userChoice.catch(() => undefined);
    refletirInstalar();
  });
}

function instalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Mostra o estado certo no bloco de instalação (se a página tiver um). */
function refletirInstalar() {
  const bloco = document.querySelector<HTMLElement>('[data-bloco-instalar]');
  if (!bloco) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  bloco.dataset.estado = instalado() ? 'instalado' : pedidoInstalar ? 'pronto' : ios ? 'ios' : 'manual';
}
