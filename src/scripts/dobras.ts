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
}
