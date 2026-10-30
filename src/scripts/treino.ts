/* ---------------------------------------------------------------------------
 * /treino: a página de navegação (estado de cada lista) e a página de cada lista (cronômetro com
 * pausa, respostas, chutes, correção e resumo para colar no chat).
 *
 * A marcação sai pronta do build (src/pages/treino/[id].astro). Aqui só se liga o estado, guardado
 * no navegador em `cdt:treino:<id>`, para sobreviver a fechar ou recarregar a página. O texto da
 * redação quem guarda é a folha (src/components/Textarea.astro).
 * ------------------------------------------------------------------------- */
import { ler, gravar } from './util';
import { toast } from './avisos';
import { confirmarAcao } from './confirmacao';
import { relogio } from '../lib/treino';

interface Estado {
  /** Letra marcada em cada questão. */
  r: Record<string, string>;
  /** Questões marcadas como chute. */
  c: Record<string, boolean>;
  /** Início, fim, milissegundos já pausados e início da pausa atual (0 = não pausado). */
  ini: number;
  fim: number;
  p: number;
  pa: number;
  /** Acertos e total, guardados na entrega para a página de navegação mostrar. */
  nota?: { c: number; t: number };
}

const CHAVE = 'cdt:treino:';
const NOVO = (): Estado => ({ r: {}, c: {}, ini: 0, fim: 0, p: 0, pa: 0 });
const palavras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Segundos de prova já usados, sem contar as pausas. */
function decorrido(e: Estado): number {
  if (!e.ini) return 0;
  return Math.max(0, Math.round(((e.fim || e.pa || Date.now()) - e.ini - (e.p || 0)) / 1000));
}

function montarHub() {
  document.querySelectorAll<HTMLElement>('[data-treino-card]').forEach((card) => {
    const e = ler<Estado>(CHAVE + card.dataset.treinoCard, NOVO());
    const total = Number(card.dataset.total);
    const rotulo = card.querySelector<HTMLElement>('[data-estado-card]')!;
    const respondidas = Object.keys(e.r).length;
    if (e.fim) {
      rotulo.dataset.estado = 'feito';
      rotulo.textContent = e.nota ? `Feito · ${e.nota.c} de ${e.nota.t} (${Math.round((e.nota.c / e.nota.t) * 100)}%)` : 'Entregue';
    } else if (e.ini || respondidas) {
      rotulo.dataset.estado = 'andamento';
      rotulo.textContent = total ? `Em andamento · ${respondidas} de ${total} respondidas` : 'Em andamento';
    }
  });
}

function montarProva() {
  const raiz = document.querySelector<HTMLElement>('[data-treino]');
  if (!raiz) return;
  const id = raiz.dataset.treino!;
  const chave = CHAVE + id;
  const ehRedacao = raiz.dataset.tipo === 'redacao';
  const limite = Number(raiz.dataset.minutos) * 60;
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const estado = ler<Estado>(chave, NOVO());
  const salvar = () => gravar(chave, estado);
  const fichas = Array.from(raiz.querySelectorAll<HTMLElement>('.tr-q'));
  const folha = raiz.querySelector<HTMLTextAreaElement>('.folha__campo');

  // ---- cronômetro ----------------------------------------------------------------------------
  const tempo = q('[data-tempo]');
  const caixaTempo = tempo.closest<HTMLElement>('.tr-barra__tempo')!;
  const btnIniciar = q<HTMLButtonElement>('[data-iniciar]');
  const btnPausar = q<HTMLButtonElement>('[data-pausar]');
  const rotuloPausar = q('[data-pausar-rotulo]');
  let relogioId = 0;

  const pintar = () => {
    const sobra = limite - decorrido(estado);
    tempo.textContent = (sobra < 0 ? '+' : '') + relogio(sobra);
    caixaTempo.dataset.pouco = sobra < 300 ? 'sim' : 'nao';
  };
  const rotular = () => {
    rotuloPausar.textContent = estado.pa ? 'Continuar' : 'Pausar';
    btnPausar.querySelector('i')!.className = `fa-solid fa-${estado.pa ? 'play' : 'hourglass-half'}`;
  };
  const andar = () => {
    btnIniciar.hidden = true;
    btnPausar.hidden = !!estado.fim;
    rotular();
    pintar();
    if (!estado.fim) relogioId = window.setInterval(pintar, 1000);
  };
  // O cronômetro também começa sozinho na primeira resposta (ou na primeira letra da redação).
  const comecar = () => {
    if (estado.ini) return;
    estado.ini = Date.now();
    andar();
  };
  if (estado.ini) andar();
  btnIniciar.addEventListener('click', () => {
    comecar();
    salvar();
  });
  btnPausar.addEventListener('click', () => {
    if (estado.pa) {
      estado.p += Date.now() - estado.pa;
      estado.pa = 0;
    } else estado.pa = Date.now();
    rotular();
    salvar();
    pintar();
  });

  // ---- respostas -----------------------------------------------------------------------------
  const rotuloRespondidas = raiz.querySelector<HTMLElement>('[data-respondidas]');
  const barra = raiz.querySelector<HTMLElement>('[data-progresso]');
  const contar = () => {
    const n = fichas.filter((f) => estado.r[f.dataset.q!]).length;
    if (rotuloRespondidas) rotuloRespondidas.textContent = String(n);
    if (barra) barra.style.width = `${(n / fichas.length) * 100}%`;
  };
  fichas.forEach((f) => {
    const qid = f.dataset.q!;
    const marcada = f.querySelector<HTMLInputElement>(`input[type=radio][value="${estado.r[qid]}"]`);
    if (marcada) marcada.checked = true;
    f.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked = !!estado.c[qid];
    f.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.type === 'radio') estado.r[qid] = el.value;
      else estado.c[qid] = el.checked;
      comecar();
      salvar();
      contar();
    });
  });
  contar();
  raiz.querySelector('[data-folha]')?.addEventListener('input', () => {
    comecar();
    salvar();
  });

  // ---- entrega -------------------------------------------------------------------------------
  const resultado = q('[data-resultado]');
  const copia = q<HTMLTextAreaElement>('[data-copia]');
  const nota = q('[data-nota]');
  const notaSub = q('[data-nota-sub]');

  function corrigir(): { texto: string } {
    let certas = 0;
    let brancas = 0;
    let chutes = 0;
    let chutesCertos = 0;
    const lista = raiz!.querySelector<HTMLElement>('[data-erros]')!;
    lista.replaceChildren();
    const linhas: string[] = [];
    const chutados: string[] = [];

    for (const f of fichas) {
      const qid = f.dataset.q!;
      const resp = estado.r[qid] ?? '';
      const gab = f.dataset.gab!;
      const num = f.dataset.num!;
      const chute = !!estado.c[qid];
      const certa = !gab || resp === gab; // sem gabarito = anulada pelo INEP: vale ponto para todos
      const res = f.querySelector<HTMLElement>('[data-res]')!;
      f.querySelectorAll('input').forEach((i) => (i.disabled = true));

      if (gab) {
        f.dataset.estado = certa ? 'certa' : resp ? 'errada' : 'vazia';
        const rotulo = (l: string) => f.querySelector<HTMLElement>(`.quiz__alternativa[data-letra="${l}"]`);
        if (resp) rotulo(resp)!.dataset.estado = certa ? 'certa' : 'errada';
        if (!certa) rotulo(gab)!.dataset.estado = 'gabarito';
      }
      res.hidden = false;
      res.textContent = !gab
        ? 'O INEP anulou esta questão: ela vale ponto para todos.'
        : `${certa ? 'Acertou.' : resp ? `Gabarito: ${gab}. Você marcou ${resp}.` : `Em branco. Gabarito: ${gab}.`} ${f.dataset.fonte}, habilidade ${f.dataset.hab}.${chute ? ' Marcada como chute.' : ''}`;

      if (certa) certas++;
      else {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${qid}`;
        link.textContent = `Questão ${num}`;
        const det = document.createElement('span');
        det.textContent = ` · gabarito ${gab}, ${resp ? `você marcou ${resp}` : 'em branco'} · ${f.dataset.hab}${chute ? ' · chute' : ''}`;
        li.append(link, det);
        lista.append(li);
      }
      if (!resp) brancas++;
      if (chute) {
        chutes++;
        chutados.push(num);
        if (certa) chutesCertos++;
      }
      linhas.push(num + (resp || '-'));
    }
    if (!lista.children.length) {
      const li = document.createElement('li');
      li.textContent = 'Nenhum erro. Pode partir para a próxima lista.';
      lista.append(li);
    }

    const total = fichas.length;
    estado.nota = { c: certas, t: total };
    nota.textContent = `${certas} de ${total} certas`;
    notaSub.textContent =
      `${Math.round((certas / total) * 100)}% · ${brancas} em branco · ${chutesCertos} de ${chutes} chutes certos · ` +
      `tempo ${relogio(decorrido(estado))}`;
    return {
      texto:
        `${raiz!.dataset.titulo}\nTempo usado: ${Math.round(decorrido(estado) / 60)} min\n` +
        `Respostas: ${linhas.join(' ')}\nChutes: ${chutados.join(', ') || 'nenhum'}`,
    };
  }

  function entregar(rolar: boolean) {
    estado.fim = estado.fim || estado.pa || Date.now();
    clearInterval(relogioId);
    btnPausar.hidden = true;
    pintar();
    let texto: string;
    if (ehRedacao) {
      const escrito = folha?.value ?? '';
      nota.textContent = `${palavras(escrito)} palavras`;
      notaSub.textContent = `Tempo ${relogio(decorrido(estado))} de ${relogio(limite)}`;
      texto = `${raiz!.dataset.titulo}\nTempo usado: ${Math.round(decorrido(estado) / 60)} min\n\n${escrito}`;
    } else texto = corrigir().texto;
    salvar();
    copia.value = texto;
    resultado.hidden = false;
    if (rolar) {
      resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultado.focus({ preventScroll: true });
    }
  }

  q('[data-finalizar]').addEventListener('click', async () => {
    const brancas = ehRedacao ? (folha?.value.trim() ? 0 : 1) : fichas.filter((f) => !estado.r[f.dataset.q!]).length;
    if (brancas) {
      const { ok } = await confirmarAcao(
        ehRedacao
          ? { titulo: 'Entregar sem texto?', texto: 'A folha está vazia.', confirmar: 'Entregar assim' }
          : {
              titulo: 'Entregar com questões em branco?',
              texto: `${brancas} ${brancas === 1 ? 'questão está' : 'questões estão'} sem resposta e ${brancas === 1 ? 'conta' : 'contam'} como erro.`,
              confirmar: 'Entregar assim',
            },
      );
      if (!ok) return;
    }
    entregar(true);
  });
  if (estado.fim) entregar(false);

  q('[data-copiar]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copia.value);
      toast('Copiado');
    } catch {
      copia.select();
      toast('Selecione e copie com Ctrl+C', 'circle-info');
    }
  });

  q('[data-refazer]').addEventListener('click', async () => {
    const { ok } = await confirmarAcao({
      titulo: 'Apagar e refazer?',
      texto: ehRedacao ? 'O texto, o cronômetro e o resultado desta redação são apagados.' : 'As respostas, o cronômetro e o resultado desta lista são apagados.',
      confirmar: 'Apagar tudo',
    });
    if (!ok) return;
    try {
      localStorage.removeItem(chave);
      if (ehRedacao) localStorage.removeItem(`cdt:redacao:${location.pathname}:${id}`);
    } catch {}
    location.reload();
  });
}

export function montarTreino() {
  montarHub();
  montarProva();
}
