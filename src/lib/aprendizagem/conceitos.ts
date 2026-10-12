/** Conceitos têm id estável `<matéria>/<conceito>`, cadastrado em src/data/conceitos.json. */
export type RegistroDeConceitos = Record<string, { nome: string }>;

const FORMATO = /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/;

/** Ids fora do formato ou ausentes do registro. */
export function conceitosInvalidos(ids: string[], registro: RegistroDeConceitos): string[] {
  return ids.filter((id) => !FORMATO.test(id) || !(id in registro));
}
