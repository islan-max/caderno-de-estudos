// Validador mecânico das aulas do ENEM (docs/aulas/formato-das-aulas-mdx.md, §3 e §5–§8).
//
// Uso: node scripts/validar-aula.mjs <aula.mdx | pasta> [...]
//   Sai com código 1 se houver erro. Avisos não reprovam.
//   Se o banco do INEP existir (.cache/inep/questoes), confere também a linha de fonte,
//   o gabarito oficial e as alternativas de cada questão oficial.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as lerYaml } from 'yaml';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANCO = join(RAIZ, '.cache', 'inep', 'questoes');

// §1: pasta -> subject
const MATERIAS = {
  biologia: 'Biologia', fisica: 'Física', quimica: 'Química', historia: 'História', geografia: 'Geografia',
  filosofia: 'Filosofia', sociologia: 'Sociologia', 'lingua-portuguesa': 'Língua Portuguesa',
  'lingua-estrangeira': 'Língua Estrangeira', redacao: 'Redação', artes: 'Artes', 'educacao-fisica': 'Educação Física',
  tic: 'Tecnologias da Informação e Comunicação', 'matematica-basica': 'Matemática Básica',
  'matematica-financeira': 'Matemática Financeira', geometria: 'Geometria',
  'estatistica-e-probabilidade': 'Estatística e Probabilidade', funcoes: 'Funções',
};
const SECOES = ['Antes de Começar', 'Aula Teórica Completa', 'Tópicos-Chave para Revisão', 'Teste de Fogo'];
const INSTRUCAO_TESTE = '*Marque uma alternativa em cada questão e confira tudo de uma vez no botão do fim.*';
const TAGS_SVG = ['svg', 'g', 'line', 'rect', 'circle', 'ellipse', 'path', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'marker'];
const TAGS = new Set(['div', 'figure', 'figcaption', 'b', ...TAGS_SVG]);
// nome da capa do caderno -> aplicações do banco (o site do INEP chama de "Reaplicação/PPL"
// o caderno que na capa diz "2ª aplicação"; em 2016 a PPL foi a "3ª aplicação")
const APLICACOES = {
  ppl: ['ppl'], digital: ['digital'], 'reaplicação': ['reaplicacao', 'ppl'], '2ª aplicação': ['segunda-aplicacao', 'ppl'],
  '3ª aplicação': ['terceira-aplicacao', 'ppl'], 'belém': ['belem'],
};
const CORES = ['azul', 'amarelo', 'branco', 'rosa', 'cinza', 'laranja', 'verde', 'roxo'];
const ROMANOS = /^(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX{0,3}I{0,3}|XXI)$/;

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normal = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9%,.]+/g, ' ').trim();

function semelhanca(a, b) {
  const pa = new Set(normal(a).split(' ').filter(Boolean));
  const pb = new Set(normal(b).split(' ').filter(Boolean));
  if (!pa.size && !pb.size) return 1;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / Math.max(pa.size, pb.size);
}

let banco = null;
function carregarBanco() {
  if (banco !== null) return banco;
  banco = [];
  if (existsSync(BANCO)) {
    for (const f of readdirSync(BANCO)) if (f.endsWith('.json')) banco.push(...JSON.parse(readFileSync(join(BANCO, f), 'utf8')));
  }
  return banco;
}

function validar(arquivo) {
  const erros = [];
  const avisos = [];
  const bruto = readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
  const linhas = bruto.split('\n');
  const erro = (n, msg) => erros.push(`${n ? `linha ${n}: ` : ''}${msg}`);
  const aviso = (n, msg) => avisos.push(`${n ? `linha ${n}: ` : ''}${msg}`);

  const caminho = relative(join(RAIZ, 'src', 'content', 'enem'), resolve(arquivo)).replace(/\\/g, '/');
  const [materia, nomeArq] = caminho.split('/');
  const tema = (nomeArq || '').replace(/\.mdx$/, '');

  // ------------------------------------------------------------ frontmatter
  if (linhas[0] !== '---') return { erros: ['o arquivo deve começar com o frontmatter (---)'], avisos };
  const fimFm = linhas.indexOf('---', 1);
  if (fimFm < 0) return { erros: ['frontmatter sem o --- de fechamento'], avisos };
  let fm;
  try {
    fm = lerYaml(linhas.slice(1, fimFm).join('\n'));
  } catch (e) {
    return { erros: [`frontmatter inválido: ${e.message}`], avisos };
  }
  const deslocamento = fimFm + 1; // número da linha (base 1) da primeira linha do corpo = deslocamento + 1
  const corpo = linhas.slice(fimFm + 1);
  const L = (i) => i + deslocamento + 1;

  const campos = new Set(['title', 'subject', 'order', 'relevance', 'quickSummary', 'resources', 'gabarito']);
  for (const k of Object.keys(fm)) if (!campos.has(k)) erro(0, `campo "${k}" não existe no schema (seria ignorado sem aviso)`);
  for (const k of ['title', 'subject', 'relevance', 'quickSummary']) if (typeof fm[k] !== 'string' || !fm[k].trim()) erro(0, `falta "${k}"`);
  if (!Number.isInteger(fm.order)) erro(0, '"order" deve ser um número inteiro');
  if (!/^[a-z0-9-]+$/.test(tema)) erro(0, `nome do arquivo "${tema}" deve ter só minúsculas, números e hífen`);
  if (!MATERIAS[materia]) erro(0, `pasta "${materia}" não é matéria do ENEM`);
  else if (fm.subject !== MATERIAS[materia]) erro(0, `subject deve ser "${MATERIAS[materia]}" (pasta ${materia}), está "${fm.subject}"`);
  for (const k of ['relevance', 'quickSummary']) {
    const v = fm[k] || '';
    if (/\*\*|__|\[.*\]\(|^#|`/m.test(v)) erro(0, `"${k}" aparece como texto puro no site: sem markdown`);
    if (/[{}<]/.test(v)) erro(0, `"${k}" não pode ter { } ou <`);
  }
  const palavrasRel = (fm.relevance || '').split(/\s+/).filter(Boolean).length;
  if (palavrasRel < 45 || palavrasRel > 170) aviso(0, `relevance com ${palavrasRel} palavras (o padrão é 4 a 7 linhas)`);
  const palavrasRes = (fm.quickSummary || '').split(/\s+/).filter(Boolean).length;
  if (palavrasRes < 15 || palavrasRes > 90) aviso(0, `quickSummary com ${palavrasRes} palavras (o padrão é 2 a 4 linhas)`);
  if (/cai \d+ vez|\d+ ?% das (provas|quest)|em \d+ de cada \d+ provas/i.test(bruto)) aviso(0, 'número de frequência: confira se tem fonte');

  // ------------------------------------------------------- seções (##) na ordem
  const h2 = [];
  corpo.forEach((l, i) => {
    const m = l.match(/^## (.+)$/);
    if (m) h2.push({ titulo: m[1].trim(), i });
  });
  const titulos = h2.map((h) => h.titulo);
  if (JSON.stringify(titulos) !== JSON.stringify(SECOES)) erro(0, `as seções ## devem ser exatamente, nesta ordem: ${SECOES.join(' | ')}. Encontrado: ${titulos.join(' | ') || '(nenhuma)'}`);
  const secao = (nome) => {
    const k = h2.findIndex((h) => h.titulo === nome);
    if (k < 0) return { ini: -1, fim: -1, linhas: [] };
    const ini = h2[k].i + 1;
    const fim = k + 1 < h2.length ? h2[k + 1].i : corpo.length;
    return { ini, fim, linhas: corpo.slice(ini, fim) };
  };
  const antes = secao('Antes de Começar');
  const teoria = secao('Aula Teórica Completa');
  const topicos = secao('Tópicos-Chave para Revisão');
  const teste = secao('Teste de Fogo');

  // ------------------------------------------------------ regras de MDX (§8)
  corpo.forEach((l, i) => {
    if (/^-{3,}\s*$/.test(l)) erro(L(i), '"---" no corpo quebra o MDX');
    if (/[{}]/.test(l)) erro(L(i), 'chaves { } não podem aparecer no texto');
    if (/(?<!R)\$[^$\s][^$]*\$/.test(l)) erro(L(i), 'LaTeX ($…$) não funciona no site: use Unicode');
    if (/\d\s*\*\s*\d/.test(l)) erro(L(i), 'use × ou · para multiplicar, nunca *');
    if (/[A-Za-zÀ-ú0-9]_[A-Za-zÀ-ú0-9]/.test(l) && !/^\s*</.test(l) && !/\]\(\.\/img\//.test(l)) erro(L(i), '"_" no meio de palavra vira itálico no MDX');
    const semTagsMenos = l.replace(/<[^>]*>/g, ' ');
    if (/(^|[\s(=[])-\d/.test(semTagsMenos.replace(/^\s*- /, '  '))) erro(L(i), 'sinal de menos deve ser "−" (Unicode), não "-"');
    if (/!\[[^\]]*\]\(\s*https?:/i.test(l) || /<img\b/i.test(l)) erro(L(i), 'imagem externa ou <img>: use arquivo local em ./img/<tema>/');
    for (const m of l.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>?/g)) {
      const tag = m[1].toLowerCase();
      if (!TAGS.has(tag)) erro(L(i), `tag <${m[1]}> não é permitida (§8)`);
      if (tag === 'div' && m[0].startsWith('<div') && !/className="topico"/.test(m[2])) erro(L(i), 'só <div className="topico"> é permitido');
      if (tag === 'figure' && m[0].startsWith('<figure') && !/class="figura"/.test(m[2])) erro(L(i), 'figura deve ser <figure class="figura">');
    }
    // "<" solto no texto (fora de tag)
    const semTags = l.replace(/<\/?[a-zA-Z][^>]*>/g, '');
    if (/</.test(semTags)) erro(L(i), '"<" no texto deve ser &lt;');
    if (/^\s*\*\*Quest[ãa]o\s+\d+/.test(l) && (i < teste.ini || teste.ini < 0)) erro(L(i), 'negrito começando com "Questão N" fora do Teste de Fogo confunde o quiz');
  });
  // linha em branco entre tag e markdown
  const ehTag = (l) => /^\s*<\/?[a-zA-Z]/.test(l);
  const ehMd = (l) => l.trim() !== '' && !ehTag(l);
  for (let i = 1; i < corpo.length; i++) {
    const a = corpo[i - 1];
    const b = corpo[i];
    if ((ehTag(a) && ehMd(b)) || (ehMd(a) && ehTag(b))) {
      // exceção: conteúdo de texto dentro de <text>/<title>/<desc>/<figcaption> na mesma linha já é tag
      erro(L(i), 'falta linha em branco entre tag e markdown');
    }
  }
  // ### só na teoria, #### só nos tópicos
  corpo.forEach((l, i) => {
    if (/^### /.test(l) && !(i >= teoria.ini && i < teoria.fim)) erro(L(i), '### só dentro da Aula Teórica Completa');
    if (/^#### /.test(l) && !(i >= topicos.ini && i < topicos.fim)) erro(L(i), '#### só dentro dos Tópicos-Chave');
    if (/^#{5,} |^# /.test(l)) erro(L(i), 'nível de título não usado no padrão');
  });

  // --------------------------------------------------------- Antes de Começar
  const txtAntes = antes.linhas.join('\n');
  if (antes.ini >= 0) {
    if (!/^\*\*O que o ENEM cobra aqui\.\*\*/m.test(txtAntes)) erro(L(antes.ini), 'falta "**O que o ENEM cobra aqui.**"');
    if (!/^\*\*Palavras e siglas desta aula\*\*$/m.test(txtAntes)) erro(L(antes.ini), 'falta "**Palavras e siglas desta aula**"');
    if (!/^\*\*Símbolos desta aula\*\*$/m.test(txtAntes)) erro(L(antes.ini), 'falta "**Símbolos desta aula**"');
    if (!/^\| Símbolo \| Como se lê \| O que significa \| Exemplo \|$/m.test(txtAntes)) erro(L(antes.ini), 'falta a tabela de símbolos com o cabeçalho | Símbolo | Como se lê | O que significa | Exemplo |');
    if (!/^\*\*O que você precisa saber antes\.\*\*/m.test(txtAntes)) erro(L(antes.ini), 'falta "**O que você precisa saber antes.**"');
  }
  // glossário: itens "- **Termo** …: …"
  const glossario = new Set();
  let noGlossario = false;
  antes.linhas.forEach((l, k) => {
    if (/^\*\*Palavras e siglas desta aula\*\*/.test(l)) { noGlossario = true; return; }
    if (noGlossario && /^\*\*/.test(l)) noGlossario = false;
    if (noGlossario && /^- /.test(l)) {
      const m = l.match(/^- \*\*([^*]+)\*\*/);
      if (!m || !/:/.test(l)) erro(L(antes.ini + k), 'item do glossário deve ser "- **Termo**: explicação" ou "- **SIGLA** (por extenso): explicação"');
      else glossario.add(m[1].trim());
    }
  });
  if (antes.ini >= 0 && glossario.size < 3) erro(L(antes.ini), 'glossário com menos de 3 termos');
  // tabela de símbolos
  const simbolos = new Set();
  let naTabela = false;
  antes.linhas.forEach((l) => {
    if (/^\| Símbolo \|/.test(l)) { naTabela = true; return; }
    if (naTabela && /^\|---/.test(l)) return;
    if (naTabela && /^\|/.test(l)) simbolos.add(l.split('|')[1].trim());
    else naTabela = false;
  });
  if (antes.ini >= 0 && simbolos.size < 1) erro(L(antes.ini), 'tabela de símbolos sem linhas');

  // -------------------------------------------------------------- siglas (§4)
  // Toda sigla (2+ maiúsculas) fora do Teste de Fogo: no glossário e, na primeira
  // aparição (quickSummary → relevance → corpo), seguida da forma por extenso entre parênteses.
  const textoOrdem = [
    ['quickSummary', fm.quickSummary || '', 0],
    ['relevance', fm.relevance || '', 0],
    ...corpo.map((l, i) => ['corpo', i < teste.ini || teste.ini < 0 ? l : '', L(i)]),
  ];
  const vistas = new Set();
  for (const [onde, t, n] of textoOrdem) {
    const limpo = t.replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/\*\*/g, '');
    for (const m of limpo.matchAll(/(?<![\p{L}\d₀-₉⁰-⁹])([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}[a-z]?)(?![\p{L}\d₀-₉⁰-⁹])/gu)) {
      const s = m[1];
      if (ROMANOS.test(s) || vistas.has(s)) continue;
      vistas.add(s);
      const depois = limpo.slice(m.index + s.length, m.index + s.length + 4);
      const antesDe = limpo.slice(Math.max(0, m.index - 2), m.index);
      if (!/^\s?\(/.test(depois) && !/\($/.test(antesDe)) erro(n, `sigla ${s} na primeira aparição (${onde}) sem o nome por extenso entre parênteses`);
      if (!glossario.has(s)) erro(n, `sigla ${s} não está em "Palavras e siglas desta aula"`);
    }
  }

  // ---------------------------------------------------- Aula Teórica (§3, §4)
  const secoesTeoria = [];
  teoria.linhas.forEach((l, k) => {
    const m = l.match(/^### (.+)$/);
    if (m) secoesTeoria.push({ titulo: m[1].trim(), k });
  });
  const numeradas = secoesTeoria.filter((s) => /^\d+\. /.test(s.titulo));
  numeradas.forEach((s, j) => {
    if (!s.titulo.startsWith(`${j + 1}. `)) erro(L(teoria.ini + s.k), `seção deveria ser "### ${j + 1}. …" (numeração em ordem)`);
  });
  if (teoria.ini >= 0 && numeradas.length < 2) erro(L(teoria.ini), 'Aula Teórica com menos de 2 seções numeradas');
  const ultimaTeoria = secoesTeoria[secoesTeoria.length - 1];
  if (teoria.ini >= 0 && (!ultimaTeoria || ultimaTeoria.titulo !== 'Armadilhas típicas do INEP')) erro(L(teoria.ini), 'a última seção da Aula Teórica deve ser "### Armadilhas típicas do INEP"');
  secoesTeoria.filter((s) => !/^\d+\. /.test(s.titulo) && s.titulo !== 'Armadilhas típicas do INEP').forEach((s) => erro(L(teoria.ini + s.k), `seção "### ${s.titulo}" fora do padrão (numeradas + Armadilhas)`));
  // cartão de fórmula
  const formulas = [];
  teoria.linhas.forEach((l, k) => {
    if (!/^\*\*Fórmula: .+\*\*$/.test(l)) return;
    let j = k + 1;
    while (j < teoria.linhas.length && !teoria.linhas[j].trim()) j++;
    const f = teoria.linhas[j] || '';
    if (!/^\*\*[^*]+\*\*$/.test(f)) erro(L(teoria.ini + j), 'depois de "**Fórmula: …**" vem a fórmula sozinha, em negrito');
    else formulas.push({ f, k: j });
    const proxima = teoria.linhas.findIndex((x, y) => y > k && (/^### /.test(x) || /^\*\*Fórmula: /.test(x)));
    const bloco = teoria.linhas.slice(k, proxima < 0 ? undefined : proxima).join('\n');
    for (const parte of ['**Em palavras:**', '**Quando usar:**', '**Exemplo resolvido.**', '**Erro comum.**']) {
      if (!bloco.includes(parte)) erro(L(teoria.ini + k), `cartão de fórmula sem ${parte}`);
    }
    if (!/^- \*\*[^*]+\*\*: /m.test(bloco)) erro(L(teoria.ini + k), 'cartão de fórmula sem a lista "- **letra**: significado e unidade"');
  });
  // figuras na teoria
  const figurasTeoria = teoria.linhas.filter((l) => /<figure class="figura">/.test(l)).length;
  if (teoria.ini >= 0 && figurasTeoria < 1) erro(L(teoria.ini), 'Aula Teórica sem nenhuma figura (§5: toda aula tem imagens)');
  // numeração das figuras na teoria
  let nfig = 0;
  teoria.linhas.forEach((l, k) => {
    const m = l.match(/<b>Figura (\d+)\.<\/b>/);
    if (m) {
      nfig++;
      if (Number(m[1]) !== nfig) erro(L(teoria.ini + k), `figura numerada ${m[1]}, deveria ser ${nfig}`);
    }
  });
  // frases longas (aviso)
  teoria.linhas.forEach((l, k) => {
    if (/^\s*(<|\||#)/.test(l)) return;
    for (const frase of l.replace(/\*\*/g, '').split(/(?<=[.!?])\s+/)) {
      const n = frase.split(/\s+/).filter(Boolean).length;
      if (n > 32) aviso(L(teoria.ini + k), `frase com ${n} palavras (o padrão é até ~20)`);
    }
  });

  // --------------------------------------------------------- Tópicos-Chave (§6)
  if (topicos.ini >= 0) {
    const t = topicos.linhas;
    const abre = t.findIndex((l) => l.trim() === '<div className="topico">');
    const fecha = t.map((l) => l.trim()).lastIndexOf('</div>');
    if (abre < 0 || fecha < 0) erro(L(topicos.ini), 'Tópicos devem estar dentro de <div className="topico"> … </div>');
    else {
      if (t[abre + 1]?.trim() !== '') erro(L(topicos.ini + abre + 1), 'linha em branco depois de <div className="topico">');
      if (t[fecha - 1]?.trim() !== '') erro(L(topicos.ini + fecha), 'linha em branco antes de </div>');
      const titulosT = [];
      t.forEach((l, k) => {
        const m = l.match(/^#### (.+)$/);
        if (m) titulosT.push({ titulo: m[1], k });
      });
      if (titulosT.length < 3) erro(L(topicos.ini), 'menos de 3 tópicos');
      titulosT.forEach((s, j) => {
        if (!s.titulo.startsWith(`${j + 1}. `)) erro(L(topicos.ini + s.k), `tópico deveria ser "#### ${j + 1}. …"`);
        const fim = j + 1 < titulosT.length ? titulosT[j + 1].k : fecha;
        const bloco = t.slice(s.k + 1, fim);
        // um parágrafo de texto (fora de figura) com ≥2 negritos
        const semFig = [];
        let emFig = false;
        for (const l of bloco) {
          if (/<figure/.test(l)) emFig = true;
          if (!emFig) semFig.push(l);
          if (/<\/figure>/.test(l)) emFig = false;
        }
        const paragrafos = semFig.join('\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        if (paragrafos.length !== 1) erro(L(topicos.ini + s.k), `tópico "${s.titulo}" deve ter exatamente 1 parágrafo (tem ${paragrafos.length})`);
        const p = paragrafos[0] || '';
        if (/^\s*(- |\d+\. )/m.test(p)) erro(L(topicos.ini + s.k), `tópico "${s.titulo}" sem bullets nem listas`);
        if ((p.match(/\*\*[^*]+\*\*/g) || []).length < 2) erro(L(topicos.ini + s.k), `tópico "${s.titulo}" precisa de pelo menos 2 palavras-chave em negrito`);
      });
      const txtTop = t.join('\n');
      for (const { f, k } of formulas) {
        if (!txtTop.includes(f)) erro(L(teoria.ini + k), `a fórmula ${f} não aparece, igual e em negrito, nos Tópicos-Chave`);
      }
    }
  }

  // ---------------------------------------------------------- figuras (§5)
  const idsSvg = new Map();
  corpo.forEach((l, i) => {
    for (const m of l.matchAll(/\bid="([^"]+)"/g)) {
      if (idsSvg.has(m[1])) erro(L(i), `id "${m[1]}" repetido na página (a cópia nos Tópicos usa sufixo -rev)`);
      idsSvg.set(m[1], i);
    }
    if (/<svg\b/.test(l)) {
      if (!/role="img"/.test(l) || !/aria-labelledby="[^"]+ [^"]+"/.test(l)) erro(L(i), '<svg> precisa de role="img" e aria-labelledby="<id-título> <id-descrição>"');
      if (!/viewBox="/.test(l)) erro(L(i), '<svg> precisa de viewBox');
    }
    if (/fill="#|stroke="#|style=/.test(l)) erro(L(i), 'SVG sem cor fixa nem style=: use as classes traco, traco-fino, tracejado, preenche, rotulo, rotulo-fraco');
    const img = l.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      if (!img[1].trim() || img[1].trim().length < 15) erro(L(i), 'descrição da imagem (alt) vazia ou curta demais');
      if (!img[2].startsWith(`./img/${tema}/`)) erro(L(i), `imagem deve estar em ./img/${tema}/`);
      else if (!existsSync(join(dirname(arquivo), img[2]))) erro(L(i), `arquivo não existe: ${img[2]}`);
      if (corpo[i - 1]?.trim() !== '' || corpo[i + 1]?.trim() !== '') erro(L(i), 'imagem precisa de linha em branco antes e depois');
    } else if (/!\[/.test(l)) erro(L(i), 'imagem markdown deve ficar sozinha na linha: ![descrição](./img/tema/arquivo.png)');
  });
  // cada <figure> tem figcaption; cada svg tem title e desc com os ids do aria-labelledby
  const txt = corpo.join('\n');
  const figs = [...txt.matchAll(/<figure class="figura">([\s\S]*?)<\/figure>/g)];
  for (const f of figs) {
    if (!/<figcaption>[\s\S]+<\/figcaption>/.test(f[1])) erro(0, 'figura sem <figcaption>');
    const svg = f[1].match(/<svg[^>]*aria-labelledby="([^"]+)"/);
    if (svg) {
      const [idT, idD] = svg[1].split(/\s+/);
      if (!new RegExp(`<title id="${idT}">[^<]+</title>`).test(f[1])) erro(0, `svg sem <title id="${idT}">`);
      if (!new RegExp(`<desc id="${idD}">[^<]+</desc>`).test(f[1])) erro(0, `svg sem <desc id="${idD}">`);
    }
  }

  // ---------------------------------------------------- Teste de Fogo (§7)
  const questoes = [];
  if (teste.ini >= 0) {
    const t = teste.linhas;
    const primeira = t.find((l) => l.trim());
    if (primeira !== INSTRUCAO_TESTE) erro(L(teste.ini), `a primeira linha do Teste de Fogo deve ser ${INSTRUCAO_TESTE}`);
    t.forEach((l, k) => {
      const m = l.match(/^\*\*Quest[ãa]o (\d+)\*\*(.*)$/);
      if (!m) return;
      if (m[2].trim()) erro(L(teste.ini + k), 'o rótulo "**Questão N**" fica sozinho na linha');
      questoes.push({ n: Number(m[1]), k });
    });
    if (questoes.length !== 5) erro(L(teste.ini), `o Teste de Fogo tem ${questoes.length} questões; devem ser 5`);
    questoes.forEach((q, j) => {
      if (q.n !== j + 1) erro(L(teste.ini + q.k), `questão numerada ${q.n}, deveria ser ${j + 1}`);
      const fim = j + 1 < questoes.length ? questoes[j + 1].k : t.length;
      const bloco = t.slice(q.k + 1, fim);
      const nb = bloco.findIndex((l) => l.trim());
      const fonte = bloco[nb] || '';
      q.fonte = fonte;
      q.linhaFonte = L(teste.ini + q.k + 1 + nb);
      const oficial = fonte.match(/^\*ENEM (\d{4}) · (?:(PPL|digital|reaplicação|2ª aplicação|3ª aplicação|Belém) · )?([12])º dia · caderno (\w+) · questão (\d{1,3})(?: · (inglês|espanhol))?\*$/);
      const autoral = fonte === '*Questão autoral no estilo ENEM*';
      if (!oficial && !autoral) erro(q.linhaFonte, 'linha de fonte fora do formato: *ENEM 2019 · PPL · 2º dia · caderno azul · questão 146* (aplicação só se não for a regular; " · inglês/espanhol" nas questões de língua) ou *Questão autoral no estilo ENEM*');
      q.oficial = oficial;
      q.autoral = autoral;
      if (autoral) aviso(q.linhaFonte, `questão ${q.n} é autoral: avisar no relato`);
      // alternativas: 5 linhas seguidas A) … E), A–D com "\" no fim
      const iA = bloco.findIndex((l) => /^A\) /.test(l));
      if (iA < 0) {
        erro(L(teste.ini + q.k), `questão ${q.n} sem alternativas no formato "A) …"`);
        return;
      }
      const alts = bloco.slice(iA, iA + 5);
      const letras = ['A', 'B', 'C', 'D', 'E'];
      alts.forEach((l, y) => {
        const n = L(teste.ini + q.k + 1 + iA + y);
        if (!l.startsWith(`${letras[y]}) `)) erro(n, `esperava a alternativa ${letras[y]}) nesta linha (5 linhas seguidas, sem linha em branco)`);
        if (y < 4 && !l.endsWith('\\')) erro(n, `alternativa ${letras[y]} deve terminar com "\\"`);
        if (y === 4 && l.endsWith('\\')) erro(n, 'a alternativa E não termina com "\\"');
      });
      if (bloco[iA - 1]?.trim() !== '') erro(L(teste.ini + q.k + iA), 'linha em branco antes das alternativas');
      const depois = bloco.slice(iA + 5).filter((l) => l.trim());
      if (depois.length && j < questoes.length - 1) erro(L(teste.ini + q.k + iA + 6), 'nada entre a alternativa E e a próxima questão');
      q.alternativas = alts.map((l) => l.replace(/^[A-E]\) /, '').replace(/\\$/, '').trim());
      q.temFigura = bloco.slice(0, iA).some((l) => /<figure class="figura">/.test(l));
      q.remeteProva = bloco.slice(0, iA).some((l) => /Texto-base: ver prova oficial/.test(l));
    });
  }

  // --------------------------------------------------------------- gabarito
  const secoesTeoriaNomes = new Set(numeradas.map((s) => s.titulo));
  if (!Array.isArray(fm.gabarito) || fm.gabarito.length !== 5) erro(0, 'gabarito deve ter exatamente 5 itens');
  else {
    fm.gabarito.forEach((g, j) => {
      if (!Number.isInteger(g?.correta) || g.correta < 0 || g.correta > 4) erro(0, `gabarito[${j}].correta deve ser 0 a 4`);
      const p = (g?.porque || '').trim();
      if (!p) erro(0, `gabarito[${j}] sem "porque"`);
      const m = p.match(/Revisar: Aula Teórica › (.+?)\.?$/);
      if (!m) erro(0, `gabarito[${j}].porque deve terminar com "Revisar: Aula Teórica › N. Nome da seção"`);
      else if (!secoesTeoriaNomes.has(m[1].trim())) erro(0, `gabarito[${j}] aponta "${m[1]}", que não é uma seção ### da Aula Teórica`);
      if (/[{}<]/.test(p) || /\*\*/.test(p)) erro(0, `gabarito[${j}].porque aparece como texto puro: sem markdown, { } ou <`);
    });
  }

  // ------------------------------------------- conferência com o banco do INEP
  const lista = carregarBanco();
  if (lista.length && questoes.length) {
    const vistasIds = new Set();
    questoes.forEach((q, j) => {
      if (!q.oficial) return;
      const [, ano, apl, dia, cor, num, lingua] = q.oficial;
      if (!CORES.includes(cor)) erro(q.linhaFonte, `cor de caderno desconhecida: ${cor}`);
      const aplicacoes = apl ? APLICACOES[apl.toLowerCase()] : ['regular'];
      const aplicacao = aplicacoes.join('/');
      const achadas = lista.filter((b) => b.ano === Number(ano) && aplicacoes.includes(b.aplicacao) && b.dia === Number(dia) && b.cor === cor
        && b.numero === Number(num) && (!lingua || b.lingua === lingua.replace('ê', 'e')));
      if (!achadas.length) {
        erro(q.linhaFonte, `questão ${q.n}: não está no banco do INEP (${ano} ${aplicacao} D${dia} ${cor} Q${num}${lingua ? ' ' + lingua : ''}). Use \`banco_inep.py localizar\` ou corrija a fonte`);
        return;
      }
      if (achadas.length > 1 && !lingua) {
        erro(q.linhaFonte, `questão ${q.n}: é questão de língua estrangeira; acrescente " · inglês" ou " · espanhol" à fonte`);
        return;
      }
      const b = achadas[0];
      if (vistasIds.has(b.id)) erro(q.linhaFonte, `questão ${b.id} repetida`);
      vistasIds.add(b.id);
      if (b.anulada || !b.gabarito || b.gabarito === 'anulada') erro(q.linhaFonte, `questão ${q.n} (${b.id}) foi anulada ou não tem gabarito oficial`);
      else if (Array.isArray(fm.gabarito) && fm.gabarito[j] && 'ABCDE'[fm.gabarito[j].correta] !== b.gabarito) {
        erro(q.linhaFonte, `questão ${q.n} (${b.id}): gabarito da aula é ${'ABCDE'[fm.gabarito[j].correta]}, o oficial do INEP é ${b.gabarito}`);
      }
      if (b.alternativas?.length === 5 && !b.alternativas_em_imagem && b.texto_ilegivel < 0.02 && q.alternativas) {
        const falhas = q.alternativas.map((a, y) => [y, semelhanca(a, b.alternativas[y])]).filter(([, s]) => s < 0.75);
        // frações e expressões saem da prova com numerador e denominador fora de ordem;
        // aí compara o conjunto das 5 alternativas e deixa a ordem para o revisor (na imagem)
        const conjunto = semelhanca(q.alternativas.join(' '), b.alternativas.join(' '));
        if (falhas.length >= 2 && conjunto >= 0.75) {
          aviso(q.linhaFonte, `questão ${q.n}: alternativas não batem uma a uma com o texto extraído (${Math.round(conjunto * 100)}% no conjunto); conferir na imagem da prova`);
        } else {
          for (const [y, s] of falhas) erro(q.linhaFonte, `questão ${q.n}, alternativa ${'ABCDE'[y]} difere da prova (${Math.round(s * 100)}%): prova diz "${b.alternativas[y].slice(0, 90)}"`);
        }
      } else if (q.alternativas && (!b.alternativas?.length || b.texto_ilegivel >= 0.02)) {
        aviso(q.linhaFonte, `questão ${q.n}: o banco não tem o texto das alternativas; conferir na imagem da prova`);
      }
      if (b.figuras?.length && !q.temFigura && !q.remeteProva) erro(q.linhaFonte, `questão ${q.n} (${b.id}) tem figura na prova, mas não na aula`);
      if (b.alternativas_em_imagem && !q.temFigura) erro(q.linhaFonte, `questão ${q.n}: alternativas em imagem na prova; coloque a figura com as 5 opções antes das alternativas (§5)`);
    });
  }

  return { erros, avisos };
}

// ------------------------------------------------------------------ execução
function arquivos(alvos) {
  const saida = [];
  for (const a of alvos) {
    if (statSync(a).isDirectory()) {
      for (const f of readdirSync(a)) {
        const p = join(a, f);
        if (statSync(p).isDirectory()) { if (f !== 'img') saida.push(...arquivos([p])); } else if (f.endsWith('.mdx')) saida.push(p);
      }
    } else saida.push(a);
  }
  return saida;
}

const alvos = process.argv.slice(2);
if (!alvos.length) {
  console.error('uso: node scripts/validar-aula.mjs <aula.mdx | pasta> [...]');
  process.exit(2);
}
let falhou = 0;
for (const f of arquivos(alvos)) {
  const { erros, avisos } = validar(f);
  const nome = relative(RAIZ, resolve(f)).replace(/\\/g, '/');
  if (erros.length) falhou++;
  console.log(`${erros.length ? 'FALHOU' : 'ok    '} ${nome}${erros.length ? ` (${erros.length} erro${erros.length > 1 ? 's' : ''})` : ''}`);
  for (const e of erros) console.log(`  ✗ ${e}`);
  for (const a of avisos) console.log(`  ! ${a}`);
}
if (!carregarBanco().length) console.log('(banco do INEP ausente: fonte e gabarito oficiais não foram conferidos)');
process.exit(falhou ? 1 : 0);
