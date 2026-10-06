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

  const resposta = document.createElement('p');
  resposta.className = 'quiz__resposta';
  resposta.hidden = true;
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

  acoes.append(corrigir, refazer, placar);
  form.appendChild(acoes);

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
    form.querySelectorAll<HTMLElement>('.quiz__questao').forEach((el) => {
      delete el.dataset.estado;
    });
    placar.textContent = '';
    placar.removeAttribute('data-nota');
    corrigir.hidden = false;
    refazer.hidden = true;
    // "Refazer" some ao ser ativado: devolve o foco ao começo do quiz.
    const primeira = form.querySelector<HTMLInputElement>('.quiz__questao input[type="radio"]');
    primeira?.focus({ preventScroll: true });
    form.querySelector<HTMLElement>('.quiz__questao')?.scrollIntoView({ block: 'center' });
  }

  corrigir.addEventListener('click', () => {
    let acertos = 0;
    let respondidas = 0;

    form.querySelectorAll<HTMLElement>('.quiz__questao').forEach((bloco) => {
      const i = Number(bloco.dataset.questao);
      const chave = gabarito[i];
      if (!chave) return;

      const escolhido = bloco.querySelector<HTMLInputElement>('input:checked');
      if (escolhido) respondidas += 1;
      const escolha = escolhido ? Number(escolhido.value) : -1;
      const acertou = escolha === chave.correta;
      if (acertou) acertos += 1;

      bloco.dataset.estado = escolha < 0 ? 'vazia' : acertou ? 'certa' : 'errada';

      bloco.querySelectorAll<HTMLElement>('.quiz__alternativa').forEach((alt, j) => {
        alt.querySelector<HTMLInputElement>('input')!.disabled = true;
        if (j === chave.correta) alt.dataset.estado = 'certa';
        else if (j === escolha) alt.dataset.estado = 'errada';
      });

      const resposta = bloco.querySelector<HTMLElement>('.quiz__resposta')!;
      const letra = LETRAS[chave.correta].toUpperCase();
      // O resultado é dito em texto (não só pela cor e pelo ícone da alternativa).
      const veredito = escolha < 0 ? 'Sem resposta.' : acertou ? 'Você acertou.' : 'Você errou.';
      resposta.textContent =
        veredito + ' Resposta correta: ' + letra + '.' + (chave.porque ? ' ' + chave.porque : '');
      resposta.hidden = false;
    });

    const total = gabarito.length;
    placar.textContent =
      respondidas === 0
        ? 'Nenhuma alternativa marcada. As respostas certas estão indicadas abaixo.'
        : 'Você acertou ' + acertos + ' de ' + total + '.';
    placar.dataset.nota = acertos === total ? 'cheia' : acertos >= total / 2 ? 'media' : 'baixa';

    corrigir.hidden = true;
    refazer.hidden = false;
    placar.focus({ preventScroll: true });

    const w = window as unknown as { cdt?: { toast?: (m: string, i?: string) => void } };
    w.cdt?.toast?.(
      respondidas === 0 ? 'Gabarito revelado' : acertos + ' de ' + total + ' corretas',
      acertos === total ? 'trophy' : 'circle-check'
    );
  });

  refazer.addEventListener('click', limpar);
}
