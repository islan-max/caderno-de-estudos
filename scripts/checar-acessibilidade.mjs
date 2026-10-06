// Verificador estático de acessibilidade no HTML já gerado (dist/).
//
// Uso: node scripts/checar-acessibilidade.mjs [--base /caderno-de-estudos] [--so <trecho-do-caminho>] [--detalhe]
//   Rode depois de `npm run build`. Sai com código 1 se houver erro; avisos não reprovam.
//
// O que confere, em todas as páginas:
//   estrutura  lang, <title>, um <h1>, saltos de nível de título, um <main>, ids repetidos
//   nomes      links, botões, campos, imagens e SVGs informativos com nome acessível
//   referências aria-labelledby / aria-describedby / aria-controls apontando para ids que existem
//   links      target="_blank" avisa que abre em nova aba; link sem destino
//   tabelas    <th> com scope e <caption>
//
// NÃO substitui teste com teclado, leitor de tela e zoom: pega só o que dá para
// provar olhando o HTML. Contraste é conferido por outro script (checar-contraste.mjs).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');
const args = process.argv.slice(2);
const so = args.includes('--so') ? args[args.indexOf('--so') + 1] : '';
const detalhe = args.includes('--detalhe');

function paginas(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...paginas(caminho));
    else if (nome.endsWith('.html')) saida.push(caminho);
  }
  return saida;
}

/* ------------------------------------------------------------ nome acessível */

function escondido(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

function textoVisivel(el) {
  let t = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) t += n.textContent;
    else if (n.nodeType === 1) {
      if (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true') continue;
      if (n.tagName === 'IMG') t += ' ' + (n.getAttribute('alt') || '') + ' ';
      else if (n.tagName === 'svg') t += ' ' + (n.querySelector('title')?.textContent || n.getAttribute('aria-label') || '') + ' ';
      else t += textoVisivel(n);
    }
  }
  return t;
}

function nome(el, doc) {
  const lab = el.getAttribute('aria-labelledby');
  if (lab) {
    const t = lab.split(/\s+/).map((id) => doc.getElementById(id)?.textContent || '').join(' ').trim();
    if (t) return t;
  }
  const al = el.getAttribute('aria-label')?.trim();
  if (al) return al;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    const id = el.getAttribute('id');
    const l = id ? doc.querySelector(`label[for="${CSS.escape(id)}"]`) : el.closest('label');
    const t = l ? textoVisivel(l).trim() : '';
    if (t) return t;
  }
  const t = textoVisivel(el).replace(/\s+/g, ' ').trim();
  if (t) return t;
  return el.getAttribute('title')?.trim() || '';
}

/* ------------------------------------------------------------------ regras */

const regras = [];
function regra(id, nivel, descricao, fn) {
  regras.push({ id, nivel, descricao, fn });
}

regra('lang', 'erro', 'html sem lang', ({ document }) =>
  document.documentElement.getAttribute('lang') ? [] : ['<html> sem atributo lang']);

regra('titulo', 'erro', 'página sem <title>', ({ document }) =>
  document.title.trim() ? [] : ['<title> vazio']);

regra('h1', 'erro', 'deve haver exatamente um h1 na página (fora de diálogos)', ({ document }) => {
  const h1s = [...document.querySelectorAll('h1')].filter((h) => !h.closest('dialog'));
  return h1s.length === 1 ? [] : [`${h1s.length} elementos h1`];
});

regra('titulos', 'erro', 'salto de nível de título', ({ document }) => {
  const out = [];
  let ultimo = 0;
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (h.closest('dialog') || escondido(h)) continue;
    const n = Number(h.tagName[1]);
    if (ultimo && n > ultimo + 1) out.push(`h${ultimo} → h${n}: "${textoVisivel(h).trim().slice(0, 50)}"`);
    ultimo = n;
  }
  return out;
});

regra('titulo-vazio', 'erro', 'título sem texto', ({ document }) =>
  [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !escondido(h) && !nome(h, document)).map((h) => `<${h.tagName.toLowerCase()}> vazio`));

regra('main', 'erro', 'deve haver exatamente um <main>', ({ document }) => {
  const n = document.querySelectorAll('main').length;
  return n === 1 ? [] : [`${n} elementos main`];
});

regra('ids', 'erro', 'ids repetidos', ({ document }) => {
  const vistos = new Map();
  for (const el of document.querySelectorAll('[id]')) vistos.set(el.id, (vistos.get(el.id) || 0) + 1);
  return [...vistos].filter(([, n]) => n > 1).map(([id, n]) => `id="${id}" aparece ${n}×`);
});

regra('refs-aria', 'erro', 'aria-* aponta para id inexistente', ({ document }) => {
  const out = [];
  for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      for (const id of el.getAttribute(attr).split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) out.push(`${attr}="${id}" em <${el.tagName.toLowerCase()}>`);
      }
    }
  }
  return out;
});

regra('link-sem-nome', 'erro', 'link sem nome acessível', ({ document }) =>
  [...document.querySelectorAll('a[href]')].filter((a) => !escondido(a) && !nome(a, document)).map((a) => `<a href="${a.getAttribute('href')}">`));

regra('link-sem-href', 'aviso', '<a> sem href (não é focável)', ({ document }) =>
  [...document.querySelectorAll('a:not([href])')].filter((a) => !a.hasAttribute('name')).map((a) => `<a class="${a.className}">`));

regra('botao-sem-nome', 'erro', 'botão sem nome acessível', ({ document }) =>
  [...document.querySelectorAll('button, [role="button"]')].filter((b) => !escondido(b) && !nome(b, document)).map((b) => `<button class="${b.className}">`));

regra('campo-sem-rotulo', 'erro', 'campo sem rótulo', ({ document }) =>
  [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select')]
    .filter((c) => !escondido(c) && !nome(c, document)).map((c) => `<${c.tagName.toLowerCase()} id="${c.id}">`));

regra('img-sem-alt', 'erro', '<img> sem atributo alt', ({ document }) =>
  [...document.querySelectorAll('img:not([alt])')].map((i) => `<img src="${(i.getAttribute('src') || '').slice(-40)}">`));

regra('img-alt-ruim', 'aviso', 'alt que repete o nome do arquivo ou diz só "imagem"', ({ document }) =>
  [...document.querySelectorAll('img[alt]')].filter((i) => /\.(png|jpe?g|svg|webp)$/i.test(i.alt) || /^(imagem|foto|figura|image)$/i.test(i.alt.trim())).map((i) => `alt="${i.alt}"`));

regra('svg-sem-nome', 'erro', 'SVG informativo sem nome acessível (role="img" + <title> ou aria-label)', ({ document }) =>
  [...document.querySelectorAll('svg')]
    .filter((s) => !escondido(s) && !s.closest('[aria-hidden="true"]'))
    .filter((s) => !(s.getAttribute('role') === 'img' && nome(s, document)) && !s.querySelector(':scope > title'))
    .map((s) => `<svg viewBox="${s.getAttribute('viewBox')}">`));

regra('svg-sem-role', 'aviso', 'SVG com <title> mas sem role="img" (alguns leitores ignoram o título)', ({ document }) =>
  [...document.querySelectorAll('svg')]
    .filter((s) => !escondido(s) && s.querySelector(':scope > title') && s.getAttribute('role') !== 'img')
    .map((s) => `<svg> "${s.querySelector(':scope > title').textContent.trim().slice(0, 40)}"`));

regra('nova-aba', 'aviso', 'link target=_blank sem aviso de que abre em nova aba', ({ document }) =>
  [...document.querySelectorAll('a[target="_blank"]')]
    .filter((a) => !/nova aba|nova janela/i.test(`${a.getAttribute('aria-label') || ''} ${a.textContent}`))
    .map((a) => `<a href="${a.getAttribute('href').slice(0, 60)}">`));

regra('tabindex', 'erro', 'tabindex positivo distorce a ordem de foco', ({ document }) =>
  [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).map((e) => `<${e.tagName.toLowerCase()}>`));

regra('tabela', 'aviso', 'tabela sem <th> ou sem scope', ({ document }) => {
  const out = [];
  document.querySelectorAll('table').forEach((t) => {
    const ths = [...t.querySelectorAll('th')];
    if (!ths.length) out.push('tabela sem <th>');
    else if (ths.some((th) => !th.getAttribute('scope') && !th.closest('thead'))) out.push('<th> sem scope');
  });
  return out;
});

regra('piscar', 'erro', '<marquee>, <blink> ou autoplay', ({ document }) =>
  [...document.querySelectorAll('marquee, blink, video[autoplay], audio[autoplay], iframe')].map((e) => `<${e.tagName.toLowerCase()}>`));

regra('iframe-titulo', 'erro', '<iframe> sem title', ({ document }) =>
  [...document.querySelectorAll('iframe:not([title])')].map(() => '<iframe>'));

regra('role-switch', 'erro', 'role=switch sem aria-checked', ({ document }) =>
  [...document.querySelectorAll('[role=switch]:not([aria-checked])')].map((e) => `<${e.tagName.toLowerCase()}>`));

regra('dialog-sem-nome', 'erro', '<dialog> sem nome acessível', ({ document }) =>
  [...document.querySelectorAll('dialog')].filter((d) => !d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby')).map((d) => `<dialog id="${d.id}">`));

regra('nav-sem-nome', 'aviso', 'mais de um <nav> sem nome distinto', ({ document }) => {
  const navs = [...document.querySelectorAll('nav')];
  if (navs.length < 2) return [];
  return navs.filter((n) => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')).map(() => '<nav> sem aria-label');
});

/* -------------------------------------------------------------------- loop */

const arquivos = paginas(DIST).filter((f) => !so || f.replaceAll('\\', '/').includes(so));
if (!arquivos.length) {
  console.error('Nenhuma página em dist/. Rode `npm run build` antes.');
  process.exit(2);
}

const totais = new Map(); // regra -> { paginas: Set, exemplos: [] }
let erros = 0;
let avisos = 0;

for (const arq of arquivos) {
  const dom = new JSDOM(readFileSync(arq, 'utf8'));
  const { document } = dom.window;
  globalThis.CSS ??= { escape: (s) => s.replace(/["\\]/g, '\\$&') };
  const rel = relative(DIST, arq).replaceAll('\\', '/');
  for (const r of regras) {
    const achados = r.fn({ document });
    if (!achados.length) continue;
    const t = totais.get(r.id) ?? { regra: r, paginas: new Set(), exemplos: [], ocorrencias: 0 };
    t.paginas.add(rel);
    t.ocorrencias += achados.length;
    if (t.exemplos.length < (detalhe ? 200 : 3)) t.exemplos.push(`${rel}: ${achados.slice(0, detalhe ? 20 : 2).join(' | ')}`);
    totais.set(r.id, t);
    if (r.nivel === 'erro') erros += achados.length;
    else avisos += achados.length;
  }
}

console.log(`\n${arquivos.length} páginas verificadas.\n`);
if (!totais.size) console.log('Nenhum problema encontrado.');
for (const t of totais.values()) {
  console.log(`[${t.regra.nivel.toUpperCase()}] ${t.regra.descricao}  (${t.ocorrencias} em ${t.paginas.size} páginas)`);
  for (const e of t.exemplos) console.log(`    ${e}`);
}
console.log(`\n${erros} erro(s), ${avisos} aviso(s).`);
process.exit(erros ? 1 : 0);
