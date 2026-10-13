/* ---------------------------------------------------------------------------
 * Bloco "Hoje" da página inicial: até três ações, cada uma com o motivo.
 *
 * Nada é guardado como plano. A lista é recalculada a cada visita do que o registro e o
 * progresso já dizem (sugestoesDeHoje em src/lib/estudo.ts). "Agora não" esconde a ação por
 * uma hora; depois disso ela volta se ainda fizer sentido. Os ajustes (matérias em foco e tamanho
 * da revisão) moram na página /ajustes.
 * ------------------------------------------------------------------------- */
import type { Sugestao } from '../lib/estudo';
import { carregarIndice } from './busca';
import { dispensarPorUmaHora, dispensasDoHoje, lerAjustes, limparDispensas, retornoDasDispensas } from './registro';
import { sugestoesAtuais } from './sugestoes';
import { escapar } from './util';

const ICONES: Record<Sugestao['tipo'], string> = {
  revisao: 'repeat',
  rever: 'arrows-rotate',
  continuar: 'play',
  proxima: 'route',
  comecar: 'compass',
};

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function montarHoje() {
  const bloco = document.querySelector<HTMLElement>('[data-hoje]');
  if (!bloco) return;
  const lista = bloco.querySelector<HTMLElement>('[data-hoje-lista]')!;
  const vazio = bloco.querySelector<HTMLElement>('[data-hoje-vazio]')!;
  const escondidasEl = bloco.querySelector<HTMLElement>('[data-hoje-escondidas]')!;
  const focoEl = bloco.querySelector<HTMLElement>('[data-hoje-foco]')!;
  const aviso = bloco.querySelector<HTMLElement>('[data-hoje-status]')!;
  const cabeca = bloco.querySelector<HTMLElement>('.hoje__cabeca')!;
  const resumo = bloco.querySelector<HTMLElement>('[data-hoje-resumo]')!;

  const indice = await carregarIndice();
  if (!bloco.isConnected || !indice.length) return;
  const nomeDaMateria = new Map(indice.map((a) => [a.s, a.m]));

  let volta = 0;

  /** Quando nada aparece, o motivo vira um cartão com saída: trazer de volta ou ir estudar. */
  function estadoVazio(escondidas: number, quando: number | null) {
    if (escondidas) {
      return `
        <span class="hoje__vazio-icone" aria-hidden="true"><i class="fa-solid fa-clock"></i></span>
        <div class="hoje__vazio-corpo">
          <p class="hoje__vazio-titulo">Sugestões escondidas por enquanto</p>
          <p class="hoje__vazio-texto">${escondidas === 1 ? 'A sugestão que você dispensou volta' : `As ${escondidas} sugestões que você dispensou voltam`}${quando ? ` às <strong>${hora(quando)}</strong>` : ''}, se ainda fizerem sentido.</p>
        </div>
        <button type="button" class="hoje__botao hoje__botao--principal" data-hoje-trazer>Trazer de volta agora</button>`;
    }
    return `
      <span class="hoje__vazio-icone hoje__vazio-icone--ok" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></span>
      <div class="hoje__vazio-corpo">
        <p class="hoje__vazio-titulo">Tudo em dia por aqui</p>
        <p class="hoje__vazio-texto">Não há nada pendente. Que tal abrir uma matéria na trilha ou sortear uma aula?</p>
      </div>
      <button type="button" class="hoje__botao hoje__botao--principal" data-acao="sortear"><i class="fa-solid fa-dice" aria-hidden="true"></i> Sortear aula</button>`;
  }

  function desenhar() {
    const ajustes = lerAjustes();
    window.clearTimeout(volta);
    // Quem desligou o Hoje (ou todos os tipos) em /ajustes não o vê na página inicial.
    if (!ajustes.hoje.mostrar || !(ajustes.hoje.revisao || ajustes.hoje.rever || ajustes.hoje.aula)) {
      bloco.hidden = true;
      return;
    }
    const escondidas = Object.keys(dispensasDoHoje()).length;
    const quando = retornoDasDispensas();
    const sugestoes = sugestoesAtuais(indice, ajustes);

    lista.innerHTML = sugestoes
      .map(
        (s) => `
      <li class="hoje__item" data-tipo="${s.tipo}">
        <span class="hoje__icone" aria-hidden="true"><i class="fa-solid fa-${ICONES[s.tipo]}"></i></span>
        <div class="hoje__corpo">
          <p class="hoje__acao">${escapar(s.titulo)}</p>
          <p class="hoje__motivo">${escapar(s.motivo)}</p>
        </div>
        <div class="hoje__botoes">
          <a class="hoje__botao hoje__botao--principal" href="${escapar(s.href)}">${escapar(s.acao)}<span class="apenas-leitor">: ${escapar(s.titulo)}</span></a>
          <button type="button" class="hoje__botao" data-hoje-dispensar="${escapar(s.id)}">Agora não<span class="apenas-leitor">: ${escapar(s.titulo)}</span></button>
        </div>
      </li>`
      )
      .join('');

    vazio.hidden = sugestoes.length > 0;
    vazio.innerHTML = sugestoes.length ? '' : estadoVazio(escondidas, quando);

    // Com sugestões à vista e outras escondidas: uma linha avisa e dá o jeito de trazer de volta.
    const avisaEscondidas = sugestoes.length > 0 && escondidas > 0;
    escondidasEl.hidden = !avisaEscondidas;
    escondidasEl.innerHTML = avisaEscondidas
      ? `<span><i class="fa-solid fa-clock" aria-hidden="true"></i> ${escondidas === 1 ? '1 sugestão escondida' : `${escondidas} sugestões escondidas`}${quando ? ` · ${escondidas === 1 ? 'volta' : 'voltam'} às ${hora(quando)}` : ''}</span>
         <button type="button" class="hoje__link-botao" data-hoje-trazer>Trazer de volta</button>`
      : '';

    // Matérias em foco: quem escolheu vê o que está valendo, com o caminho para mudar.
    const emFoco = ajustes.foco.map((s) => nomeDaMateria.get(s)).filter(Boolean) as string[];
    focoEl.hidden = !emFoco.length;
    focoEl.innerHTML = emFoco.length
      ? `<span class="hoje__foco-rotulo">Em foco</span>${emFoco.map((n) => `<span class="hoje__foco-chip">${escapar(n)}</span>`).join('')}`
      : '';

    // Ao lado do título, só o aviso de que há sugestões escondidas (por 1 hora).
    resumo.textContent = escondidas ? 'escondidas por 1 hora' : '';
    resumo.hidden = !escondidas;
    bloco.hidden = false;

    // "Agora não" vale uma hora: redesenha na hora em que a primeira ação dispensada volta.
    window.clearTimeout(volta);
    if (quando !== null) volta = window.setTimeout(desenhar, Math.max(1000, quando - Date.now() + 500));
  }

  bloco.addEventListener('click', (e) => {
    const alvo = e.target as HTMLElement;
    const dispensar = alvo.closest<HTMLElement>('[data-hoje-dispensar]');
    if (dispensar) {
      dispensarPorUmaHora(dispensar.dataset.hojeDispensar!);
      desenhar();
      aviso.textContent = '';
      window.setTimeout(() => (aviso.textContent = 'Sugestão dispensada. Ela volta em 1 hora.'), 30);
      // O botão clicado saiu da página: o foco volta para o cabeçalho do bloco.
      cabeca.focus();
      return;
    }
    if (alvo.closest('[data-hoje-trazer]')) {
      limparDispensas();
      desenhar();
      aviso.textContent = '';
      window.setTimeout(() => (aviso.textContent = 'As sugestões voltaram.'), 30);
      cabeca.focus();
    }
  });

  desenhar();
}
