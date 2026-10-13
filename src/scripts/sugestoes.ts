/* ---------------------------------------------------------------------------
 * As sugestões do Hoje, calculadas do registro, do progresso e dos ajustes. Usado pelo bloco da
 * página inicial (hoje.ts) e pela prévia da página de ajustes (ajustes.ts): um cálculo só.
 * ------------------------------------------------------------------------- */
import { sugestoesDeHoje } from '../lib/estudo';
import type { AulaIdx, Sugestao } from '../lib/estudo';
import { u } from '../lib/url';
import type { AulaBusca } from './busca';
import { filaDeHoje } from './fila';
import { andamentos, vistas } from './progresso';
import { dispensasDoHoje, lerRegistro } from './registro';
import type { Ajustes } from './registro';

/** Os três tipos que a pessoa liga e desliga: a aula (continuar, próxima ou começar) conta como um só. */
export type TipoHoje = 'revisao' | 'rever' | 'aula';
export const tipoDeHoje = (s: Sugestao): TipoHoje => (s.tipo === 'revisao' || s.tipo === 'rever' ? s.tipo : 'aula');

/** `todosOsTipos`: a página de ajustes quer ver também o que está desligado. */
export function sugestoesAtuais(indice: AulaBusca[], ajustes: Ajustes, ignorarDispensas = false, todosOsTipos = false): Sugestao[] {
  const aulas: AulaIdx[] = indice.map((a) => ({ id: a.id, t: a.t, m: a.m, s: a.s, h: a.h }));
  const todas = sugestoesDeHoje({
    eventos: lerRegistro().eventos,
    vistas: vistas(),
    andamentos: andamentos(),
    aulas,
    fila: filaDeHoje(indice).fila,
    dispensados: ignorarDispensas ? [] : Object.keys(dispensasDoHoje()),
    foco: ajustes.foco,
    agora: Date.now(),
    hrefRevisao: u('/revisao'),
  });
  return todosOsTipos ? todas : todas.filter((s) => ajustes.hoje[tipoDeHoje(s)]);
}
