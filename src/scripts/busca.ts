/* ---------------------------------------------------------------------------
 * Índice de aulas e a paleta de busca (Ctrl/⌘ + K).
 * ------------------------------------------------------------------------- */
import { vistas } from './progresso';
import { normalizar, escapar, base } from './util';

export interface AulaBusca {
  id: string;
  t: string;
  m: string;
  /** aba e matéria: "enem/fisica" (a mesma matéria pode existir em mais de uma aba) */
  s: string;
  a: string;
  h: string;
  i: string;
  c: string;
}

let indice: AulaBusca[] | null = null;

let carregando: Promise<AulaBusca[]> | null = null;

export function carregarIndice(): Promise<AulaBusca[]> {
  if (indice) return Promise.resolve(indice);
  if (carregando) return carregando;
  carregando = fetch(`${base()}aulas.json`.replace(/\/{2,}/g, '/'))
    .then((r) => r.json())
    .then((dados: AulaBusca[]) => {
      indice = dados;
      return dados;
    })
    .catch(() => {
      carregando = null;
      return [];
    });
  return carregando;
}

export function abrirBusca(termoInicial = '') {
  const dialogo = document.getElementById('busca') as HTMLDialogElement | null;
  if (!dialogo) return;
  const campo = dialogo.querySelector<HTMLInputElement>('[data-busca-campo]')!;
  if (!dialogo.open) dialogo.showModal();
  campo.value = termoInicial;
  campo.focus();
  campo.select();
  carregarIndice().then(() => filtrarBusca());
}

export function fecharBusca() {
  (document.getElementById('busca') as HTMLDialogElement | null)?.close();
}

export function filtrarBusca() {
  const dialogo = document.getElementById('busca') as HTMLDialogElement | null;
  if (!dialogo) return;
  const campo = dialogo.querySelector<HTMLInputElement>('[data-busca-campo]')!;
  const lista = dialogo.querySelector<HTMLElement>('[data-busca-lista]')!;
  const vazio = dialogo.querySelector<HTMLElement>('[data-busca-vazio]')!;
  const contador = dialogo.querySelector<HTMLElement>('[data-busca-contador]');

  const termo = normalizar(campo.value.trim());
  const dados = indice ?? [];
  const p = vistas();

  const resultados = (
    termo
      ? dados.filter((a) => normalizar(`${a.t} ${a.m} ${a.a}`).includes(termo))
      : dados.filter((a) => !p[a.id]) // sem termo: sugere o que ainda falta ver
  ).slice(0, 40);

  lista.innerHTML = resultados
    .map(
      (a, i) => `
      <li role="presentation">
        <a class="busca-item" id="busca-item-${i}" role="option" aria-selected="false" tabindex="-1"
           href="${a.h}" data-indice="${i}" data-vista="${Boolean(p[a.id])}">
          <i class="fa-solid fa-${a.i} fa-duo busca-item__icone" aria-hidden="true"></i>
          <span class="busca-item__texto">
            <span class="busca-item__titulo">${escapar(a.t)}</span>
            <span class="busca-item__meta">${escapar(a.m)} · ${escapar(a.a)}${p[a.id] ? '<span class="apenas-leitor"> · aula já vista</span>' : ''}</span>
          </span>
          <i class="fa-solid fa-${p[a.id] ? 'circle-check' : 'arrow-right'} busca-item__marca" aria-hidden="true"></i>
        </a>
      </li>`
    )
    .join('');

  vazio.hidden = resultados.length > 0;
  if (!resultados.length) campo.removeAttribute('aria-activedescendant');
  if (contador) {
    contador.textContent = termo
      ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`
      : 'Sugestões do que ainda falta ver';
  }
  destacarBusca(0);
}

function destacarBusca(indiceAlvo: number) {
  const itens = document.querySelectorAll<HTMLElement>('#busca .busca-item');
  if (!itens.length) return;
  const alvo = (indiceAlvo + itens.length) % itens.length;
  itens.forEach((el, i) => {
    el.setAttribute('data-ativo', String(i === alvo));
    el.setAttribute('aria-selected', String(i === alvo));
  });
  // O foco fica no campo; o leitor de tela acompanha o destaque por aqui.
  document.querySelector('#busca [data-busca-campo]')?.setAttribute('aria-activedescendant', itens[alvo].id);
  itens[alvo].scrollIntoView({ block: 'nearest' });
}

export function moverBusca(delta: number) {
  const itens = [...document.querySelectorAll<HTMLElement>('#busca .busca-item')];
  if (!itens.length) return;
  const atual = itens.findIndex((el) => el.dataset.ativo === 'true');
  destacarBusca((atual < 0 ? 0 : atual) + delta);
}
