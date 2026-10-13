/* ---------------------------------------------------------------------------
 * Blocos retráteis e o estado deles.
 * ------------------------------------------------------------------------- */
import { ler, gravar } from './util';

const CHAVE_DOBRAS = 'cdt:dobras';

export function ligarDobras() {
  const dobras = ler<Record<string, boolean>>(CHAVE_DOBRAS, {});
  document.querySelectorAll<HTMLDetailsElement>('details[data-dobra]').forEach((el) => {
    const chave = el.dataset.dobra!;
    if (chave in dobras) el.open = dobras[chave];
    el.addEventListener('toggle', () => {
      const atual = ler<Record<string, boolean>>(CHAVE_DOBRAS, {});
      atual[chave] = el.open;
      gravar(CHAVE_DOBRAS, atual);
    });
  });

  ligarDobrasEmGrupo();
}

/** Âncora (#2-bimestre) abre a dobra de destino; o botão [data-dobras-todas] abre ou fecha as do grupo. */
function ligarDobrasEmGrupo() {
  const alvo = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (alvo instanceof HTMLDetailsElement) alvo.open = true;

  document.querySelectorAll<HTMLButtonElement>('button[data-dobras-todas]').forEach((botao) => {
    const grupo = document.querySelector(`[data-dobras-grupo="${botao.dataset.dobrasTodas}"]`);
    const dobras = [...(grupo?.querySelectorAll<HTMLDetailsElement>(':scope > details') ?? [])];
    const rotular = () => {
      botao.textContent = dobras.every((d) => d.open) ? 'Recolher todos' : 'Expandir todos';
    };
    dobras.forEach((d) => d.addEventListener('toggle', rotular));
    botao.addEventListener('click', () => {
      const abrir = !dobras.every((d) => d.open);
      dobras.forEach((d) => (d.open = abrir));
    });
    rotular();
  });
}
