/* ---------------------------------------------------------------------------
 * Registro de estudo no navegador: o que foi respondido, revisado e estudado fora do site.
 * As regras (estados, fila, sugestões) ficam em src/lib/estudo.ts; aqui só se lê e grava.
 * ------------------------------------------------------------------------- */
import { DISPENSA_MS, FILA_MAX, FILA_MIN, LIMITES_FILA, dispensasAtivas, limparFoco, normalizarMetas, normalizarRegistro, proximoRetorno, semEvento } from '../lib/estudo.ts';
import type { Dispensas, Metas } from '../lib/estudo.ts';
import { normalizarPreferencias } from '../lib/recomendacao.ts';
import type { Preferencias } from '../lib/recomendacao.ts';
import type { Evento, Registro } from '../lib/estudo.ts';
import { gravar, ler } from './util.ts';

export const CHAVE_REGISTRO = 'cdt:registro';
export const CHAVE_AJUSTES = 'cdt:ajustes';
export const CHAVE_DISPENSADOS_HOJE = 'cdt:hoje-dispensado';
export const CHAVE_METAS = 'cdt:metas';
export const CHAVE_RECOMENDACAO = 'cdt:recomendacao';

export function lerPreferencias(): Preferencias {
  return normalizarPreferencias(ler<unknown>(CHAVE_RECOMENDACAO, null));
}

export function gravarPreferencias(prefs: Preferencias): boolean {
  return gravar(CHAVE_RECOMENDACAO, normalizarPreferencias(prefs));
}

export function lerMetas(): Metas {
  return normalizarMetas(ler<unknown>(CHAVE_METAS, null));
}

export function gravarMetas(metas: Metas): boolean {
  return gravar(CHAVE_METAS, normalizarMetas(metas));
}

export function lerRegistro(): Registro {
  return normalizarRegistro(ler<unknown>(CHAVE_REGISTRO, null));
}

export function gravarRegistro(reg: Registro): boolean {
  return gravar(CHAVE_REGISTRO, reg);
}

/** O evento sem `id` e `t`, que são gerados aqui (distribui sobre a união). */
type SemIdT<E> = E extends Evento ? Omit<E, 'id' | 't'> : never;
type NovoEvento = SemIdT<Evento>;

export function registrar(novo: NovoEvento): boolean {
  const t = Date.now();
  const evento = { ...novo, id: t.toString(36) + Math.random().toString(36).slice(2, 7), t } as Evento;
  const reg = lerRegistro();
  reg.eventos.push(evento);
  const ok = gravarRegistro(reg);
  // Quem mostra algo calculado do registro (aviso da aula) se atualiza na hora.
  if (ok && typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('cdt:registro'));
  return ok;
}

export function apagarEvento(id: string): boolean {
  const ok = gravarRegistro(semEvento(lerRegistro(), id));
  if (ok && typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('cdt:registro'));
  return ok;
}

/* ---------------------------------------------------------------- ajustes */

export interface Ajustes {
  /** Matérias em foco ("enem/fisica"): até 3 do ENEM, 1 do Escolar e 2 do DS, cada categoria à parte. */
  foco: string[];
  /** Cartões por dia na revisão (FILA_MIN a FILA_MAX). */
  fila: number;
  /** O que o Hoje mostra na página inicial: o bloco todo e cada tipo de sugestão. */
  hoje: { mostrar: boolean; revisao: boolean; rever: boolean; aula: boolean };
}

/** Antes a revisão era "curta", "média" ou "longa": o que estava salvo continua valendo. */
const FILA_ANTIGA: Record<string, number> = { curta: LIMITES_FILA.curta, media: LIMITES_FILA.media, longa: LIMITES_FILA.longa };

export function lerAjustes(): Ajustes {
  const a = ler<Partial<Omit<Ajustes, 'fila'>> & { fila?: unknown }>(CHAVE_AJUSTES, {});
  const fila = typeof a.fila === 'string' ? FILA_ANTIGA[a.fila] : a.fila;
  const h: Partial<Ajustes['hoje']> = a.hoje && typeof a.hoje === 'object' ? a.hoje : {};
  return {
    foco: Array.isArray(a.foco) ? limparFoco(a.foco.filter((s) => typeof s === 'string')) : [],
    fila: typeof fila === 'number' && Number.isFinite(fila) ? Math.min(FILA_MAX, Math.max(FILA_MIN, Math.round(fila))) : LIMITES_FILA.media,
    hoje: { mostrar: h.mostrar !== false, revisao: h.revisao !== false, rever: h.rever !== false, aula: h.aula !== false },
  };
}

export function gravarAjustes(a: Ajustes): boolean {
  return gravar(CHAVE_AJUSTES, a);
}

/* ------------------------------------------------ "Agora não" do bloco Hoje */

/** Ações dispensadas que ainda não voltaram (id → quando volta). Dispensar não pune nem acumula. */
export function dispensasDoHoje(): Dispensas {
  return dispensasAtivas(ler<unknown>(CHAVE_DISPENSADOS_HOJE, {}), Date.now());
}

/** Esconde a ação por uma hora, a contar de agora. */
export function dispensarPorUmaHora(id: string) {
  gravar(CHAVE_DISPENSADOS_HOJE, { ...dispensasDoHoje(), [id]: Date.now() + DISPENSA_MS });
}

/** Quando a primeira ação dispensada volta (ms), ou null. */
export function retornoDasDispensas(): number | null {
  return proximoRetorno(dispensasDoHoje());
}

/** Usado ao zerar o progresso: apaga o histórico de respostas e revisões e os "agora não" do dia. */
export function apagarRegistro() {
  try {
    localStorage.removeItem(CHAVE_REGISTRO);
    localStorage.removeItem(CHAVE_DISPENSADOS_HOJE);
  } catch {}
}

/** "Trazer de volta": as sugestões escondidas voltam agora. */
export function limparDispensas() {
  try {
    localStorage.removeItem(CHAVE_DISPENSADOS_HOJE);
  } catch {}
}
