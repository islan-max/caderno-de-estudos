/* ---------------------------------------------------------------------------
 * Atalhos de teclado e ações dos botões da barra de ferramentas.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';
import { carregarIndice, abrirBusca, fecharBusca, filtrarBusca, moverBusca } from './busca';
import { montarProgresso } from './painel-progresso';
import { aplicarFontePx, CHAVE_BRILHO, aplicarBrilho, CHAVE_FONTE_PX, dispensar, restaurarAcessibilidade, alternarA11y } from './preferencias';
import { CHAVE_ANDAMENTO, andamentos, vistas, marcar, refletirProgresso, zerarProgresso, semConclusaoAutomatica } from './progresso';
import { alternarTema } from './tema';
import { gravar, movimentoReduzido } from './util';

function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return (
    alvo.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
  );
}

/** Atalhos de UMA tecla (/, ← →) podem ser desligados no painel de acessibilidade
 *  (WCAG 2.1.4). Ctrl+K tem modificador e fica sempre ativo. */
function atalhosDeUmaTecla(): boolean {
  return document.documentElement.dataset.atalhos !== 'nao';
}

/** Com a página ampliada a ponto de rolar na horizontal, as setas ← → são de rolagem. */
function rolaNaHorizontal(): boolean {
  const raiz = document.documentElement;
  return raiz.scrollWidth > raiz.clientWidth + 1;
}

export function ligarAtalhos() {
  if ((window as any).__cdtAtalhos) return;
  (window as any).__cdtAtalhos = true;

  document.addEventListener('keydown', (e) => {
    const buscaAberta = (document.getElementById('busca') as HTMLDialogElement | null)?.open;

    // O atalho que abre a busca também a fecha.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (buscaAberta) fecharBusca();
      else abrirBusca();
      return;
    }

    if (buscaAberta) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moverBusca(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moverBusca(-1);
      } else if (e.key === 'Enter') {
        const ativo = document.querySelector<HTMLAnchorElement>('#busca .busca-item[data-ativo="true"]');
        if (ativo) {
          e.preventDefault();
          ativo.click();
        }
      }
      return;
    }

    if (e.defaultPrevented || ehCampoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!atalhosDeUmaTecla() || document.querySelector('dialog[open]')) return;

    if (e.key === '/') {
      e.preventDefault();
      abrirBusca();
    } else if (e.key === 'ArrowLeft' && !rolaNaHorizontal()) {
      // O pager do fim da aula (aula anterior) tem prioridade sobre o botão "voltar" do topo.
      (document.querySelector<HTMLAnchorElement>('.pager [data-pager="anterior"]') ??
        document.querySelector<HTMLAnchorElement>('[data-pager="anterior"]'))?.click();
    } else if (e.key === 'ArrowRight' && !rolaNaHorizontal()) {
      document.querySelector<HTMLAnchorElement>('[data-pager="proxima"]')?.click();
    }
  });

  // Delegação global: os botões são recriados a cada navegação.
  document.addEventListener('click', (e) => {
    const alvo = e.target;
    if (!(alvo instanceof Element)) return;

    const acao = alvo.closest<HTMLElement>('[data-acao]');
    if (acao) {
      switch (acao.dataset.acao) {
        case 'tema':
          alternarTema(acao);
          return;
        case 'restaurar-a11y':
          restaurarAcessibilidade();
          toast('Acessibilidade restaurada ao padrão', 'rotate-left');
          return;
        case 'acessibilidade':
        case 'texto': {
          const dlg = document.getElementById('acessibilidade');
          if (dlg instanceof HTMLDialogElement) dlg.showModal();
          return;
        }
        case 'busca':
          abrirBusca();
          return;
        case 'marcar-aula': {
          const id = acao.dataset.aula!;
          const virou = !vistas()[id];
          if (!virou) {
            // Desmarcou na mão: o andamento zera e a aula não se conclui sozinha de novo nesta visita.
            semConclusaoAutomatica.add(id);
            const t = andamentos();
            delete t[id];
            gravar(CHAVE_ANDAMENTO, t);
          }
          if (marcar(id, virou)) {
            refletirProgresso();
            toast(virou ? 'Aula marcada como vista' : 'Marcação removida', virou ? 'circle-check' : 'rotate-left');
          } else {
            toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
          }
          return;
        }
        case 'zerar-progresso':
          zerarProgresso();
          return;
        case 'sortear': {
          carregarIndice().then((dados) => {
            if (!dados.length) return;
            const p = vistas();
            const pool = dados.filter((a) => !p[a.id]);
            const escolhida = (pool.length ? pool : dados)[
              Math.floor(Math.random() * (pool.length ? pool.length : dados.length))
            ];
            toast(`Sorteado: ${escolhida.t}`, 'dice');
            window.setTimeout(() => (location.href = escolhida.h), 450);
          });
          return;
        }
        case 'topo':
          window.scrollTo({ top: 0, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
          // O botão some ao chegar no topo: o foco vai junto, para o teclado não se perder.
          document.querySelector<HTMLElement>('[data-marca]')?.focus({ preventScroll: true });
          return;
        case 'copiar-link': {
          navigator.clipboard
            ?.writeText(location.href)
            .then(() => toast('Link da aula copiado', 'copy'))
            .catch(() => toast('Não foi possível copiar', 'xmark'));
          return;
        }
      }
    }

    const x = alvo.closest<HTMLElement>('[data-dispensar]');
    const aviso = x?.closest<HTMLElement>('[data-dispensavel]');
    if (aviso) {
      dispensar(aviso.dataset.dispensavel!);
      return;
    }

    const chave = alvo.closest<HTMLElement>('[data-a11y]');
    if (chave) {
      alternarA11y(chave.dataset.a11y!);
      return;
    }

    // Painéis (progresso, ajuda) e diálogos.
    const gatilho = alvo.closest<HTMLElement>('[data-abre]');
    if (gatilho) {
      const dlg = document.getElementById(gatilho.dataset.abre!);
      if (dlg instanceof HTMLDialogElement) {
        dlg.showModal();
        if (dlg.id === 'progresso') montarProgresso();
      }
      return;
    }

    const fechar = alvo.closest<HTMLElement>('[data-fecha]');
    if (fechar) {
      fechar.closest('dialog')?.close();
      return;
    }

    // Clique no backdrop fecha o diálogo.
    if (alvo.tagName === 'DIALOG') (alvo as HTMLDialogElement).close();
  });

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target?.matches?.('[data-busca-campo]')) {
      filtrarBusca();
    } else if (target?.matches?.('[data-slider-fonte]')) {
      const slider = target as HTMLInputElement;
      const px = Number(slider.value);
      gravar(CHAVE_FONTE_PX, px);
      aplicarFontePx(px);
    } else if (target?.matches?.('[data-slider-brilho]')) {
      const pct = Number((target as HTMLInputElement).value);
      gravar(CHAVE_BRILHO, pct);
      aplicarBrilho(pct);
    }
  });
}
