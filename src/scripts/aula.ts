/* ---------------------------------------------------------------------------
 * Marcação automática da aula aberta: andamento de leitura e questões.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';
import { CHAVE_ANDAMENTO, andamentos, percentualDaAula, vistas, marcar, refletirProgresso, semConclusaoAutomatica } from './progresso';
import type { Andamento } from './progresso';
import { gravar } from './util';

let limpezaAulaAtual: AbortController | null = null;

/** Mede o andamento da aula aberta: quanto da leitura já foi vista (até o começo das questões,
 *  ou o fim do texto se não houver questões) e se as questões foram respondidas. Com isso a
 *  aula conclui sozinha; só ler não basta quando há questões. O que fica salvo alimenta o anel
 *  em volta do número da aula nas listas. */
export function ligarAulaAtual() {
  limpezaAulaAtual?.abort();
  limpezaAulaAtual = new AbortController();
  const { signal } = limpezaAulaAtual;

  const marcador = document.querySelector<HTMLElement>('[data-acao="marcar-aula"]');
  if (!marcador) return;
  const id = marcador.dataset.aula!;

  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  if (!artigo) return;

  const atual: Andamento = andamentos()[id] ?? { l: 0, q: 0, z: 0 };
  let mudou = false;

  const salvar = () => {
    if (!mudou) return;
    mudou = false;
    atual.t = Date.now();
    const todos = andamentos();
    todos[id] = atual;
    gravar(CHAVE_ANDAMENTO, todos);
    if (!vistas()[id] && !semConclusaoAutomatica.has(id) && percentualDaAula(atual) >= 100) {
      marcar(id, true);
      toast('Aula concluída', 'circle-check');
    }
    refletirProgresso();
  };

  const medirLeitura = () => {
    const quiz = artigo.querySelector('.quiz');
    if (quiz && !atual.z) {
      atual.z = 1;
      mudou = true;
    }
    // O quiz mora dentro de um <details> que pode estar recolhido (sem caixa): o ponto de medida
    // é o cabeçalho dele, que sempre tem posição.
    const ancora = quiz ? (quiz.closest('details') ?? quiz) : null;
    const topo = artigo.getBoundingClientRect().top + window.scrollY;
    const fim = (ancora ?? artigo).getBoundingClientRect()[ancora ? 'top' : 'bottom'] + window.scrollY;
    const alcance = window.scrollY + window.innerHeight;
    const fracao = Math.min(1, Math.max(0, (alcance - topo) / Math.max(1, fim - topo)));
    const l = Math.round(fracao * 100);
    if (l > atual.l) {
      atual.l = l;
      mudou = true;
    }
  };

  let agendado = false;
  const aoMudar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      medirLeitura();
      salvar();
    });
  };

  window.addEventListener('scroll', aoMudar, { passive: true, signal });
  window.addEventListener('resize', aoMudar, { signal });
  document.addEventListener(
    'cdt:questoes',
    (e) => {
      const { respondidas, total } = (e as CustomEvent<{ respondidas: number; total: number }>).detail;
      if (total > 0 && !atual.z) {
        atual.z = 1;
        mudou = true;
      }
      // Só sobe: refazer as questões não tira o que já foi conquistado.
      if (total > 0 && respondidas >= total && !atual.q) {
        atual.q = 1;
        mudou = true;
      }
      salvar();
    },
    { signal }
  );

  // Primeira medida depois que o quiz e os tópicos foram montados.
  requestAnimationFrame(() => requestAnimationFrame(aoMudar));
}
