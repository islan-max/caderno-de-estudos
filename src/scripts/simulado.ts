/* ---------------------------------------------------------------------------
 * Simulado (/simulado): sorteia, mostra, cronometra e corrige.
 *
 * As questões não são copiadas para a página: cada uma é lida da página da sua aula
 * (baixada com fetch, que o service worker guarda para o offline) pelo mesmo leitor do
 * quiz (coletarQuestoes). Assim a aula continua sendo a única fonte do texto, das
 * imagens e do gabarito. As regras puras ficam em src/lib/simulado.ts.
 *
 * O andamento fica em localStorage (cdt:simulado) e sobrevive a recarregar a página.
 * Ao corrigir, cada resposta entra no registro de estudo igual a uma do quiz da aula.
 * ------------------------------------------------------------------------- */
import { MINUTOS_POR_QUESTAO, formatarTempo, lerSalvo, resultado, sortear } from '../lib/simulado.ts';
import type { QuestaoDisponivel, SimuladoSalvo } from '../lib/simulado.ts';
import { parseRevisar } from '../lib/estudo.ts';
import { coletarQuestoes } from './quiz.ts';
import { acharSecao } from './secoes-aula.ts';
import { registrar } from './registro.ts';
import { confirmarAcao } from './confirmacao.ts';
import { toast } from './avisos.ts';

const CHAVE = 'cdt:simulado';
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

interface Dados {
  aulas: Record<string, { titulo: string; url: string }>;
  disponiveis: QuestaoDisponivel[];
  materias: { slug: string; label: string }[];
}

/** Uma questão já montada na tela. */
interface Montada {
  q: QuestaoDisponivel;
  correta: number;
  porque: string;
  /** Endereço da seção citada em "Revisar:", ou da aula quando não há seção. */
  linkRever: string;
  secao: string | null;
  bloco: HTMLFieldSetElement;
}

let relogio = 0;

function salvar(s: SimuladoSalvo | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: o simulado só não sobrevive a recarregar */
  }
}

function lerGuardado(): SimuladoSalvo | null {
  try {
    return lerSalvo(JSON.parse(localStorage.getItem(CHAVE) || 'null'));
  } catch {
    return null;
  }
}

export function montarSimulado() {
  const raiz = document.querySelector<HTMLElement>('[data-simulado]');
  if (!raiz || raiz.dataset.pronto) return;
  raiz.dataset.pronto = '1';
  window.clearInterval(relogio);

  const dados: Dados = JSON.parse(raiz.querySelector('[data-simulado-dados]')?.textContent || '{}');
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const config = $<HTMLFormElement>('[data-sim-config]');
  const prova = $('[data-sim-prova]');
  const form = $<HTMLFormElement>('[data-sim-questoes]');
  const status = $('[data-sim-status]');
  const caixaResultado = $('[data-sim-resultado]');
  const entregar = $<HTMLButtonElement>('[data-sim-entregar]');
  const novo = $<HTMLButtonElement>('[data-sim-novo]');
  const desistir = $<HTMLButtonElement>('[data-sim-desistir]');
  const erro = $('[data-sim-erro]');
  const nomeMateria = (slug: string) => dados.materias.find((m) => m.slug === slug)?.label ?? slug;

  let atual: SimuladoSalvo | null = null;
  let montadas: Montada[] = [];
  let corrigido = false;

  function mostrarConfig() {
    window.clearInterval(relogio);
    atual = null;
    montadas = [];
    corrigido = false;
    form.replaceChildren();
    caixaResultado.hidden = true;
    prova.hidden = true;
    config.hidden = false;
  }

  config.addEventListener('submit', (e) => {
    e.preventDefault();
    const materias = [...config.querySelectorAll<HTMLInputElement>('input[name="materia"]:checked')].map((i) => i.value);
    const total = Number(config.querySelector<HTMLInputElement>('input[name="total"]:checked')?.value || 15);
    const cronometro = config.querySelector<HTMLInputElement>('input[name="cronometro"]')!.checked;
    if (!materias.length) {
      erro.textContent = 'Escolha pelo menos uma matéria.';
      erro.hidden = false;
      return;
    }
    erro.hidden = true;
    const questoes = sortear(dados.disponiveis, materias, total);
    const s: SimuladoSalvo = {
      questoes,
      respostas: questoes.map(() => -1),
      inicio: Date.now(),
      limite: cronometro ? questoes.length * MINUTOS_POR_QUESTAO * 60_000 : null,
    };
    salvar(s);
    void comecar(s);
  });

  async function comecar(s: SimuladoSalvo) {
    atual = s;
    corrigido = false;
    config.hidden = true;
    prova.hidden = false;
    caixaResultado.hidden = true;
    entregar.hidden = false;
    desistir.hidden = false;
    novo.hidden = true;
    form.replaceChildren();
    status.textContent = 'Carregando as questões…';
    raiz.scrollIntoView({ block: 'start' });

    montadas = await carregar(s.questoes);
    if (atual !== s) return; // desistiu enquanto carregava
    const faltaram = s.questoes.length - montadas.length;
    if (!montadas.length) {
      salvar(null);
      mostrarConfig();
      erro.textContent = 'Não deu para carregar as questões. Confira a internet e tente de novo.';
      erro.hidden = false;
      return;
    }
    if (faltaram) {
      // Fica só com as que carregaram (as outras dependem de internet).
      const ok = new Set(montadas.map((m) => m.q));
      s.respostas = s.questoes.flatMap((q, i) => (ok.has(q) ? [s.respostas[i]] : []));
      s.questoes = s.questoes.filter((q) => ok.has(q));
      if (s.limite) s.limite = s.questoes.length * MINUTOS_POR_QUESTAO * 60_000;
      salvar(s);
    }
    montadas.forEach((m, i) => {
      m.bloco.dataset.questao = String(i);
      m.bloco.querySelector('legend')!.textContent = `Questão ${i + 1} · ${nomeMateria(m.q.materia)}`;
      m.bloco.querySelectorAll<HTMLInputElement>('input').forEach((r) => {
        r.name = `sim-${i}`;
        r.id = `sim-${i}-${r.value}`;
        r.checked = Number(r.value) === s.respostas[i];
        r.closest('label')!.htmlFor = r.id;
      });
      form.append(m.bloco);
    });
    status.textContent = faltaram
      ? `${faltaram} ${faltaram === 1 ? 'questão não carregou' : 'questões não carregaram'} (sem internet); o simulado segue com ${montadas.length}.`
      : '';
    $('[data-sim-total]').textContent = String(montadas.length);
    atualizarConta();
    ligarRelogio();
  }

  /** Baixa cada aula uma vez (no máximo 4 ao mesmo tempo) e monta as questões pedidas. */
  async function carregar(questoes: QuestaoDisponivel[]): Promise<Montada[]> {
    const aulas = [...new Set(questoes.map((q) => q.aula))];
    const docs = new Map<string, Document | null>();
    let proxima = 0;
    async function trabalhador() {
      while (proxima < aulas.length) {
        const aula = aulas[proxima++];
        const info = dados.aulas[aula];
        try {
          const r = await fetch(info.url);
          docs.set(aula, r.ok ? new DOMParser().parseFromString(await r.text(), 'text/html') : null);
        } catch {
          docs.set(aula, null);
        }
      }
    }
    await Promise.all([1, 2, 3, 4].map(trabalhador));

    const lidas = new Map<string, { artigo: HTMLElement; gabarito: { correta: number; porque?: string }[]; questoes: ReturnType<typeof coletarQuestoes> }>();
    const saida: Montada[] = [];
    for (const q of questoes) {
      const doc = docs.get(q.aula);
      if (!doc) continue;
      if (!lidas.has(q.aula)) {
        const artigo = doc.querySelector<HTMLElement>('[data-conteudo-aula]');
        if (!artigo) continue;
        let gabarito = [];
        try {
          gabarito = JSON.parse(artigo.dataset.gabarito || '[]');
        } catch {
          gabarito = [];
        }
        lidas.set(q.aula, { artigo, gabarito, questoes: coletarQuestoes(artigo) });
      }
      const { artigo, gabarito, questoes: lista } = lidas.get(q.aula)!;
      const original = lista[q.n];
      const chave = gabarito[q.n];
      if (!original || !chave) continue;
      const { secao } = parseRevisar(chave.porque ?? '');
      const titulo = secao ? acharSecao(artigo, secao) : null;
      const url = dados.aulas[q.aula].url;
      saida.push({
        q,
        correta: chave.correta,
        porque: chave.porque ?? '',
        secao,
        linkRever: titulo?.id ? `${url}#${titulo.id}` : url,
        bloco: montarBloco(original.enunciado, original.alternativas),
      });
    }
    return saida;
  }

  function montarBloco(enunciado: HTMLElement[], alternativas: string[]): HTMLFieldSetElement {
    const bloco = document.createElement('fieldset');
    bloco.className = 'quiz__questao';
    const legenda = document.createElement('legend');
    legenda.className = 'quiz__legenda';
    bloco.append(legenda);

    const corpo = document.createElement('div');
    corpo.className = 'quiz__enunciado';
    for (const el of enunciado) {
      const copia = document.importNode(el, true) as HTMLElement;
      const forte = copia.querySelector('strong');
      if (forte && /^Quest[ãa]o\s+\d+/i.test(forte.textContent || '')) {
        forte.remove();
        if (!(copia.textContent || '').trim() && !copia.querySelector('img, svg, table')) continue;
      }
      // Os ids da aula não valem aqui (e repetiriam entre questões).
      copia.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      copia.removeAttribute('id');
      corpo.append(copia);
    }
    bloco.append(corpo);

    const lista = document.createElement('div');
    lista.className = 'quiz__alternativas';
    alternativas.forEach((texto, i) => {
      const rotulo = document.createElement('label');
      rotulo.className = 'quiz__alternativa';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.value = String(i);
      radio.className = 'quiz__radio';
      const letra = document.createElement('span');
      letra.className = 'quiz__letra';
      letra.setAttribute('aria-hidden', 'true');
      letra.textContent = LETRAS[i];
      const leitor = document.createElement('span');
      leitor.className = 'apenas-leitor';
      leitor.textContent = `Alternativa ${LETRAS[i]}: `;
      const t = document.createElement('span');
      t.className = 'quiz__texto';
      t.textContent = texto;
      const marca = document.createElement('span');
      marca.className = 'quiz__marca';
      marca.setAttribute('aria-hidden', 'true');
      rotulo.append(radio, letra, leitor, t, marca);
      lista.append(rotulo);
    });
    bloco.append(lista);

    const resposta = document.createElement('p');
    resposta.className = 'quiz__resposta';
    resposta.hidden = true;
    bloco.append(resposta);
    return bloco;
  }

  form.addEventListener('change', (e) => {
    const radio = e.target as HTMLInputElement;
    const bloco = radio.closest<HTMLElement>('.quiz__questao');
    if (!atual || corrigido || !bloco) return;
    atual.respostas[Number(bloco.dataset.questao)] = Number(radio.value);
    salvar(atual);
    atualizarConta();
  });

  function atualizarConta() {
    if (!atual) return;
    const feitas = atual.respostas.filter((r) => r >= 0).length;
    $('[data-sim-respondidas]').textContent = String(feitas);
    $('[data-sim-progresso]').style.width = `${(feitas / Math.max(1, atual.respostas.length)) * 100}%`;
  }

  function ligarRelogio() {
    window.clearInterval(relogio);
    const caixa = $('[data-sim-tempo-caixa]');
    const visor = $('[data-sim-tempo]');
    caixa.hidden = false;
    const tique = () => {
      if (!atual || corrigido) return window.clearInterval(relogio);
      const passou = Date.now() - atual.inicio;
      if (atual.limite) {
        const falta = atual.limite - passou;
        visor.textContent = formatarTempo(falta);
        visor.setAttribute('aria-label', `Tempo restante: ${formatarTempo(falta)}`);
        caixa.dataset.pouco = falta <= 5 * 60_000 ? 'sim' : 'nao';
        if (falta <= 0) {
          toast('Tempo esgotado: o simulado foi corrigido', 'clock');
          corrigir();
        }
      } else {
        visor.textContent = formatarTempo(passou);
        visor.setAttribute('aria-label', `Tempo de prova: ${formatarTempo(passou)}`);
      }
    };
    tique();
    relogio = window.setInterval(tique, 1000);
  }

  entregar.addEventListener('click', async () => {
    if (!atual) return;
    const brancas = atual.respostas.filter((r) => r < 0).length;
    if (brancas) {
      const { ok } = await confirmarAcao({
        titulo: 'Entregar com questões em branco?',
        texto: `${brancas} ${brancas === 1 ? 'questão está' : 'questões estão'} sem resposta e ${brancas === 1 ? 'conta' : 'contam'} como erro.`,
        confirmar: 'Entregar assim',
      });
      if (!ok) return;
    }
    corrigir();
  });

  desistir.addEventListener('click', async () => {
    const { ok } = await confirmarAcao({
      titulo: 'Desistir do simulado?',
      texto: 'As respostas marcadas até aqui são descartadas e nada entra no seu registro.',
      confirmar: 'Desistir',
    });
    if (!ok) return;
    salvar(null);
    mostrarConfig();
    config.querySelector<HTMLElement>('input')?.focus();
  });

  novo.addEventListener('click', () => {
    mostrarConfig();
    raiz.scrollIntoView({ block: 'start' });
    config.querySelector<HTMLElement>('button[type="submit"]')?.focus({ preventScroll: true });
  });

  function corrigir() {
    if (!atual || corrigido) return;
    corrigido = true;
    window.clearInterval(relogio);
    const tempo = Date.now() - atual.inicio;
    const respostas = atual.respostas;

    montadas.forEach((m, i) => {
      const escolha = respostas[i];
      const acertou = escolha === m.correta;
      m.bloco.dataset.estado = escolha < 0 ? 'vazia' : acertou ? 'certa' : 'errada';
      m.bloco.querySelectorAll<HTMLElement>('.quiz__alternativa').forEach((alt, j) => {
        alt.querySelector('input')!.disabled = true;
        if (j === m.correta) alt.dataset.estado = acertou ? 'certa' : 'gabarito';
        else if (j === escolha) alt.dataset.estado = 'errada';
      });
      const letra = LETRAS[m.correta];
      const veredito =
        escolha < 0
          ? `Em branco. A correta era a ${letra} (em amarelo).`
          : acertou
            ? `Você acertou. Resposta correta: ${letra}.`
            : `Você errou. A correta era a ${letra} (em amarelo).`;
      const { texto } = parseRevisar(m.porque);
      const resposta = m.bloco.querySelector<HTMLElement>('.quiz__resposta')!;
      resposta.textContent = veredito + (texto ? ' ' + texto : '');
      resposta.hidden = false;
      const origem = document.createElement('p');
      origem.className = 'sim-origem';
      const a = document.createElement('a');
      a.href = m.linkRever;
      a.textContent = `${dados.aulas[m.q.aula].titulo}${m.secao ? ' › ' + m.secao : ''}`;
      origem.append(acertou ? 'Da aula ' : 'Rever na aula: ', a);
      m.bloco.append(origem);
      if (escolha >= 0) registrar({ k: 'q', a: m.q.aula, n: m.q.n, ok: acertou, ...(m.secao ? { s: m.secao } : {}) });
    });

    mostrarResultado(tempo);
    salvar(null);
    entregar.hidden = true;
    desistir.hidden = true;
    novo.hidden = false;
  }

  function mostrarResultado(tempo: number) {
    const r = resultado(montadas.map((m, i) => ({ materia: m.q.materia, correta: m.correta, escolha: atual!.respostas[i] })));
    const nota = document.createElement('p');
    nota.className = 'sim-nota';
    nota.textContent = `${r.acertos} de ${r.total} (${Math.round((r.acertos / r.total) * 100)}%)`;
    const sub = document.createElement('p');
    sub.className = 'sim-nota-sub';
    sub.textContent = `${r.respondidas} respondidas em ${formatarTempo(tempo)}. As corretas das que você errou estão em amarelo nas questões abaixo.`;

    const lista = document.createElement('ul');
    lista.className = 'sim-materias';
    for (const m of r.porMateria) {
      const li = document.createElement('li');
      li.className = 'sim-materia';
      li.style.setProperty('--cor', `var(--color-${m.materia})`);
      const nome = document.createElement('span');
      nome.textContent = nomeMateria(m.materia);
      const conta = document.createElement('span');
      conta.textContent = `${m.acertos} de ${m.total}`;
      const barra = document.createElement('span');
      barra.className = 'sim-materia__barra';
      barra.setAttribute('aria-hidden', 'true');
      const cheio = document.createElement('span');
      cheio.style.width = `${(m.acertos / m.total) * 100}%`;
      barra.append(cheio);
      li.append(nome, conta, barra);
      lista.append(li);
    }

    const partes: Node[] = [nota, sub, lista];
    // O que estudar: cada seção errada uma vez só, com link direto.
    const erradas = new Map<string, Montada>();
    montadas.forEach((m, i) => {
      if (atual!.respostas[i] !== m.correta) erradas.set(m.linkRever, m);
    });
    if (erradas.size) {
      const h = document.createElement('h2');
      h.textContent = 'Para estudar agora';
      const ul = document.createElement('ul');
      ul.className = 'sim-rever';
      for (const m of erradas.values()) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = m.linkRever;
        a.textContent = `${nomeMateria(m.q.materia)}: ${dados.aulas[m.q.aula].titulo}${m.secao ? ' › ' + m.secao : ''}`;
        li.append(a);
        ul.append(li);
      }
      partes.push(h, ul);
    }
    caixaResultado.replaceChildren(...partes);
    caixaResultado.hidden = false;
    caixaResultado.focus({ preventScroll: true });
    caixaResultado.scrollIntoView({ block: 'start' });
    toast(`${r.acertos} de ${r.total} corretas`, r.acertos === r.total ? 'trophy' : 'circle-check');
  }

  // Simulado em andamento (página recarregada ou volta depois): continua de onde parou.
  const guardado = lerGuardado();
  if (guardado) void comecar(guardado);
}
