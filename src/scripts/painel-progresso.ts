/* ---------------------------------------------------------------------------
 * Painel de progresso geral.
 * ------------------------------------------------------------------------- */
import { carregarIndice } from './busca';
import { vistas } from './progresso';
import { escapar, movimentoReduzido } from './util';

export function montarProgresso() {
  const alvo = document.querySelector<HTMLElement>('[data-painel-progresso]');
  if (!alvo) return;

  carregarIndice().then((dados) => {
    if (!dados.length) {
      alvo.innerHTML = '<p class="painel__carregando">Não foi possível carregar o índice de aulas.</p>';
      return;
    }

    const p = vistas();
    const feitas = dados.filter((a) => p[a.id]).length;
    const pct = Math.round((feitas / dados.length) * 100);

    // Agrupa por área, preservando a ordem em que as áreas aparecem no índice.
    const areas = new Map<string, { total: number; feitas: number; cor: string }>();
    for (const a of dados) {
      const linha = areas.get(a.a) ?? { total: 0, feitas: 0, cor: a.c };
      linha.total += 1;
      if (p[a.id]) linha.feitas += 1;
      areas.set(a.a, linha);
    }

    const frase =
      pct === 0
        ? 'Comece por onde quiser — o caderno guarda o resto.'
        : pct === 100
          ? 'Caderno inteiro revisado. Respeito.'
          : `Faltam ${dados.length - feitas} ${dados.length - feitas === 1 ? 'aula' : 'aulas'} para fechar o caderno.`;

    alvo.innerHTML = `
      <div class="prog-resumo">
        <div class="prog-anel">
          <circle-progress class="prog-anel__arco" value="0" max="100" text-format="none" aria-hidden="true"></circle-progress>
          <span>0%</span>
        </div>
        <div class="prog-resumo__texto">
          <strong>${feitas} de ${dados.length} aulas vistas</strong>
          <span>${escapar(frase)}</span>
        </div>
      </div>
      <ul class="prog-lista">
        ${[...areas.entries()]
          .map(
            ([nome, l]) => `
          <li class="prog-linha">
            <span class="prog-linha__nome">${escapar(nome)}</span>
            <span class="prog-linha__num">${l.feitas}/${l.total}</span>
            <span class="prog-barra" role="progressbar" aria-label="${escapar(nome)}"
                  aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((l.feitas / l.total) * 100)}">
              <i style="--cor: ${l.cor}" data-largura="${(l.feitas / l.total) * 100}"></i>
            </span>
          </li>`
          )
          .join('')}
      </ul>`;

    // Anima os valores no frame seguinte, para as transições valerem.
    requestAnimationFrame(() => {
      const anel = alvo.querySelector<HTMLElement>('.prog-anel');
      if (anel) {
        const arco = anel.querySelector('circle-progress');
        arco?.setAttribute('animation', movimentoReduzido() ? 'none' : 'easeOutCubic');
        arco?.setAttribute('animation-duration', '800');
        arco?.setAttribute('value', String(pct));
        anel.querySelector('span')!.textContent = `${pct}%`;
      }
      alvo.querySelectorAll<HTMLElement>('.prog-barra i').forEach((b) => {
        b.style.transform = `scaleX(${Number(b.dataset.largura) / 100})`;
      });
    });
  });
}
