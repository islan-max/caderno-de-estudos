/* ---------------------------------------------------------------------------
 * Questões da aula ("Questões do ENEM"): transforma as questões escritas em markdown num quiz
 * respondível, sem tocar no conteúdo das aulas.
 *
 * As questões continuam sendo prosa no MDX. Este módulo lê o HTML já
 * renderizado, reconhece o padrão (um <p> com <strong>Questão N</strong>
 * seguido do enunciado, e um <p> com as cinco alternativas "a)" a "e)") e o
 * substitui por controles de formulário de verdade.
 *
 * Usa <input type="radio"> dentro de <fieldset>/<legend> de propósito: setas
 * do teclado, leitores de tela e navegação por formulário funcionam sem que a
 * gente precise reimplementar nada disso à mão.
 *
 * Sem JS, ou sem gabarito no frontmatter, a aula continua legível como texto.
 * ------------------------------------------------------------------------- */

interface Gabarito {
  correta: number;
  porque?: string;
}

interface Questao {
  numero: number;
  enunciado: HTMLElement[];
  paragrafoAlternativas: HTMLParagraphElement | null;
  alternativas: string[];
}

const LETRAS = ['a', 'b', 'c', 'd', 'e'];

/* As aulas usam três formatos de alternativa, e todos são aceitos aqui:
   "a) ...", "A) ..." e "(A) ...". */
const ABRE_ALTERNATIVA = /^\(?[a-eA-E]\)\s/;
const TEM_ULTIMA_ALTERNATIVA = /\n\s*\(?[eE]\)\s/;

/** Um <p> é a lista de alternativas se abre na "a" e traz a "e" numa linha. */
function ehListaDeAlternativas(el: Element): el is HTMLParagraphElement {
  if (el.tagName !== 'P') return false;
  const t = (el.textContent || '').trim();
  return ABRE_ALTERNATIVA.test(t) && TEM_ULTIMA_ALTERNATIVA.test(t);
}

function separarAlternativas(texto: string): string[] {
  // Cada alternativa começa em nova linha, no formato "x) " ou "(X) ".
  const partes = texto.trim().split(/\n\s*(?=\(?[a-eA-E]\)\s)/);
  if (partes.length !== 5) return [];
  return partes.map((p) => p.replace(/^\(?[a-eA-E]\)\s*/, '').trim());
}

function coletarQuestoes(artigo: HTMLElement): Questao[] {
  const questoes: Questao[] = [];
  let atual: Questao | null = null;

  for (const el of Array.from(artigo.children) as HTMLElement[]) {
    const forte = el.querySelector('strong');
    const rotulo = forte?.textContent?.match(/^Quest[ãa]o\s+(\d+)/i);

    if (rotulo) {
      atual = {
        numero: Number(rotulo[1]),
        enunciado: [el],
        paragrafoAlternativas: null,
        alternativas: [],
      };
      continue;
    }

    if (!atual) continue;

    if (ehListaDeAlternativas(el)) {
      const alternativas = separarAlternativas(el.textContent || '');
      if (alternativas.length === 5) {
        atual.paragrafoAlternativas = el;
        atual.alternativas = alternativas;
        questoes.push(atual);
        atual = null;
        continue;
      }
    }

    atual.enunciado.push(el);
  }

  return questoes;
}

function montarQuestao(q: Questao, indice: number): HTMLElement {
  const bloco = document.createElement('fieldset');
  bloco.className = 'quiz__questao';
  bloco.dataset.questao = String(indice);

  const legenda = document.createElement('legend');
  legenda.className = 'quiz__legenda';
  legenda.textContent = 'Questão ' + q.numero;
  bloco.appendChild(legenda);

  // O enunciado original é movido para dentro do fieldset, preservando a
  // formatação (negrito, fórmulas) que o markdown já produziu.
  const enunciado = document.createElement('div');
  enunciado.className = 'quiz__enunciado';
  q.enunciado.forEach((el) => {
    const forte = el.querySelector('strong');
    if (forte && /^Quest[ãa]o\s+\d+/i.test(forte.textContent || '')) {
      // Tira só o rótulo "Questão N", que agora é a legenda do bloco.
      forte.remove();
      if (!(el.textContent || '').trim()) return;
    }
    enunciado.appendChild(el);
  });
  bloco.appendChild(enunciado);

  const lista = document.createElement('div');
  lista.className = 'quiz__alternativas';

  q.alternativas.forEach((texto, i) => {
    const id = 'q' + indice + '-alt' + i;
    const rotulo = document.createElement('label');
    rotulo.className = 'quiz__alternativa';
    rotulo.setAttribute('for', id);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'questao-' + indice;
    radio.id = id;
    radio.value = String(i);
    radio.className = 'quiz__radio';

    const letra = document.createElement('span');
    letra.className = 'quiz__letra';
    letra.setAttribute('aria-hidden', 'true');
    letra.textContent = LETRAS[i].toUpperCase();

    // A letra desenhada é aria-hidden; o leitor de tela recebe a mesma letra em texto,
    // porque o gabarito depois fala "Resposta correta: C".
    const letraLeitor = document.createElement('span');
    letraLeitor.className = 'apenas-leitor';
    letraLeitor.textContent = 'Alternativa ' + LETRAS[i].toUpperCase() + ': ';

    const corpo = document.createElement('span');
    corpo.className = 'quiz__texto';
    corpo.textContent = texto;

    const marca = document.createElement('span');
    marca.className = 'quiz__marca';
    marca.setAttribute('aria-hidden', 'true');

    rotulo.append(radio, letra, letraLeitor, corpo, marca);
    lista.appendChild(rotulo);
  });

  bloco.appendChild(lista);

  // Só aparece na correção imediata, para quem marca pelo teclado ou leitor de tela: as setas
  // mudam a alternativa, então corrigir a cada seta travaria a primeira que passou por ali.
  const confirmar = document.createElement('button');
  confirmar.type = 'button';
  confirmar.className = 'quiz__botao quiz__confirmar';
  confirmar.hidden = true;
  confirmar.innerHTML =
    '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Confirmar resposta';
  bloco.appendChild(confirmar);

  const resposta = document.createElement('p');
  resposta.className = 'quiz__resposta';
  resposta.hidden = true;
  // Recebe o foco depois de uma correção por teclado: a alternativa some do foco ao travar.
  resposta.tabIndex = -1;
  bloco.appendChild(resposta);

  return bloco;
}

export function montarQuiz() {
  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  if (!artigo || artigo.dataset.quizPronto === 'true') return;

  let gabarito: Gabarito[] = [];
  try {
    gabarito = JSON.parse(artigo.dataset.gabarito || '[]');
  } catch {
    gabarito = [];
  }
  if (!gabarito.length) return;

  const questoes = coletarQuestoes(artigo);
  if (!questoes.length) return;

  artigo.dataset.quizPronto = 'true';

  const form = document.createElement('form');
  form.className = 'quiz';
  form.noValidate = true;
  form.addEventListener('submit', (e) => e.preventDefault());

  // O formulário entra onde estava a primeira questão; as questões são movidas
  // para dentro dele na ordem em que aparecem.
  questoes[0].enunciado[0].before(form);

  questoes.forEach((q, i) => {
    form.appendChild(montarQuestao(q, i));
    q.paragrafoAlternativas?.remove();
  });

  const acoes = document.createElement('div');
  acoes.className = 'quiz__acoes';

  const corrigir = document.createElement('button');
  corrigir.type = 'button';
  corrigir.className = 'quiz__botao quiz__botao--principal';
  corrigir.innerHTML =
    '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Corrigir respostas';

  const refazer = document.createElement('button');
  refazer.type = 'button';
  refazer.className = 'quiz__botao';
  refazer.hidden = true;
  refazer.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Refazer';

  const placar = document.createElement('p');
  placar.className = 'quiz__placar';
  placar.setAttribute('role', 'status');
  placar.setAttribute('aria-live', 'polite');
  // Recebe o foco depois de corrigir: o botão "Corrigir" some e o foco não pode se perder.
  placar.tabIndex = -1;

  // Região viva só para leitor de tela: avisa o resultado de cada questão corrigida na hora.
  const anuncio = document.createElement('p');
  anuncio.className = 'apenas-leitor';
  anuncio.setAttribute('role', 'status');
  anuncio.setAttribute('aria-live', 'polite');

  acoes.append(corrigir, refazer, placar, anuncio);
  form.appendChild(acoes);

  const blocos = () => Array.from(form.querySelectorAll<HTMLElement>('.quiz__questao'));
  const corrigida = (bloco: HTMLElement) => bloco.dataset.estado !== undefined;

  /** O modo vem da preferência de acessibilidade (data-correcao no <html>). Padrão: imediata. */
  const imediata = () => document.documentElement.dataset.correcao !== 'final';

  /** Como o usuário marcou por último: mouse e toque corrigem na hora; teclado e leitor de tela pedem confirmação. */
  let entrada: 'ponteiro' | 'teclado' = 'teclado';
  form.addEventListener('pointerdown', () => (entrada = 'ponteiro'), true);
  form.addEventListener('keydown', () => (entrada = 'teclado'), true);

  /** Corrige uma questão (a marcada, ou nenhuma) e trava as alternativas. Devolve o veredito. */
  function corrigirQuestao(bloco: HTMLElement): string | null {
    const i = Number(bloco.dataset.questao);
    const chave = gabarito[i];
    if (!chave) return null;

    const escolhido = bloco.querySelector<HTMLInputElement>('input:checked');
    const escolha = escolhido ? Number(escolhido.value) : -1;
    const acertou = escolha === chave.correta;

    bloco.dataset.estado = escolha < 0 ? 'vazia' : acertou ? 'certa' : 'errada';
    // Verde: a que você marcou e acertou. Vermelho: a que você marcou e errou.
    // Amarelo: a que era a correta, quando você errou ou não marcou nada.
    bloco.querySelectorAll<HTMLElement>('.quiz__alternativa').forEach((alt, j) => {
      alt.querySelector<HTMLInputElement>('input')!.disabled = true;
      if (j === chave.correta) alt.dataset.estado = acertou ? 'certa' : 'gabarito';
      else if (j === escolha) alt.dataset.estado = 'errada';
    });
    bloco.querySelector<HTMLElement>('.quiz__confirmar')!.hidden = true;

    const resposta = bloco.querySelector<HTMLElement>('.quiz__resposta')!;
    const letra = LETRAS[chave.correta].toUpperCase();
    // O resultado é dito em texto (não só pela cor e pelo ícone da alternativa).
    const veredito =
      escolha < 0
        ? 'Você não selecionou nenhuma alternativa. A alternativa que deveria ser marcada era a ' +
          letra + ' (em amarelo).'
        : acertou
          ? 'Você acertou. Resposta correta: ' + letra + '.'
          : 'Você errou. A resposta correta era a ' + letra + ' (em amarelo).';
    resposta.textContent = veredito + (chave.porque ? ' ' + chave.porque : '');
    resposta.hidden = false;
    return veredito;
  }

  /** Botões e placar refletem o estado: o que já foi corrigido e o modo atual. */
  function atualizarAcoes(): { acertos: number; respondidas: number; total: number } {
    const lista = blocos();
    const feitas = lista.filter(corrigida);
    const acertos = feitas.filter((b) => b.dataset.estado === 'certa').length;
    const respondidas = feitas.filter((b) => b.dataset.estado !== 'vazia').length;
    const total = gabarito.length;
    const tudo = feitas.length >= lista.length;

    corrigir.hidden = imediata() || tudo;
    refazer.hidden = feitas.length === 0;

    if (!tudo) {
      placar.textContent = '';
      placar.removeAttribute('data-nota');
    } else {
      placar.textContent =
        respondidas === 0
          ? 'Você não selecionou nenhuma alternativa. As respostas que deveriam ser marcadas estão em amarelo, nas questões acima.'
          : 'Você acertou ' + acertos + ' de ' + total + '. As respostas corretas das que você errou ou deixou em branco estão em amarelo, nas questões acima.';
      placar.dataset.nota =
        respondidas === 0
          ? 'vazia'
          : acertos === total
            ? 'cheia'
            : acertos >= total / 2
              ? 'media'
              : 'baixa';
    }
    // Avisa quantas questões já foram respondidas (andamento da aula, ver ligarAulaAtual).
    document.dispatchEvent(
      new window.CustomEvent('cdt:questoes', { detail: { respondidas, total: lista.length } })
    );
    return { acertos, respondidas, total };
  }

  function avisarFim(acertos: number, respondidas: number, total: number) {
    const w = window as unknown as { cdt?: { toast?: (m: string, i?: string) => void } };
    w.cdt?.toast?.(
      respondidas === 0 ? 'Gabarito revelado' : acertos + ' de ' + total + ' corretas',
      acertos === total ? 'trophy' : 'circle-check'
    );
  }

  /** Correção imediata de uma questão, depois que o usuário marcou ou confirmou. */
  function corrigirNaHora(bloco: HTMLElement) {
    if (corrigida(bloco)) return;
    const veredito = corrigirQuestao(bloco);
    if (!veredito) return;
    const { acertos, respondidas, total } = atualizarAcoes();
    const legenda = bloco.querySelector('.quiz__legenda')?.textContent ?? '';
    if (entrada === 'teclado') {
      // A alternativa travou e perdeu o foco: leva o foco ao resultado, que o leitor de tela lê.
      bloco.querySelector<HTMLElement>('.quiz__resposta')?.focus({ preventScroll: true });
    } else {
      anuncio.textContent = '';
      window.setTimeout(() => (anuncio.textContent = legenda + ': ' + veredito), 30);
    }
    if (blocos().every(corrigida)) avisarFim(acertos, respondidas, total);
  }

  function limpar() {
    form.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((r) => {
      r.checked = false;
      r.disabled = false;
    });
    form.querySelectorAll<HTMLElement>('.quiz__alternativa').forEach((el) => {
      delete el.dataset.estado;
    });
    form.querySelectorAll<HTMLElement>('.quiz__resposta').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    form.querySelectorAll<HTMLElement>('.quiz__confirmar').forEach((el) => {
      el.hidden = true;
    });
    blocos().forEach((el) => {
      delete el.dataset.estado;
    });
    anuncio.textContent = '';
    atualizarAcoes();
    // "Refazer" some ao ser ativado: devolve o foco ao começo do quiz.
    const primeira = form.querySelector<HTMLInputElement>('.quiz__questao input[type="radio"]');
    primeira?.focus({ preventScroll: true });
    form.querySelector<HTMLElement>('.quiz__questao')?.scrollIntoView({ block: 'center' });
  }

  // Correção imediata: marcou com o mouse ou o dedo, já recebe o resultado. Pelo teclado
  // (ou leitor de tela) aparece "Confirmar resposta", e Enter na alternativa também confirma.
  form.addEventListener('change', (e) => {
    if (!imediata()) return;
    const radio = e.target as HTMLElement;
    const bloco = radio.closest<HTMLElement>('.quiz__questao');
    if (!bloco || corrigida(bloco)) return;
    if (entrada === 'ponteiro') corrigirNaHora(bloco);
    else bloco.querySelector<HTMLElement>('.quiz__confirmar')!.hidden = false;
  });
  form.addEventListener('keydown', (e) => {
    const alvo = e.target as HTMLElement;
    if (e.key !== 'Enter' || !imediata() || !alvo.matches('input[type="radio"]')) return;
    const bloco = alvo.closest<HTMLElement>('.quiz__questao');
    if (bloco && (alvo as HTMLInputElement).checked) {
      e.preventDefault();
      corrigirNaHora(bloco);
    }
  });
  form.addEventListener('click', (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLElement>('.quiz__confirmar');
    if (!botao) return;
    entrada = 'teclado';
    corrigirNaHora(botao.closest<HTMLElement>('.quiz__questao')!);
  });

  corrigir.addEventListener('click', () => {
    blocos().filter((b) => !corrigida(b)).forEach(corrigirQuestao);
    const { acertos, respondidas, total } = atualizarAcoes();
    placar.focus({ preventScroll: true });
    avisarFim(acertos, respondidas, total);
  });

  refazer.addEventListener('click', limpar);

  // Mudou o modo no painel de acessibilidade com o quiz em andamento: o que já está marcado e
  // ainda sem resultado recebe o resultado na hora (modo imediato) ou espera o botão (no final).
  ouvirMudancaDeModo();
  aoMudarModo = () => {
    if (!form.isConnected) return;
    if (imediata()) {
      blocos()
        .filter((b) => !corrigida(b) && b.querySelector('input:checked'))
        .forEach(corrigirQuestao);
    }
    atualizarAcoes();
  };
  atualizarAcoes();
}

/** Quem monta o quiz da página registra aqui o que fazer quando o modo de correção muda. */
let aoMudarModo: (() => void) | null = null;
let ouvindoModo = false;

function ouvirMudancaDeModo() {
  if (ouvindoModo) return;
  ouvindoModo = true;
  document.addEventListener('cdt:correcao', () => aoMudarModo?.());
}
