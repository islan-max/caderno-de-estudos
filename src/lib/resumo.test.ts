// Testes do resumo de transcrição. Rodam com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatarTempo, frasesDaTranscricao, lerEnderecoDoVideo, lerTempo, lerTranscricao, limparLinha, linkDoMomento, paraMarkdown, resumir } from './resumo.ts';
import type { Transcricao } from './resumo.ts';

const ok = (bruto: string): Transcricao => {
  const r = lerTranscricao(bruto);
  assert.ok(r.ok, r.ok ? '' : r.erro);
  return r.transcricao;
};

/** Um vídeo de 6 minutos, uma frase a cada 10 s, falando de duas coisas (fotossíntese e mitose). */
function legendaLonga(): string {
  const a = ['A fotossíntese acontece nos cloroplastos das células vegetais.', 'A clorofila absorve a luz do sol durante a fotossíntese.', 'Nesse processo a planta produz glicose e libera oxigênio.', 'Hoje o tempo está bom e vamos começar a aula agora.'];
  const b = ['A mitose divide a célula em duas células filhas idênticas.', 'Na metáfase os cromossomos se alinham no centro da célula.', 'A mitose tem prófase, metáfase, anáfase e telófase.', 'Pessoal, não esqueçam de curtir o vídeo e se inscrever.'];
  const linhas: string[] = ['WEBVTT', ''];
  for (let i = 0; i < 36; i++) {
    const seg = i * 10;
    const frase = (i < 18 ? a : b)[i % 4];
    const f = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;
    linhas.push(`${f(seg)} --> ${f(seg + 9)}`, frase, '');
  }
  return linhas.join('\n');
}

test('lerEnderecoDoVideo aceita os formatos do YouTube e recusa o resto', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?t=10`, `https://m.youtube.com/watch?v=${id}&list=x`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, ` https://youtube.com/live/${id} `]) {
    assert.deepEqual(lerEnderecoDoVideo(u), { ok: true, id }, u);
  }
  for (const u of ['', 'texto solto', 'ftp://youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=curto', 'https://www.youtube.com/', 'javascript:alert(1)']) {
    assert.equal(lerEnderecoDoVideo(u).ok, false, u);
  }
});

test('linkDoMomento e formatarTempo', () => {
  assert.equal(linkDoMomento('dQw4w9WgXcQ', 75.9), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=75s');
  assert.equal(linkDoMomento('dQw4w9WgXcQ', null), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.deepEqual([0, 75, 3600, 3725].map(formatarTempo), ['0:00', '1:15', '1:00:00', '1:02:05']);
});

test('lerTempo entende VTT, SRT e o texto copiado do YouTube', () => {
  assert.equal(lerTempo('00:01:15.500'), 75.5);
  assert.equal(lerTempo('00:01:15,5'), 75.5);
  assert.equal(lerTempo('1:15'), 75);
  assert.equal(lerTempo('1:02:05'), 3725);
  for (const x of ['', 'abc', '75', '1:2', '12:345']) assert.equal(lerTempo(x), null, x);
});

test('limparLinha tira marcação, som de fundo e entidades', () => {
  assert.equal(limparLinha('<c.colorE5E5E5>Olá</c> [Música] mundo &amp; todos&nbsp;vocês ♪ la la ♪'), 'Olá mundo & todos vocês');
});

test('lê WebVTT e tira a repetição de linha das legendas automáticas', () => {
  const t = ok(`WEBVTT
Kind: captions

00:00:01.000 --> 00:00:03.000
hoje vamos falar de células

00:00:03.000 --> 00:00:05.000
hoje vamos falar de células
e do núcleo celular em detalhe

00:00:05.000 --> 00:00:07.000
e do núcleo celular em detalhe
porque ele guarda o material genético

00:00:07.000 --> 00:00:09.000
porque ele guarda o material genético
e também controla toda a atividade da célula
`);
  assert.equal(t.formato, 'vtt');
  assert.deepEqual(t.falas.map((f) => [f.inicio, f.texto]), [
    [1, 'hoje vamos falar de células'],
    [3, 'e do núcleo celular em detalhe'],
    [5, 'porque ele guarda o material genético'],
    [7, 'e também controla toda a atividade da célula'],
  ]);
  assert.equal(t.temMarcas, true);
});

test('lê SRT com número de cartão e vírgula nos milésimos', () => {
  const t = ok(`1
00:00:01,000 --> 00:00:04,000
Bem-vindos ao curso de química orgânica.

2
00:00:04,500 --> 00:00:09,000
Hoje vamos estudar os hidrocarbonetos e suas funções.

3
00:00:09,500 --> 00:00:14,000
Depois veremos como nomear cada composto pelas regras da IUPAC.
`);
  assert.equal(t.formato, 'srt');
  assert.deepEqual(t.falas.map((f) => f.inicio), [1, 4.5, 9.5]);
});

test('lê o texto copiado do YouTube, com a marca sozinha na linha ou junto do texto', () => {
  const sozinha = ok('0:00\nbem-vindos ao canal de hoje\n0:05\nvamos falar sobre o sistema solar\n0:12\ne os planetas que giram em torno do sol\n1:02\nvamos começar agora pelo planeta mercúrio\n');
  assert.equal(sozinha.formato, 'texto com marcas');
  assert.deepEqual(sozinha.falas.map((f) => f.inicio), [0, 5, 12, 62]);
  const junta = ok('0:00 bem-vindos ao canal de hoje\n0:05 vamos falar sobre o sistema solar\n0:12 e os planetas que giram em torno do sol\n1:02 vamos começar agora pelo planeta mercúrio\n');
  assert.deepEqual(junta.falas.map((f) => [f.inicio, f.texto]).slice(-1), [[62, 'vamos começar agora pelo planeta mercúrio']]);
});

test('texto simples não tem marcas de tempo e o resumo avisa', () => {
  const t = ok('A fotossíntese é o processo pelo qual as plantas produzem energia. '.repeat(6));
  assert.equal(t.temMarcas, false);
  assert.equal(t.formato, 'texto');
  assert.ok(resumir(t).avisos.some((a) => a.includes('marcas de tempo')));
});

test('recusa vazio, pouco texto, texto grande demais e vídeo longo demais', () => {
  for (const x of ['', '   \n\n', 'só duas palavras', 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n[Música]\n']) assert.equal(lerTranscricao(x).ok, false, x);
  assert.equal(lerTranscricao('a'.repeat(1_000_001)).ok, false);
  assert.equal(lerTranscricao('palavra '.repeat(60_001)).ok, false);
  const longo = `WEBVTT\n\n${Array.from({ length: 30 }, (_, i) => `0${Math.floor(i / 6) + 3}:00:0${i % 6}.000 --> 0${Math.floor(i / 6) + 3}:00:0${(i % 6) + 1}.000\nesta é uma frase qualquer do vídeo bem longo\n`).join('\n')}`;
  const r = lerTranscricao(longo);
  assert.ok(!r.ok && r.erro.includes('3 horas'));
});

test('frases: corta na pontuação e, sem pontuação, em 25 palavras', () => {
  const com = frasesDaTranscricao([{ inicio: 0, texto: 'Primeira frase aqui. Segunda frase logo depois! E uma terceira' }, { inicio: 5, texto: 'que continua na próxima fala.' }]);
  assert.deepEqual(com.map((f) => f.texto), ['Primeira frase aqui.', 'Segunda frase logo depois!', 'E uma terceira que continua na próxima fala.']);
  assert.deepEqual(com.map((f) => f.inicio), [0, 0, 0]);
  const sem = frasesDaTranscricao(Array.from({ length: 20 }, (_, i) => ({ inicio: i, texto: 'uma duas três quatro cinco' })));
  assert.ok(sem.every((f) => f.palavras <= 29));
  assert.ok(sem.length >= 4);
});

test('o resumo fica em ordem, cada ponto é uma frase da transcrição e leva ao momento certo', () => {
  const t = ok(legendaLonga());
  const r = resumir(t);
  const todas = new Set(t.falas.map((f) => f.texto));
  assert.ok(r.trechos.length >= 3);
  for (const tr of r.trechos) {
    assert.ok(tr.pontos.length >= 1 && tr.pontos.length <= 3);
    for (const p of tr.pontos) {
      assert.ok(todas.has(p.texto), `ponto inventado: ${p.texto}`);
      const fala = t.falas.find((f) => f.texto === p.texto && f.inicio === p.inicio);
      assert.ok(fala, 'a marca de tempo do ponto tem de ser a da fala');
    }
    const inicios = tr.pontos.map((p) => p.inicio!);
    assert.deepEqual(inicios, [...inicios].sort((a, b) => a - b));
  }
  const marcas = r.trechos.map((x) => x.inicio!);
  assert.deepEqual(marcas, [...marcas].sort((a, b) => a - b));
});

test('o resumo prefere o assunto do trecho a frases de enchimento', () => {
  const r = resumir(ok(legendaLonga()));
  const pontos = r.trechos.flatMap((x) => x.pontos.map((p) => p.texto));
  assert.ok(pontos.some((p) => /fotoss[íi]ntese|clorofila/i.test(p)));
  assert.ok(pontos.some((p) => /mitose/i.test(p)));
  assert.ok(!pontos.some((p) => /curtir|inscrever/i.test(p)));
});

test('o mesmo texto dá sempre o mesmo resumo', () => {
  assert.deepEqual(resumir(ok(legendaLonga())), resumir(ok(legendaLonga())));
});

test('legenda sem pontuação e transcrição curta geram avisos', () => {
  const sem = ok(`WEBVTT\n\n${Array.from({ length: 40 }, (_, i) => `00:00:${String(i).padStart(2, '0')}.000 --> 00:00:${String(i + 1).padStart(2, '0')}.000\nentão pessoal hoje vamos ver como funciona o sistema número ${i}`).join('\n\n')}`);
  assert.equal(sem.semPontuacao, true);
  assert.ok(resumir(sem).avisos.some((a) => a.includes('pontuação')));
  const curta = ok('A mitose divide a célula em duas células idênticas. A meiose forma gametas com metade dos cromossomos. Ambas fazem parte do ciclo celular.');
  assert.ok(resumir(curta).avisos.some((a) => a.includes('curta')));
});

test('paraMarkdown leva só os pontos marcados, com link do minuto', () => {
  const r = resumir(ok(legendaLonga()));
  const incluidos = new Set(['0.0']);
  const md = paraMarkdown({ resumo: r, incluidos, videoId: 'dQw4w9WgXcQ', titulo: 'Aula de biologia' });
  assert.ok(md.startsWith('# Aula de biologia\n'));
  const itens = md.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(itens.length, 1);
  assert.match(itens[0], /^- \[\d+:\d{2}\]\(https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ&t=\d+s\) /);
  assert.ok(md.includes('sem reescrita'));
  const semVideo = paraMarkdown({ resumo: r, incluidos, videoId: null });
  assert.ok(!semVideo.includes('youtube.com'));
  assert.equal(paraMarkdown({ resumo: r, incluidos: new Set(), videoId: null }).split('\n').filter((l) => l.startsWith('- ')).length, 0);
});

test('a mesma frase em dois cartões que não se sobrepõem é mantida (só a legenda rolante é deduplicada)', () => {
  const t = ok(`WEBVTT

00:00:01.000 --> 00:00:03.000
não vamos desistir agora de entender isso

00:00:05.000 --> 00:00:07.000
não vamos desistir agora de entender isso

00:00:07.000 --> 00:00:09.000
não vamos desistir agora de entender isso
e vamos continuar até o fim da explicação`);
  assert.deepEqual(t.falas.map((f) => f.inicio), [1, 5, 7]);
});
