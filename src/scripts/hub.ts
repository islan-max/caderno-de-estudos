/* ---------------------------------------------------------------------------
 * Página inicial: bloco Hoje e aulas vistas recentemente.
 * ------------------------------------------------------------------------- */
import { carregarIndice } from './busca';
import { montarHoje } from './hoje';
import { andamentos, percentualDaAula, vistas } from './progresso';
import { escapar } from './util';

export function montarHub() {
  const hub = document.querySelector('[data-hub]');
  if (!hub) return;

  void montarHoje();

  // Vistas recentemente: todas as aulas já vistas, da mais nova para a mais velha. A lista
  // rola dentro da caixa e a seção pode ser recolhida (details, guardado em ligarDobras).
  const secao = hub.querySelector<HTMLElement>('[data-recentes]');
  const lista = hub.querySelector<HTMLElement>('[data-recentes-lista]');
  if (!secao || !lista) return;

  const p = vistas();
  const and = andamentos();
  // Entram as aulas concluídas e as que já foram abertas e lidas em parte.
  const ids = [...new Set([...Object.keys(p), ...Object.keys(and).filter((id) => and[id].l > 0 || and[id].q)])];
  if (!ids.length) return;

  carregarIndice().then((dados) => {
    const porId = new Map(dados.map((a) => [a.id, a]));
    const quando = (id: string) => Math.max(p[id] ?? 0, and[id]?.t ?? 0);
    const recentes = ids
      .filter((id) => porId.has(id))
      .sort((a, b) => quando(b) - quando(a))
      .map((id) => porId.get(id)!);
    if (!recentes.length) return;

    const dica = secao.querySelector('.acordeao__dica');
    if (dica) {
      dica.textContent =
        `${recentes.length} ${recentes.length === 1 ? 'aula' : 'aulas'}, ` +
        'da mais recente para a mais antiga';
    }

    lista.innerHTML = recentes
      .map(
        (a) => `
      <li>
        <a class="busca-item" href="${a.h}" ${p[a.id] ? 'data-vista="true"' : ''}>
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}${p[a.id] ? '' : ` · ${percentualDaAula(and[a.id])}% feito`}</span>
          </span>
          ${p[a.id] ? '<i class="fa-solid fa-circle-check busca-item__marca" aria-hidden="true"></i>' : ''}
        </a>
      </li>`
      )
      .join('');
    secao.hidden = false;
  });
}
