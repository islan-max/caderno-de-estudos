// Gera src/data/ds-mapa.json: o mapa da aba DS (matéria → bimestre → aula).
//
// Uso: node scripts/mapear-ds.mjs [pasta-do-material]
//   Padrão da pasta: C:\Users\MAX\Desktop\Desenvolvimento de sistemas
//
// Cada pasta "Semana NN - Título" do material vira UMA aula (todas as aulas da semana
// são unificadas numa só). As pastas do material vêm sem acento; o script restaura os
// acentos com as palavras que aparecem, acentuadas, dentro dos PDFs (precisa do
// pdftotext; sem ele os títulos ficam como estão nas pastas).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = process.argv[2] ?? 'C:\\Users\\MAX\\Desktop\\Desenvolvimento de sistemas';
const SAIDA = join(RAIZ, 'src', 'data', 'ds-mapa.json');

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpa = (t) => t.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const slug = (t) =>
  semAcento(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ehPasta = (p) => statSync(p).isDirectory();
const lista = (p) => readdirSync(p).filter((n) => !n.startsWith('.'));

// ------------------------------------------------ dicionário de acentos (PDFs)
const freq = new Map(); // "servicos" -> Map("serviços" -> n)
function aprender(texto) {
  for (const w of texto.match(/[\p{L}]{3,}/gu) ?? []) {
    const k = semAcento(w).toLowerCase();
    if (k === w.toLowerCase() && !/[a-z]/.test(k)) continue;
    const m = freq.get(k) ?? new Map();
    const f = w.toLowerCase();
    m.set(f, (m.get(f) ?? 0) + 1);
    freq.set(k, m);
  }
}
let temPdftotext = true;
function lerPdf(arquivo) {
  try {
    return execFileSync(process.env.PDFTOTEXT ?? 'pdftotext', ['-enc', 'UTF-8', '-f', '1', '-l', '3', arquivo, '-'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1 << 26,
    });
  } catch (e) {
    if (e.code === 'ENOENT') temPdftotext = false;
    else console.warn('PDF ilegível, ignorado:', arquivo);
    return '';
  }
}

// ----------------------------------------------------------- varredura
const materias = [];
const todosPdfs = [];

for (const nomeMateria of lista(ORIGEM).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
  const pastaMateria = join(ORIGEM, nomeMateria);
  if (!ehPasta(pastaMateria)) continue;
  const bimestres = [];
  for (const nomeBim of lista(pastaMateria)) {
    const numero = Number(nomeBim.match(/^(\d)/)?.[1]);
    const pastaBim = join(pastaMateria, nomeBim);
    if (!numero || !ehPasta(pastaBim)) continue;
    const semanas = [];
    for (const nomeSemana of lista(pastaBim)) {
      // Só "Semana NN - Título" (as pastas soltas "semana 1" são cópias avulsas dos PDFs).
      const m = limpa(nomeSemana).match(/^Semana\s+(\d+)\s*-\s*(.+)$/i);
      const pastaSemana = join(pastaBim, nomeSemana);
      if (!m || !ehPasta(pastaSemana)) continue;
      const topicos = [];
      let pausas = 0;
      for (const arq of lista(pastaSemana)) {
        const t = limpa(arq).match(/^Aula - Aula\s*(\d+)\s*-\s*(.+?)\s*-\s*\d+\.\w+$/i);
        if (t && /\.pdf$/i.test(arq)) {
          topicos.push({ n: Number(t[1]), titulo: limpa(t[2]) });
          todosPdfs.push(join(pastaSemana, arq));
        }
        if (/^Pause e Responda/i.test(arq)) pausas++;
      }
      topicos.sort((a, b) => a.n - b.n);
      semanas.push({ semana: Number(m[1]), titulo: limpa(m[2]), topicos: topicos.map((x) => x.titulo), pausas });
    }
    semanas.sort((a, b) => a.semana - b.semana);
    if (semanas.length) bimestres.push({ numero, semanas });
  }
  bimestres.sort((a, b) => a.numero - b.numero);
  if (bimestres.length) materias.push({ nome: limpa(nomeMateria), bimestres });
}

for (const pdf of todosPdfs) aprender(lerPdf(pdf));

function acentuar(titulo) {
  if (!temPdftotext) return titulo;
  return titulo.replace(/[A-Za-z]{3,}/g, (w) => {
    const cand = freq.get(w.toLowerCase());
    if (!cand) return w;
    const [melhor] = [...cand.entries()].sort((a, b) => b[1] - a[1])[0];
    if (semAcento(melhor) === melhor) return w;
    if (w === w.toUpperCase()) return melhor.toUpperCase();
    return w[0] === w[0].toUpperCase() ? melhor[0].toUpperCase() + melhor.slice(1) : melhor;
  });
}

// Ajustes de redação nos títulos (typos e hífens das pastas do material).
const TROCAS = [
  [/[‑‒–]/g, '-'],
  [/exixtentes/gi, 'existentes'],
  [/Back - End/g, 'Back-End'],
  [/Público - Alvo/g, 'Público-Alvo'],
  [/CI - CD/g, 'CI/CD'],
  [/Dead - Letter/g, 'Dead-Letter'],
  [/Introdução a Inteligência/g, 'Introdução à Inteligência'],
  [/Introdução as /g, 'Introdução às '],
  [/Introdução a IA/g, 'Introdução à IA'],
  [/Modelo a Ação/g, 'Modelo à Ação'],
  [/^Projeto prático/i, 'Projeto Prático'],
  [/(\S)- /g, '$1: '], // "Gestão de Projetos- Riscos" -> "Gestão de Projetos: Riscos"
  [/ - /g, ': '], // "Projeto Prático - Concepção" -> "Projeto Prático: Concepção"
  [/^(.)/, (m) => m.toUpperCase()],
];
const arrumar = (t) => TROCAS.reduce((acc, [de, para]) => acc.replace(de, para), t).replace(/\.$/, '');

// ------------------------------------------------------------- saída
const saida = {
  _aviso: 'Gerado por scripts/mapear-ds.mjs. Títulos com acento restaurado automaticamente; conferir.',
  materias: materias.map((mat) => ({
    slug: slug(mat.nome),
    nome: mat.nome,
    bimestres: mat.bimestres.map((b) => ({
      numero: b.numero,
      slug: `${b.numero}-bimestre`,
      aulas: b.semanas.map((s, i) => {
        const titulo = arrumar(acentuar(s.titulo));
        const pos = i + 1;
        return {
          pos,
          semana: s.semana,
          slug: `aula-${pos}-${slug(titulo)}`,
          titulo,
          topicos: s.topicos.map((t) => arrumar(acentuar(t))),
          pausas: s.pausas,
        };
      }),
    })),
  })),
};

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + '\n', 'utf8');
const total = saida.materias.reduce((n, m) => n + m.bimestres.reduce((k, b) => k + b.aulas.length, 0), 0);
console.log(`${saida.materias.length} matérias, ${total} aulas -> ${SAIDA}`);
if (!temPdftotext) console.warn('pdftotext não encontrado: títulos ficaram sem acento.');
