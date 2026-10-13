/* ---------------------------------------------------------------------------
 * Página /revisao: uma cartão por vez, com os tópicos-chave das aulas concluídas.
 *
 * A cartão é um `#### N. Título` + o que vem depois dele em <div class="topico"> na própria aula.
 * O HTML da aula é buscado na hora (só das aulas que têm cartão na fila de hoje) e o tópico é
 * copiado dele, com fórmulas e figuras já prontas.
 *
 * Fluxo: a pessoa escreve o que lembra → "Corrigir" compara com o tópico (pelo SENTIDO, com um
 * modelo de linguagem pequeno que roda no aparelho, src/scripts/ia.ts; ou, sem ele, pelos termos em
 * negrito, src/lib/correcao.ts) → mostra o veredito (certo, parcial, errado), a resposta do caderno e se
 * vale rever a aula → a pessoa escolhe como foi (a sugestão já vem destacada) → a resposta vira um
 * evento no registro e a fila é recalculada dele (src/lib/estudo.ts).
 * ------------------------------------------------------------------------- */
import { corrigirPorSentido, corrigirPorTermos, quebrarEmPontos, quebrarResposta } from '../lib/correcao';
import type { Correcao, CorrecaoPorSentido, Ponto, Veredito } from '../lib/correcao';
import type { Cartao } from '../lib/estudo';
import { carregarIndice } from './busca';
import { filaDeHoje } from './fila';
import { TAMANHO_MB, gravarPreferenciaIA, iaPossivel, lerPreferenciaIA, medirSemelhanca, modeloPronto } from './ia';
import { lerRegistro, registrar } from './registro';
import { acharSecao } from './secoes-aula';
import { dataExtensa, escapar } from './util';

interface Item {
  cartao: Cartao;
  titulo: string;
  materia: string;
  aulaTitulo: string;
  href: string;
  hrefSecao: string;
  cor: string;
  verso: Node[];
  /** Termos em negrito do tópico: é com eles que a resposta é conferida. */
  termos: string[];
}

/** Quantos cartões seguidos se pode pular antes de ter de responder um (senão a fila nunca andaria). */
const PULOS_SEGUIDOS = 3;

const VEREDITOS: Record<Veredito, { texto: string; icone: string; sugerida: 0 | 1 | 2 }> = {
  certo: { texto: 'Certo', icone: 'circle-check', sugerida: 2 },
  parcial: { texto: 'Parcial', icone: 'circle-half-stroke', sugerida: 1 },
  errado: { texto: 'Ainda não', icone: 'xmark', sugerida: 0 },
};

let encerrar: AbortController | null = null;

/** Os tópicos de uma aula, na ordem: o título (h3) e o que vem até o próximo título. */
function topicosDaPagina(doc: Document): { titulo: string; nos: Node[] }[] {
  const bloco = doc.querySelector('.topico');
  if (!bloco || bloco.getAttribute('data-cartoes') === 'nao') return [];
  const lista: { titulo: string; nos: Node[] }[] = [];
  for (const el of Array.from(bloco.children)) {
    if (el.tagName === 'H3') lista.push({ titulo: (el.textContent ?? '').trim(), nos: [] });
    else lista[lista.length - 1]?.nos.push(el);
  }
  return lista;
}

export async function montarRevisao() {
  const raiz = document.querySelector<HTMLElement>('[data-revisao]');
  if (!raiz) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;

  const q = <T extends HTMLElement>(seletor: string) => raiz.querySelector<T>(seletor)!;
  const status = q('[data-revisao-status]');
  const sessao = q('[data-cartao]');
  const fimEl = q('[data-revisao-fim]');
  const stats = q('[data-revisao-stats]');

  const mostrarFim = (titulo: string, texto: string, alerta = false) => {
    status.hidden = true;
    sessao.hidden = true;
    q('[data-revisao-fim-titulo]').textContent = titulo;
    q('[data-revisao-fim-texto]').textContent = texto;
    fimEl.dataset.alerta = String(alerta);
    fimEl.hidden = false;
  };

  const indice = await carregarIndice();
  if (!raiz.isConnected) return;
  if (!indice.length) {
    mostrarFim('Não foi possível carregar o índice de aulas', 'Verifique a conexão e abra a página de novo.', true);
    return;
  }

  const porId = new Map(indice.map((a) => [a.id, a]));
  const calcular = () => filaDeHoje(indice);
  const { fila, temConcluidas } = calcular();

  const semana = Date.now() - 7 * 24 * 3600 * 1000;
  const revistas = lerRegistro().eventos.filter((e) => e.k === 'c' && e.t >= semana).length;
  q('[data-stat="hoje"]').textContent = String(fila.hoje.length);
  q('[data-stat="fila"]').textContent = String(fila.vencidos.length);
  q('[data-stat="semana"]').textContent = String(revistas);
  stats.hidden = false;

  if (!temConcluidas) {
    mostrarFim(
      'Ainda não há cartões',
      'Os cartões de uma aula entram aqui no dia seguinte a você concluí-la (leitura e questões feitas). Aulas sem tópicos-chave não geram cartões.'
    );
    return;
  }
  if (!fila.hoje.length) {
    mostrarFim(
      'Nada para revisar hoje',
      fila.proxima ? `Os próximos cartões voltam ${dataExtensa(fila.proxima)}.` : 'Não há cartões esperando.'
    );
    return;
  }

  // Busca só as aulas que têm cartão na fila de hoje.
  const paginas = new Map<string, Document | null>();
  await Promise.all(
    [...new Set(fila.hoje.map((c) => c.aula))].map(async (id) => {
      try {
        const r = await fetch(porId.get(id)!.h);
        if (!r.ok) throw new Error(String(r.status));
        paginas.set(id, new DOMParser().parseFromString(await r.text(), 'text/html'));
      } catch {
        paginas.set(id, null);
      }
    })
  );
  if (!raiz.isConnected) return;

  const itens: Item[] = [];
  for (const c of fila.hoje) {
    const aula = porId.get(c.aula)!;
    const doc = paginas.get(c.aula);
    const topico = doc ? topicosDaPagina(doc)[c.n - 1] : undefined;
    if (!doc || !topico) continue;
    const secao = acharSecao(doc, topico.titulo);
    const verso = topico.nos.map((n) => document.importNode(n, true));
    const termos = verso.flatMap((n) => (n instanceof Element ? [...n.querySelectorAll('strong')].map((s) => s.textContent ?? '') : []));
    itens.push({
      cartao: c,
      titulo: topico.titulo,
      materia: aula.m,
      aulaTitulo: aula.t,
      href: aula.h,
      hrefSecao: secao?.id ? `${aula.h}#${secao.id}` : aula.h,
      cor: aula.c,
      verso,
      termos,
    });
  }
  if (!itens.length) {
    mostrarFim('Não foi possível carregar os cartões', 'Verifique a conexão e abra a página de novo.', true);
    return;
  }

  /* ----------------------------------------------------------- fluxo */
  const fila2 = [...itens];
  const total = itens.length;
  let feitas = 0;
  /** Pulos seguidos: passam de PULOS_SEGUIDOS e o cartão tem de ser respondido; responder zera a conta. */
  let pulosSeguidos = 0;
  let correcao: Correcao | null = null;
  let corrigindo = false;

  const frente = q('[data-cartao-frente]');
  const escrever = q('[data-cartao-escrever]');
  const painel = q('[data-cartao-correcao]');
  const campo = q<HTMLTextAreaElement>('[data-cartao-resposta]');
  const contagem = q('[data-cartao-contagem]');
  const botaoCorrigir = q<HTMLButtonElement>('[data-cartao-corrigir]');
  const botaoPular = q<HTMLButtonElement>('[data-cartao-pular]');
  const aviso = q('[data-cartao-corrigindo]');
  const reverEl = q('[data-cartao-rever]');
  const modoEl = q('[data-ia-modo]');
  const instrucaoEl = q('[data-cartao-instrucao]');
  const legendaEl = q('[data-cartao-legenda]');
  const avisoIA = q('[data-cartao-ia]');
  const progressoIA = q('[data-cartao-ia-progresso]');
  const metodoEl = q('[data-cartao-metodo]');
  q('[data-ia-mb]').textContent = String(TAMANHO_MB);

  const atual = () => fila2[0];

  const paragrafosDe = (item: Item) => item.verso.filter((n): n is HTMLElement => n instanceof HTMLElement && n.tagName === 'P');

  const pontosDe = (item: Item): Ponto[] =>
    quebrarEmPontos(paragrafosDe(item).map((p) => p.textContent ?? '').join(' ')).map((texto) => ({
      texto,
      termos: item.termos.filter((t) => t.length > 2 && texto.includes(t)),
    }));

  /** O que está valendo e como mudar: era a frase "escolher entre..." que ninguém entendia. */
  function atualizarModo() {
    const pref = lerPreferenciaIA();
    modoEl.textContent =
      pref === 'sim'
        ? 'Correção inteligente, no seu aparelho.'
        : pref === 'nao'
          ? 'Correção por palavras-chave.'
          : 'Na primeira correção você escolhe entre a inteligente e a por palavras-chave.';
    q('[data-ia-trocar]').hidden = pref === null;
  }

  /** A resposta do caderno, frase a frase: o que a pessoa cobriu e o que faltou, no próprio texto. */
  function versoAnotado(item: Item, r: CorrecaoPorSentido): Node[] {
    const cobertos = new Set(r.cobertos);
    const faltantes = new Set(r.pontosFaltantes);
    const termos = [...new Set(item.termos.filter((t) => t.length > 2))]
      .sort((a, b) => b.length - a.length)
      .map((t) => escapar(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const acha = termos.length ? new RegExp(termos.join('|'), 'g') : null;
    const negrito = (texto: string) => {
      const html = escapar(texto);
      return acha ? html.replace(acha, (m) => `<strong>${m}</strong>`) : html;
    };
    return item.verso.map((n) => {
      if (!(n instanceof HTMLElement) || n.tagName !== 'P') return n.cloneNode(true);
      const p = document.createElement('p');
      const frases = (n.textContent ?? '').replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+/);
      p.innerHTML = frases
        .map((f) => {
          const t = f.trim();
          const estado = cobertos.has(t) ? 'ok' : faltantes.has(t) ? 'falta' : '';
          return estado
            ? `<span class="ponto ponto--${estado}">${negrito(t)}<span class="ponto__tag">${estado === 'ok' ? 'você cobriu' : 'faltou'}</span></span>`
            : negrito(t);
        })
        .join(' ');
      return p;
    });
  }

  function mostrar() {
    const item = atual();
    correcao = null;
    sessao.style.setProperty('--materia', item.cor);
    q('[data-cartao-contador]').textContent = `Cartão ${feitas + 1} de ${total}`;
    q('[data-cartao-barra]').style.width = `${(feitas / total) * 100}%`;
    q('[data-cartao-materia]').textContent = item.materia;
    frente.textContent = item.titulo.replace(/^\d+\.\s*/, '');
    const ideias = pontosDe(item).length;
    instrucaoEl.textContent =
      'Explique com as suas palavras o que é, quando se usa e como se resolve. Escreva as fórmulas que lembrar.' +
      (ideias ? ` Este cartão tem ${ideias} ${ideias === 1 ? 'ideia' : 'ideias'} para você cobrir.` : '');
    atualizarModo();
    const aula = q<HTMLAnchorElement>('[data-cartao-aula]');
    aula.textContent = item.aulaTitulo;
    aula.href = item.href;
    campo.value = '';
    contagem.textContent = `0 de ${campo.maxLength}`;
    corrigindo = false;
    botaoCorrigir.disabled = false;
    atualizarPulos();
    avisoIA.hidden = true;
    progressoIA.hidden = true;
    escrever.hidden = false;
    painel.hidden = true;
    q('[data-cartao-verso-conteudo]').replaceChildren();
    status.hidden = true;
    sessao.hidden = false;
    // O leitor de tela anuncia o título do cartão novo; o foco não pode ficar no botão que sumiu.
    frente.focus();
  }

  /** Pergunta, uma vez, se a pessoa quer a correção por sentido (que baixa um modelo). Guarda a resposta. */
  function escolherModo(): Promise<'ia' | 'termos'> {
    const pref = lerPreferenciaIA();
    if (!iaPossivel()) return Promise.resolve('termos');
    if (pref === 'sim') return Promise.resolve('ia');
    if (pref === 'nao') return Promise.resolve('termos');
    avisoIA.hidden = false;
    q('[data-ia-sim]').focus();
    return new Promise((resolver) => {
      const decidir = (modo: 'ia' | 'termos') => {
        gravarPreferenciaIA(modo === 'ia' ? 'sim' : 'nao');
        avisoIA.hidden = true;
        resolver(modo);
      };
      q('[data-ia-sim]').addEventListener('click', () => decidir('ia'), { once: true, signal });
      q('[data-ia-nao]').addEventListener('click', () => decidir('termos'), { once: true, signal });
    });
  }

  /** Corrige pelo sentido: quebra o tópico em ideias e vê quais a resposta cobre. */
  async function corrigirComModelo(item: Item, resposta: string): Promise<CorrecaoPorSentido | null> {
    const pontos = pontosDe(item);
    if (!pontos.length) return null;
    const baixando = !modeloPronto();
    progressoIA.hidden = false;
    const barra = progressoIA.querySelector('progress')!;
    const texto = q('[data-ia-progresso-texto]');
    texto.textContent = baixando ? `Baixando o modelo (${TAMANHO_MB} MB, só desta vez)… 0%` : 'Corrigindo…';
    barra.value = 0;
    barra.hidden = !baixando;
    try {
      const sims = await medirSemelhanca(
        pontos.map((p) => p.texto),
        quebrarResposta(resposta),
        (pct) => {
          barra.value = pct;
          texto.textContent = `Baixando o modelo (${TAMANHO_MB} MB, só desta vez)… ${pct}%`;
        }
      );
      return corrigirPorSentido(resposta, pontos, sims);
    } finally {
      progressoIA.hidden = true;
    }
  }

  async function corrigir() {
    if (corrigindo) return;
    corrigindo = true;
    const item = atual();
    const resposta = campo.value.trim();
    botaoCorrigir.disabled = true;
    botaoPular.disabled = true;

    let resultado: Correcao | CorrecaoPorSentido = corrigirPorTermos(resposta, item.termos);
    let metodo = 'termos';
    if (resposta.length >= 8 && (await escolherModo()) === 'ia') {
      aviso.textContent = '';
      window.setTimeout(() => (aviso.textContent = 'Corrigindo a sua resposta…'), 30);
      try {
        const porSentido = await corrigirComModelo(item, resposta);
        if (porSentido) {
          resultado = porSentido;
          metodo = 'sentido';
        }
      } catch {
        metodo = 'falhou';
      }
    }
    if (!raiz.isConnected) return;
    correcao = resultado;
    const v = VEREDITOS[correcao.veredito];

    const faixa = q('[data-cartao-veredito]');
    faixa.dataset.veredito = correcao.veredito;
    faixa.querySelector('i')!.className = `fa-solid fa-${v.icone}`;
    q('[data-cartao-veredito-texto]').textContent = v.texto;
    const sua = q('[data-cartao-sua]');
    (sua.parentElement as HTMLElement).hidden = !resposta;
    sua.textContent = resposta;
    q('[data-cartao-texto]').textContent = correcao.texto;
    metodoEl.textContent =
      metodo === 'sentido'
        ? 'Corrigido pelo modelo de linguagem do seu aparelho. Ele vê se você falou das mesmas ideias, não se a conclusão está certa: confira com a resposta do caderno.'
        : metodo === 'falhou'
          ? 'Não consegui carregar o modelo (sem conexão?). Corrigi só pelas palavras-chave.'
          : metodo === 'termos'
            ? 'Corrigido pelas palavras-chave do tópico.'
            : '';
    metodoEl.hidden = !metodoEl.textContent;

    // Por sentido: o próprio texto do caderno mostra o que a pessoa cobriu e o que faltou.
    const porSentido = metodo === 'sentido' ? (resultado as CorrecaoPorSentido) : null;
    legendaEl.hidden = !porSentido;
    q('[data-cartao-verso-conteudo]').replaceChildren(...(porSentido ? versoAnotado(item, porSentido) : item.verso.map((n) => n.cloneNode(true))));
    q<HTMLAnchorElement>('[data-cartao-secao]').href = item.hrefSecao;

    // Errada: a aula é marcada para rever sozinha (e a tela avisa). Certa ou parcial: nada a marcar.
    reverEl.hidden = !correcao.revisarAula;
    painel.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => (b.dataset.sugerida = String(Number(b.dataset.r) === v.sugerida)));

    escrever.hidden = true;
    painel.hidden = false;
    aviso.textContent = '';
    window.setTimeout(() => (aviso.textContent = `${v.texto}. ${correcao!.texto}`), 30);
    painel.focus();
  }

  /** O botão e a dica dizem quantos pulos ainda restam; no limite, explicam o que fazer. */
  function atualizarPulos() {
    const restam = PULOS_SEGUIDOS - pulosSeguidos;
    botaoPular.disabled = fila2.length < 2 || restam <= 0;
    q('[data-cartao-pulos]').textContent =
      restam <= 0
        ? `Você já pulou ${PULOS_SEGUIDOS} cartões seguidos. Responda este para poder pular de novo.`
        : `Pular manda o cartão para o fim da fila (até ${PULOS_SEGUIDOS} seguidos${pulosSeguidos ? `; restam ${restam}` : ''}).`;
  }

  function pular() {
    if (fila2.length < 2 || pulosSeguidos >= PULOS_SEGUIDOS) return;
    pulosSeguidos++;
    fila2.push(fila2.shift()!);
    aviso.textContent = '';
    window.setTimeout(() => (aviso.textContent = 'Cartão pulado: volta no fim da fila.'), 30);
    mostrar();
  }

  function responder(r: 0 | 1 | 2) {
    if (!correcao) return;
    const item = atual();
    registrar({
      k: 'c',
      c: item.cartao.id,
      r,
      v: correcao.veredito,
      ...(correcao.revisarAula ? { rv: true as const, s: item.titulo } : {}),
    });
    fila2.shift();
    feitas++;
    pulosSeguidos = 0;
    if (fila2.length) {
      mostrar();
      return;
    }
    const resto = calcular().fila;
    const sobra = resto.vencidos.length;
    mostrarFim(
      'Revisão de hoje concluída',
      `Você revisou ${total} ${total === 1 ? 'cartão' : 'cartões'}. ` +
        (sobra
          ? `Ainda há ${sobra} ${sobra === 1 ? 'cartão esperando' : 'cartões esperando'}: ficam para outro dia, sem pressa.`
          : resto.proxima
            ? `Os próximos cartões voltam ${dataExtensa(resto.proxima)}.`
            : '')
    );
    fimEl.focus();
  }

  campo.addEventListener(
    'input',
    () => {
      contagem.textContent = `${campo.value.length} de ${campo.maxLength}`;
    },
    { signal }
  );
  campo.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void corrigir();
      }
    },
    { signal }
  );
  botaoCorrigir.addEventListener('click', () => void corrigir(), { signal });
  botaoPular.addEventListener('click', pular, { signal });
  q('[data-ia-trocar]').addEventListener(
    'click',
    () => {
      gravarPreferenciaIA(null);
      atualizarModo();
      aviso.textContent = '';
      window.setTimeout(() => (aviso.textContent = 'Na próxima correção o caderno pergunta de novo como corrigir.'), 30);
    },
    { signal }
  );
  painel.addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (b) responder(Number(b.dataset.r) as 0 | 1 | 2);
    },
    { signal }
  );
  // Teclas 1, 2 e 3 respondem depois da correção. Não valem enquanto se escreve.
  document.addEventListener(
    'keydown',
    (e) => {
      // O documento sobrevive à troca de página (ClientRouter): fora da /revisao as teclas não valem.
      if (!raiz.isConnected || !correcao || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault();
        responder((Number(e.key) - 1) as 0 | 1 | 2);
      }
    },
    { signal }
  );

  mostrar();
}
