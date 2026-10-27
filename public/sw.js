/* ---------------------------------------------------------------------------
 * Service worker: o caderno abre sem internet.
 *
 * - Páginas (HTML): rede primeiro, para nunca mostrar aula velha; sem rede (ou rede
 *   lenta demais), a cópia guardada; sem cópia, a página /offline/.
 * - Arquivos de /_astro/ (CSS, JS, fontes, imagens com hash no nome): nunca mudam,
 *   então vêm do cache e só vão à rede na primeira vez.
 * - O resto da mesma origem (ícones, aulas.json): cache na hora e atualiza por trás.
 * - Outras origens (o modelo da correção inteligente, no jsDelivr/Hugging Face) passam
 *   direto: o transformers.js já guarda o modelo no próprio cache.
 *
 * Toda aula aberta (ou pré-carregada pelo prefetch, ao aparecer numa lista) fica guardada.
 * Nada aqui envia dados: só guarda o que o próprio navegador baixou do site.
 * ------------------------------------------------------------------------- */

const VERSAO = 'v1';
const PAGINAS = `cdt-paginas-${VERSAO}`;
const ARQUIVOS = `cdt-arquivos-${VERSAO}`;
const MAX_PAGINAS = 400;
const ESPERA_REDE_MS = 4000;

const base = new URL(self.registration.scope).pathname; // ex.: /caderno-de-estudos/
const OFFLINE = `${base}offline/`;
const ESSENCIAIS = [base, OFFLINE, `${base}manifest.webmanifest`, `${base}icon-192.png`, `${base}favicon.svg`];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(PAGINAS);
      // Um que falhe não impede a instalação (ex.: a página offline ainda não publicada).
      await Promise.all(ESSENCIAIS.map((url) => cache.add(url).catch(() => {})));
      await guardarArquivosDaPagina(cache, base);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n.startsWith('cdt-') && n !== PAGINAS && n !== ARQUIVOS).map((n) => caches.delete(n))
      );
      await self.clients.claim();
      // A página em que o service worker nasceu carregou antes dele: guarda agora.
      const cache = await caches.open(PAGINAS);
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        abertas.map(({ url }) => {
          const u = new URL(url);
          return u.pathname.startsWith(base) ? cache.add(u.origin + u.pathname).catch(() => {}) : undefined;
        })
      );
    })()
  );
});

/** Guarda o CSS/JS/fontes que a página inicial usa: sem eles a cópia offline abriria sem estilo. */
async function guardarArquivosDaPagina(cachePaginas, url) {
  try {
    const resposta = await cachePaginas.match(url);
    if (!resposta) return;
    const html = await resposta.text();
    const urls = new Set();
    for (const m of html.matchAll(/(?:href|src)="([^"]*\/_astro\/[^"]+)"/g)) urls.add(new URL(m[1], self.location.origin).href);
    const cache = await caches.open(ARQUIVOS);
    await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})));
  } catch {
    /* sem problema: os arquivos entram no cache na primeira visita */
  }
}

function ehPagina(request, url) {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  const ultimo = url.pathname.split('/').pop() ?? '';
  return url.pathname.endsWith('/') || ultimo.endsWith('.html') || !ultimo.includes('.');
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(base)) return;
  if (url.pathname === `${base}sw.js`) return;

  if (url.pathname.startsWith(`${base}_astro/`)) {
    evento.respondWith(cacheAntes(request));
  } else if (ehPagina(request, url)) {
    evento.respondWith(redeAntes(evento, request, url));
  } else {
    evento.respondWith(cacheEAtualiza(evento, request));
  }
});

async function cacheAntes(request) {
  const cache = await caches.open(ARQUIVOS);
  const guardado = await cache.match(request);
  if (guardado) return guardado;
  const resposta = await fetch(request);
  if (resposta.ok) await cache.put(request, resposta.clone());
  return resposta;
}

async function cacheEAtualiza(evento, request) {
  const cache = await caches.open(ARQUIVOS);
  const guardado = await cache.match(request);
  const daRede = fetch(request)
    .then(async (resposta) => {
      if (resposta.ok) await cache.put(request, resposta.clone());
      return resposta;
    })
    .catch(() => undefined);
  if (guardado) {
    evento.waitUntil(daRede);
    return guardado;
  }
  return (await daRede) ?? Response.error();
}

async function redeAntes(evento, request, url) {
  const cache = await caches.open(PAGINAS);
  // A chave ignora ?query e #: a mesma aula não vira várias cópias.
  const chave = url.origin + url.pathname;
  const daRede = fetch(request).then(async (resposta) => {
    if (resposta.ok && resposta.type === 'basic' && !resposta.redirected) {
      await cache.put(chave, resposta.clone());
      evento.waitUntil(aparar(cache));
    }
    return resposta;
  });
  evento.waitUntil(daRede.catch(() => {}));

  let timer;
  const tempo = new Promise((resolver) => {
    timer = setTimeout(resolver, ESPERA_REDE_MS);
  });
  try {
    // Rede lenta (3G ruim): se já houver cópia, ela entra depois de alguns segundos;
    // a resposta da rede ainda atualiza o cache para a próxima vez.
    const primeira = await Promise.race([daRede, tempo]);
    if (primeira) return primeira;
    const guardado = await cache.match(chave);
    return guardado ?? (await daRede);
  } catch {
    const guardado = await cache.match(chave);
    if (guardado) return guardado;
    if (request.mode === 'navigate') {
      const offline = await cache.match(OFFLINE);
      if (offline) return offline;
    }
    return Response.error();
  } finally {
    clearTimeout(timer);
  }
}

/** Mantém no máximo MAX_PAGINAS páginas: saem as guardadas há mais tempo (a ordem das chaves é a de inserção). */
async function aparar(cache) {
  const chaves = await cache.keys();
  const essenciais = new Set(ESSENCIAIS.map((u) => new URL(u, self.location.origin).href));
  const removiveis = chaves.filter((r) => !essenciais.has(r.url));
  const excesso = removiveis.length - MAX_PAGINAS;
  for (let i = 0; i < excesso; i++) await cache.delete(removiveis[i]);
}
