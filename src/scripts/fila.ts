/* ---------------------------------------------------------------------------
 * A fila de revisão de hoje, calculada do índice de aulas, do que foi concluído e do registro.
 * Usada pela página /revisao, pelo bloco Hoje e por Meu estudo: um cálculo só.
 * ------------------------------------------------------------------------- */
import { diaLocal, montarFila } from '../lib/estudo';
import type { Fila } from '../lib/estudo';
import type { AulaBusca } from './busca';
import { vistas } from './progresso';
import { lerAjustes, lerRegistro } from './registro';

export function filaDeHoje(indice: AulaBusca[]): { fila: Fila; temConcluidas: boolean } {
  const feitas = vistas();
  const conclusoes: Record<string, number> = {};
  const cartoes: Record<string, number> = {};
  for (const a of indice) {
    if (a.k && feitas[a.id]) {
      conclusoes[a.id] = feitas[a.id];
      cartoes[a.id] = a.k;
    }
  }
  const fila = montarFila({
    eventos: lerRegistro().eventos,
    conclusoes,
    cartoes,
    hoje: diaLocal(Date.now()),
    limite: lerAjustes().fila,
  });
  return { fila, temConcluidas: Object.keys(conclusoes).length > 0 };
}
