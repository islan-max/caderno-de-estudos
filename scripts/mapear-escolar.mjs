// Gera src/data/escolar-mapa.json: o mapa da aba Escolar (matéria → bimestre → aula).
//
// Uso: node scripts/mapear-escolar.mjs [pasta-do-material]
//   Padrão da pasta: C:\Users\MAX\Desktop\Escolar
//
// O material é uma pasta por matéria com "Aula N.pdf" (hoje só o 4º bimestre). O título, o
// bimestre e os tópicos vêm das duas primeiras páginas de cada PDF (precisa do pdftotext; defina
// PDFTOTEXT se ele não estiver no PATH). Os números que não têm PDF (o material não foi
// liberado) entram no mapa como `material: false`: a trilha mostra "Sem material", sem link.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = process.argv[2] ?? 'C:\\Users\\MAX\\Desktop\\Escolar';
const SAIDA = join(RAIZ, 'src', 'data', 'escolar-mapa.json');

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpa = (t) => t.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const slug = (t) =>
  semAcento(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function primeirasPaginas(arquivo) {
  try {
    return execFileSync(process.env.PDFTOTEXT ?? 'pdftotext', ['-enc', 'UTF-8', '-f', '1', '-l', '2', arquivo, '-'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1 << 26,
    });
  } catch (e) {
    console.error(e.code === 'ENOENT' ? 'pdftotext não encontrado (defina PDFTOTEXT).' : `PDF ilegível: ${arquivo}`);
    process.exit(1);
  }
}

// Maiúsculas de título, no padrão do site ("Grandezas Determinadas pela Razão ou pelo Produto").
const MIUDAS = new Set(['a', 'as', 'o', 'os', 'e', 'ou', 'de', 'da', 'das', 'do', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'pela', 'pelo', 'pelas', 'pelos', 'ao', 'aos', 'à', 'às', 'entre', 'sobre', 'como', 'sem', 'sob']);
function titulo(t) {
  let inicio = true;
  return t
    .split(' ')
    .map((p) => {
      const minuscula = p.toLowerCase();
      const novo = inicio || !MIUDAS.has(minuscula) ? minuscula[0].toUpperCase() + minuscula.slice(1) : minuscula;
      inicio = /[:–]$/.test(p);
      return novo;
    })
    .join(' ');
}

// Defeitos de extração do texto dos PDFs.
const TROCAS = [
  [/dissertativoargumentativo/gi, 'dissertativo-argumentativo'],
  [/(\p{L})–/gu, '$1 –'],
  [/–(\p{L})/gu, '– $1'],
];
const arrumar = (t) => TROCAS.reduce((acc, [de, para]) => acc.replace(de, para), t);

// Os tópicos são os primeiros "●" da capa, antes dos objetivos (que começam por um verbo no
// infinitivo: "Ler", "Resolver", "Conceituar"…). Os objetivos e o resto ficam de fora.
function topicos(linhas) {
  const i = linhas.findIndex((l) => l.startsWith('●'));
  if (i < 0) return [];
  const fim = linhas.findIndex((l, k) => k > i && /^(Para começar|\d+ minutos)/.test(l));
  const bloco = linhas.slice(i, fim < 0 ? undefined : fim).join(' ');
  const itens = bloco.split('●').map(limpa).filter(Boolean);
  const primeiroObjetivo = itens.findIndex((t) => /^\p{Lu}\p{L}*(ar|er|ir|or)\b/u.test(t));
  const topicosDaAula = primeiroObjetivo < 0 ? itens.slice(0, 1) : itens.slice(0, primeiroObjetivo);
  return topicosDaAula.map((t) => t.replace(/[.;]+$/, ''));
}

const materias = [];
for (const nome of readdirSync(ORIGEM).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
  const pasta = join(ORIGEM, nome);
  if (!existsSync(pasta) || !readdirSync(pasta).some((f) => /^Aula \d+\.pdf$/.test(f))) continue;

  const porNumero = new Map(); // número da aula -> dados do PDF
  const bimestres = new Set();
  for (const arq of readdirSync(pasta)) {
    const m = arq.match(/^Aula (\d+)\.pdf$/);
    if (!m) continue;
    const linhas = primeirasPaginas(join(pasta, arq))
      .split('\n')
      .map(limpa)
      .filter(Boolean);
    const iCapa = linhas.findIndex((l) => /^\d+o bimestre Aula \d+$/.test(l));
    if (iCapa < 1) throw new Error(`${arq}: capa não reconhecida`);
    const [, bim, n] = linhas[iCapa].match(/^(\d+)o bimestre Aula (\d+)$/);
    if (Number(n) !== Number(m[1])) throw new Error(`${arq}: o número da capa (${n}) não bate com o do arquivo`);
    bimestres.add(Number(bim));
    porNumero.set(Number(n), {
      bimestre: Number(bim),
      titulo: titulo(arrumar(linhas[iCapa - 1])),
      topicos: topicos(linhas.slice(iCapa + 1)).map(arrumar),
    });
  }
  if (bimestres.size !== 1) throw new Error(`${nome}: aulas de mais de um bimestre (${[...bimestres]})`);
  const numero = [...bimestres][0];

  // Posições sem PDF (material não liberado) ficam no mapa, marcadas.
  const total = Math.max(...porNumero.keys());
  const aulas = [];
  for (let pos = 1; pos <= total; pos++) {
    const a = porNumero.get(pos);
    if (a) {
      aulas.push({ pos, slug: `aula-${pos}-${slug(a.titulo)}`, titulo: a.titulo, topicos: a.topicos, material: true });
    } else {
      aulas.push({ pos, slug: `aula-${pos}-material-indisponivel`, titulo: `Aula ${pos}: material indisponível`, topicos: [], material: false });
    }
  }
  materias.push({ slug: slug(nome), nome, bimestres: [{ numero, slug: `${numero}-bimestre`, aulas }] });
}

const saida = {
  _aviso: 'Gerado por scripts/mapear-escolar.mjs. Aula com material:false não tem PDF no material da escola.',
  materias,
};
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + '\n', 'utf8');
const total = materias.reduce((n, m) => n + m.bimestres.reduce((k, b) => k + b.aulas.length, 0), 0);
console.log(`${materias.length} matérias, ${total} aulas -> ${SAIDA}`);

// Confere: toda aula escrita (arquivo .mdx) tem de bater com um item do mapa; revisões ficam fora.
const aulasEscritas = join(RAIZ, 'src', 'content', 'escolar');
let problemas = 0;
for (const m of existsSync(aulasEscritas) ? readdirSync(aulasEscritas) : []) {
  for (const b of readdirSync(join(aulasEscritas, m))) {
    for (const f of readdirSync(join(aulasEscritas, m, b))) {
      const s = f.replace(/\.mdx$/, '');
      if (s.startsWith('revisao-')) continue;
      const existe = materias.find((x) => x.slug === m)?.bimestres.find((x) => x.slug === b)?.aulas.find((x) => x.slug === s);
      if (!existe) {
        console.warn(`Sem item no mapa: ${m}/${b}/${s}`);
        problemas++;
      } else if (!existe.material) {
        console.warn(`Aula escrita para um número sem material: ${m}/${b}/${s}`);
        problemas++;
      }
    }
  }
}
if (problemas) process.exitCode = 1;
