/* ---------------------------------------------------------------------------
 * Página inicial: "continuar de onde parou" e sorteio.
 * ------------------------------------------------------------------------- */
import { carregarIndice } from './busca';
import type { AulaBusca } from './busca';
import { CHAVE_ULTIMA, andamentos, percentualDaAula, vistas } from './progresso';
import type { Ultima } from './progresso';
import { ler, escapar } from './util';

export function montarHub() {
  const hub = document.querySelector('[data-hub]');
  if (!hub) return;

  // "Continuar de onde parou": o título é a aula em que a pessoa parou; a linha de baixo, menor,
  // diz qual aula vem a seguir (a próxima ainda não vista da matéria). A seta leva para onde
  // continuar: a própria aula, se ainda não foi concluída, ou a recomendada.
  const ultima = ler<Ultima>(CHAVE_ULTIMA, {});
  const bloco = hub.querySelector<HTMLElement>('[data-continuar]');
  if (bloco && ultima.href && ultima.titulo) {
    const materia = ultima.materia ?? 'ENEM';
    const parou = bloco.querySelector<HTMLAnchorElement>('[data-continuar-parou]')!;
    const rotulo = bloco.querySelector<HTMLElement>('[data-continuar-rotulo]')!;
    const proxima = bloco.querySelector<HTMLAnchorElement>('[data-continuar-proxima]')!;
    const seta = bloco.querySelector<HTMLAnchorElement>('[data-continuar-seta]')!;

    parou.href = ultima.href;
    parou.textContent = ultima.titulo;
    // O cartão leva a cor da matéria em que a pessoa parou (id: "enem/<matéria>/<tema>").
    const slugMateria = ultima.id?.split('/')[1];
    if (slugMateria) bloco.style.setProperty('--cor-continuar', `var(--color-${slugMateria})`);

    /** Define a linha de baixo: texto simples ou texto + link da aula recomendada. */
    const sugerir = (texto: string, destino?: { href: string; titulo: string }) => {
      rotulo.textContent = texto;
      proxima.hidden = !destino;
      if (destino) {
        proxima.href = destino.href;
        proxima.textContent = destino.titulo;
      }
      seta.href = destino?.href ?? ultima.href;
      seta.setAttribute('aria-label', `Continuar: ${destino?.titulo ?? ultima.titulo}`);
      bloco.hidden = false;
    };

    if (!ultima.id || !vistas()[ultima.id]) {
      sugerir(`Você parou aqui, em ${materia}. Continue de onde parou.`);
    } else {
      // Já concluída: enquanto o índice carrega, vale reler; depois aparece a aula recomendada.
      sugerir(`Você terminou esta aula, de ${materia}.`);
      carregarIndice().then((dados) => {
        const p = vistas();
        const i = dados.findIndex((a) => a.id === ultima.id);
        if (i < 0) return;
        const slug = dados[i].s;
        const naMateria = (a: AulaBusca) => a.s === slug && !p[a.id];
        const seguinte = dados.slice(i + 1).find(naMateria) ?? dados.find(naMateria);
        if (seguinte) {
          sugerir('Próxima aula:', { href: seguinte.h, titulo: `${seguinte.t} (${seguinte.m})` });
          return;
        }
        const outra = dados.find((a) => !p[a.id]);
        if (outra) {
          sugerir(`Você concluiu ${dados[i].m}. Sugestão:`, { href: outra.h, titulo: `${outra.t} (${outra.m})` });
        } else {
          sugerir('Você já viu todas as aulas do caderno.');
        }
      });
    }
  }


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
