// Checagem do quiz no HTML já gerado (rodar depois do build com a base do GitHub Pages).
//
// Uso: node scripts/checar-quiz.mjs <materia>/<tema> [...]
//   Build antes (no Git Bash, a variável precisa escapar da conversão de caminho):
//   MSYS2_ENV_CONV_EXCL=BASE_PATH BASE_PATH=/caderno-de-estudos npx astro build
//
// Roda o montarQuiz de verdade (src/scripts/quiz.ts) no jsdom e exige: 5 questões × 5
// alternativas, gabarito com 5 itens, "5 de 5" ao marcar as respostas do gabarito,
// e toda <img> servida de /caderno-de-estudos/_astro/ com o arquivo presente no dist.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/caderno-de-estudos';

const { montarQuiz } = await import(pathToFileURL(join(RAIZ, 'src', 'scripts', 'quiz.ts')).href);

function checar(alvo) {
  const erros = [];
  const html = join(RAIZ, 'dist', 'enem', alvo, 'index.html');
  if (!existsSync(html)) return [`não achei ${html}: rode o build antes`];
  const dom = new JSDOM(readFileSync(html, 'utf8'));
  const { document } = dom.window;
  globalThis.window = dom.window;
  globalThis.document = document;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const artigo = document.querySelector('[data-conteudo-aula]');
  if (!artigo) return ['página sem [data-conteudo-aula]'];
  let gabarito = [];
  try {
    gabarito = JSON.parse(artigo.dataset.gabarito || '[]');
  } catch {
    erros.push('data-gabarito não é JSON válido');
  }
  if (gabarito.length !== 5) erros.push(`gabarito com ${gabarito.length} itens (devem ser 5)`);

  // sem JavaScript: as alternativas precisam aparecer uma por linha (<br>)
  const paragrafos = [...artigo.querySelectorAll(':scope > p')].filter((p) => /^A\)\s/.test(p.textContent.trim()));
  if (paragrafos.length !== 5) erros.push(`${paragrafos.length} parágrafos de alternativas no HTML (devem ser 5)`);
  paragrafos.forEach((p, i) => {
    const brs = p.querySelectorAll('br').length;
    if (brs !== 4) erros.push(`questão ${i + 1}: ${brs} quebras de linha entre as alternativas (devem ser 4; falta "\\" no fim de A–D?)`);
  });

  montarQuiz();
  const blocos = [...document.querySelectorAll('.quiz .quiz__questao')];
  if (blocos.length !== 5) erros.push(`o quiz reconheceu ${blocos.length} questões (devem ser 5)`);
  blocos.forEach((b, i) => {
    const legenda = b.querySelector('.quiz__legenda')?.textContent;
    if (legenda !== `Questão ${i + 1}`) erros.push(`legenda "${legenda}" (esperado "Questão ${i + 1}")`);
    const alts = b.querySelectorAll('.quiz__alternativa');
    if (alts.length !== 5) erros.push(`questão ${i + 1}: ${alts.length} alternativas no quiz (devem ser 5)`);
    alts.forEach((a, j) => {
      if (!a.querySelector('.quiz__texto')?.textContent.trim()) erros.push(`questão ${i + 1}, alternativa ${'ABCDE'[j]} vazia`);
    });
    const certa = gabarito[i]?.correta;
    if (Number.isInteger(certa)) b.querySelectorAll('input')[certa].checked = true;
  });
  const corrigir = [...document.querySelectorAll('.quiz__botao')].find((x) => /Corrigir/.test(x.textContent));
  if (!corrigir) erros.push('botão "Corrigir respostas" não apareceu');
  else {
    corrigir.click();
    const placar = document.querySelector('.quiz__placar')?.textContent || '';
    if (!/Você acertou 5 de 5/.test(placar)) erros.push(`marcando o gabarito, o placar foi "${placar}"`);
    blocos.forEach((b, i) => {
      const r = b.querySelector('.quiz__resposta')?.textContent || '';
      if (!/Revisar: Aula Teórica › /.test(r)) erros.push(`questão ${i + 1}: explicação da resposta sem "Revisar: Aula Teórica ›"`);
    });
  }

  // imagens com a base do GitHub Pages e arquivo presente
  for (const img of document.querySelectorAll('article img')) {
    const src = img.getAttribute('src') || '';
    if (!src.startsWith(`${BASE}/_astro/`)) erros.push(`<img> fora de ${BASE}/_astro/: ${src}`);
    else if (!existsSync(join(RAIZ, 'dist', src.slice(BASE.length)))) erros.push(`<img> aponta para arquivo inexistente: ${src}`);
    if (!(img.getAttribute('alt') || '').trim()) erros.push(`<img> sem alt: ${src}`);
  }
  return erros;
}

const alvos = process.argv.slice(2);
if (!alvos.length) {
  console.error('uso: node scripts/checar-quiz.mjs <materia>/<tema> [...]');
  process.exit(2);
}
let falhou = 0;
for (const alvo of alvos) {
  const erros = checar(alvo.replace(/\.mdx$/, '').replace(/^src\/content\/enem\//, ''));
  if (erros.length) falhou++;
  console.log(`${erros.length ? 'FALHOU' : 'ok    '} quiz ${alvo}`);
  for (const e of erros) console.log(`  ✗ ${e}`);
}
process.exit(falhou ? 1 : 0);
