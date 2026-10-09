// Confere o contraste das cores do caderno (WCAG 2.x, nível AA) nos quatro modos:
// claro, escuro, claro + alto contraste, escuro + alto contraste.
//
// Uso: node scripts/checar-contraste.mjs [--tudo]
//   Sai com código 1 se algum par obrigatório ficar abaixo do mínimo.
//
// As cores são lidas de src/styles/global.css (nada é copiado para cá): se um
// token mudar, o resultado muda junto. Os pares de baixo descrevem ONDE cada
// cor é usada; ao criar um componente com cor nova, acrescente o par aqui.
//   texto  >= 4,5:1 (3:1 para texto grande, a partir de 24px ou 19px em negrito)
//   ui     >= 3:1   (bordas de controles, ícones que carregam significado, foco)
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(RAIZ, 'src', 'styles', 'global.css'), 'utf8');
const mostrarTudo = process.argv.includes('--tudo');

/* ------------------------------------------------------- leitura dos tokens */

/** Junta todas as declarações --nome: valor dos blocos cujo seletor passa em `ok`. */
function tokens(ok) {
  const mapa = {};
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, seletor, corpo] of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // @import/@plugin terminam em ";" e vêm coladas ao primeiro seletor.
    if (!ok(seletor.split(';').pop().trim())) continue;
    for (const m of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) mapa[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return mapa;
}

const modos = {
  claro: tokens((s) => s === '@theme' || s === ':root'),
  escuro: tokens((s) => s === '@theme' || s === ':root' || s === 'html[data-tema="escuro"]'),
  'claro + alto contraste': tokens((s) => s === '@theme' || s === ':root' || s === 'html[data-contraste="sim"]'),
  'escuro + alto contraste': tokens(
    (s) => s === '@theme' || s === ':root' || s === 'html[data-tema="escuro"]' || s === 'html[data-contraste="sim"]' || s === 'html[data-contraste="sim"][data-tema="escuro"]'
  ),
};

/* ---------------------------------------------------------- cores e cálculo */

function hex(h) {
  const v = h.replace('#', '');
  const f = v.length === 3 ? v.replace(/./g, '$&$&') : v;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}

/** Resolve "#abc", "var(--x)", "color-mix(in srgb, A 40%, B)" e "#fff"/"#000" para [r,g,b]. */
function cor(expr, vars, prof = 0) {
  if (prof > 12) throw new Error('referência circular: ' + expr);
  expr = expr.trim();
  if (expr.startsWith('#')) return hex(expr);
  const v = expr.match(/^var\((--[\w-]+)\)$/);
  if (v) {
    if (!(v[1] in vars)) throw new Error('token sem valor: ' + v[1]);
    return cor(vars[v[1]], vars, prof + 1);
  }
  const m = expr.match(/^color-mix\(in srgb,\s*(.+)\)$/);
  if (m) {
    // divide só nas vírgulas de nível 0
    const partes = [];
    let nivel = 0;
    let atual = '';
    for (const ch of m[1]) {
      if (ch === '(') nivel++;
      if (ch === ')') nivel--;
      if (ch === ',' && nivel === 0) {
        partes.push(atual);
        atual = '';
      } else atual += ch;
    }
    partes.push(atual);
    const lerParte = (p) => {
      const x = p.trim().match(/^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/s);
      return { c: x[1].trim(), pct: x[2] === undefined ? null : Number(x[2]) };
    };
    let [a, b] = partes.map(lerParte);
    if (a.pct === null && b.pct === null) (a.pct = 50), (b.pct = 50);
    else if (a.pct === null) a.pct = 100 - b.pct;
    else if (b.pct === null) b.pct = 100 - a.pct;
    const total = a.pct + b.pct;
    // "transparent" some do cálculo: o que sobra do percentual vira transparência, tratada
    // pelo chamador com `sobre`; aqui só misturamos cores opacas.
    const ca = cor(a.c, vars, prof + 1);
    const cb = cor(b.c, vars, prof + 1);
    return ca.map((x, i) => (x * a.pct + cb[i] * b.pct) / total);
  }
  if (expr === 'white') return [255, 255, 255];
  if (expr === 'black') return [0, 0, 0];
  throw new Error('não sei ler a cor: ' + expr);
}

/** Cor `fg` com opacidade `alfa` sobre `bg`. */
function sobre(fg, bg, alfa) {
  return fg.map((x, i) => x * alfa + bg[i] * (1 - alfa));
}

function lum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function razao(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* -------------------------------------------------------------------- pares */

const MATERIAS = [
  'matematica-basica', 'fisica', 'quimica', 'biologia', 'lingua-portuguesa', 'redacao', 'lingua-estrangeira',
  'artes', 'educacao-fisica', 'tic', 'historia', 'geografia', 'filosofia', 'sociologia',
  // DS e Escolar
  'front-end', 'back-end', 'banco-de-dados', 'inteligencia-artificial', 'programacao-mobile',
  'projeto-multidisciplinar', 'versionamento-de-codigo', 'matematica',
];
const FUNDOS = {
  papel: 'var(--color-paper)',
  folha: 'var(--color-surface)',
  'papel escuro': 'var(--color-paper-dark)',
  cartão: 'color-mix(in srgb, var(--color-paper-dark) 22%, var(--color-surface))',
};

/** Cada item: [rótulo, tipo, mínimo, fg, bg, alfa?]. fg/bg são expressões de cor. */
function pares(modo) {
  const p = [];
  const t = (rot, fg, bg, min = 4.5, alfa) => p.push([rot, 'texto', min, fg, bg, alfa]);
  const u = (rot, fg, bg, min = 3, alfa) => p.push([rot, 'ui', min, fg, bg, alfa]);

  for (const [nomeFundo, fundo] of Object.entries(FUNDOS)) {
    t(`texto principal sobre ${nomeFundo}`, 'var(--color-ink)', fundo);
    t(`texto secundário sobre ${nomeFundo}`, 'var(--color-ink-soft)', fundo);
  }
  for (const c of ['enem', 'escolar', 'ds']) {
    t(`destaque ${c} (texto) sobre a folha`, `var(--color-${c})`, 'var(--color-surface)');
    t(`destaque ${c} (texto) sobre o papel`, `var(--color-${c})`, 'var(--color-paper)');
    t(`destaque ${c} (texto) sobre o fundo suave`, `var(--color-${c})`, `var(--color-${c}-soft)`);
  }
  t('quiz: "ok" (acertou) sobre a folha', 'var(--color-ok)', 'var(--color-surface)');
  u('quiz: ícone de acerto (ok) sobre alternativa certa', 'var(--color-ok)', 'color-mix(in srgb, var(--color-ok) 12%, var(--color-surface))');
  u('quiz: ícone de erro (enem) sobre alternativa errada', 'var(--color-enem)', 'color-mix(in srgb, var(--color-enem) 10%, var(--color-surface))');
  t('quiz: botão principal (paper sobre ok)', 'var(--color-paper)', 'var(--color-ok)');
  t('quiz: botão principal em hover (paper sobre ok 85% + preto)', 'var(--color-paper)', 'color-mix(in srgb, var(--color-ok) 85%, black)');
  t('quiz: letra marcada (paper sobre escolar)', 'var(--color-paper)', 'var(--color-escolar)');
  t('quiz: letra certa (paper sobre ok)', 'var(--color-paper)', 'var(--color-ok)');
  t('quiz: letra errada (paper sobre enem)', 'var(--color-paper)', 'var(--color-enem)');
  t('botão "continuar" (seta paper sobre enem)', 'var(--color-paper)', 'var(--color-enem)', 3);
  t('link de pular / aba atual (paper sobre ink)', 'var(--color-paper)', 'var(--color-ink)');
  t('quiz: texto de resposta sobre caixa verde', 'var(--color-ink)', 'color-mix(in srgb, var(--color-ok) 9%, var(--color-surface))');
  t('trilha: título de aula vista (ink-soft sobre cartão vista)', 'var(--color-ink-soft)', 'var(--color-surface)');
  t('trilha: resumo de aula vista (ink-soft)', 'var(--color-ink-soft)', 'var(--color-surface)');
  t('redação: números da pauta (ink-soft)', 'var(--color-ink-soft)', 'color-mix(in srgb, var(--color-paper-dark) 22%, var(--color-surface))');
  t('redação: placeholder do campo (ink-soft)', 'var(--color-ink-soft)', 'var(--color-surface)');
  t('"voltar para" (ink-soft sobre o botão)', 'var(--color-ink-soft)', 'color-mix(in srgb, var(--color-paper-dark) 40%, var(--color-surface))');
  t('contador da busca (placeholder)', 'var(--color-ink-soft)', 'var(--color-surface)');

  for (const m of MATERIAS) {
    t(`matéria ${m} sobre a folha`, `var(--color-${m})`, 'var(--color-surface)');
    t(`matéria ${m} sobre o papel`, `var(--color-${m})`, 'var(--color-paper)');
    t(`matéria ${m} sobre o fundo suave`, `var(--color-${m})`, `var(--color-${m}-soft)`);
  }

  // Abas: texto = 70% da cor da aba + 30% de ink, sobre o fundo suave da aba.
  const abas = [
    ['Início', 'var(--color-ink)', 'var(--color-paper-dark)'],
    ['ENEM', 'var(--color-enem)', 'var(--color-enem-soft)'],
    ['Escolar', 'var(--color-escolar)', 'var(--color-escolar-soft)'],
    ['DS', 'var(--color-ds)', 'var(--color-ds-soft)'],
  ];
  for (const [n, c, soft] of abas) {
    t(`aba ${n} inativa`, `color-mix(in srgb, ${c} 70%, var(--color-ink))`, soft);
    t(`aba ${n} ativa`, `color-mix(in srgb, ${c} 70%, var(--color-ink))`, 'var(--color-surface)');
  }

  // Marcadores da direita (CabecalhoFixo.astro): ícone = 70% da cor da folha + 30% de ink,
  // sobre 12% da cor + folha. A cor é a da borda da folha: tinta (início), seção ou matéria.
  for (const c of ['ink', 'enem', 'escolar', 'ds', ...MATERIAS]) {
    u(`marcador fixo (${c}): ícone sobre o fundo`, `color-mix(in srgb, var(--color-${c}) 70%, var(--color-ink))`, `color-mix(in srgb, var(--color-${c}) 12%, var(--color-surface))`);
  }

  // Elementos de interface (3:1)
  u('foco (escolar) sobre a folha', 'var(--color-escolar)', 'var(--color-surface)');
  u('foco (escolar) sobre o papel', 'var(--color-escolar)', 'var(--color-paper)');
  u('foco (escolar) sobre o papel escuro', 'var(--color-escolar)', 'var(--color-paper-dark)');
  u('borda de campo/controle (--color-controle) sobre a folha', 'var(--color-controle)', 'var(--color-surface)');
  u('borda de campo/controle (--color-controle) sobre o papel', 'var(--color-controle)', 'var(--color-paper)');
  u('borda de campo/controle (--color-controle) sobre o papel escuro', 'var(--color-controle)', 'var(--color-paper-dark)');
  u('interruptor ligado (ok) sobre a folha', 'var(--color-ok)', 'var(--color-surface)');
  u('interruptor: bolinha sobre trilho ligado', 'var(--color-surface)', 'var(--color-ok)');
  // O sol só fica dourado (lado "ligado") no tema claro; no escuro ele é o lado desligado.
  if (modo.startsWith('claro')) u('tema: ícone do sol ativo (#8a6200) sobre o trilho', '#8a6200', 'color-mix(in srgb, var(--color-ink) 7%, var(--color-surface))');
  u('tema: ícone da lua ativa (escolar) sobre o trilho', 'var(--color-escolar)', 'color-mix(in srgb, var(--color-ink) 7%, var(--color-surface))');
  u('tema: ícone do lado desligado (ink-soft a 80%)', 'var(--color-ink-soft)', 'color-mix(in srgb, var(--color-ink) 7%, var(--color-surface))', 3, 0.8);
  u('barra de progresso (ok) sobre o trilho', 'var(--color-ok)', 'color-mix(in srgb, var(--color-ink) 10%, var(--color-surface))');
  u('barra de progresso (enem) sobre o trilho', 'var(--color-enem)', 'color-mix(in srgb, var(--color-ink) 10%, var(--color-surface))');
  return p;
}

/* --------------------------------------------------------------------- loop */

let falhas = 0;
for (const [modo, vars] of Object.entries(modos)) {
  // O token --color-controle ainda pode não existir (antes da correção): falha explícita.
  const linhas = [];
  for (const [rot, tipo, min, fg, bg, alfa] of pares(modo)) {
    let r;
    try {
      const b = cor(bg, vars);
      const f = cor(fg, vars);
      r = razao(alfa ? sobre(f, b, alfa) : f, b);
    } catch (e) {
      linhas.push({ rot, tipo, min, r: 0, erro: e.message });
      continue;
    }
    linhas.push({ rot, tipo, min, r });
  }
  const ruins = linhas.filter((l) => l.r < l.min);
  falhas += ruins.length;
  console.log(`\n=== ${modo}: ${linhas.length} pares, ${ruins.length} abaixo do mínimo ===`);
  for (const l of mostrarTudo ? linhas : ruins) {
    const marca = l.r < l.min ? 'FALHA' : '  ok ';
    console.log(`${marca} ${l.r.toFixed(2).padStart(5)}:1 (mín ${l.min})  ${l.rot}${l.erro ? '  [' + l.erro + ']' : ''}`);
  }
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares passam.');
process.exit(falhas ? 1 : 0);
