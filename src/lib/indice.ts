// Índice das aulas que existem nas três abas (ENEM, Escolar e DS): alimenta a busca, o "sortear",
// o "continuar de onde parou" e o painel de progresso. Aula só do mapa (ainda não escrita)
// não entra: não há onde levar a pessoa.
import { indiceEnem } from './aulas';
import { materiasDs } from './dsMapa';
import { materiasEscolar } from './escolar';
import { iconeDaMateriaSecao, type MateriaTrilha } from './materiasSecoes';
import { SECOES_VISIVEIS, secao, type ChaveSecao } from './secoes';

export interface AulaGeral {
  /** Identificador no progresso local: "enem/fisica/optica", "ds/back-end/4-bimestre/aula-1-…". */
  id: string;
  secao: ChaveSecao;
  materia: string;
  materiaLabel: string;
  titulo: string;
  href: string;
  /** Rótulo do grupo no painel de progresso e na busca: a área do ENEM ou o nome da aba. */
  grupo: string;
  grupoCor: string;
  icone: string;
}

function dasTrilhas(chave: 'ds' | 'escolar', materias: MateriaTrilha[]): AulaGeral[] {
  const s = secao(chave);
  return materias.flatMap((m) =>
    m.bimestres.flatMap((b) =>
      b.aulas
        .filter((a) => a.pronta)
        .map((a) => ({
          id: a.id,
          secao: chave,
          materia: m.slug,
          materiaLabel: m.nome,
          titulo: a.titulo,
          href: a.href,
          grupo: s.label,
          grupoCor: s.cor,
          icone: iconeDaMateriaSecao(m.slug),
        }))
    )
  );
}

let cache: AulaGeral[] | null = null;

export async function indiceGeral(): Promise<AulaGeral[]> {
  if (cache) return cache;
  const visivel = (c: ChaveSecao) => SECOES_VISIVEIS.some((s) => s.chave === c);
  const lista: AulaGeral[] = [];
  if (visivel('enem')) {
    for (const a of await indiceEnem()) {
      lista.push({
        id: a.id,
        secao: 'enem',
        materia: a.materia,
        materiaLabel: a.materiaLabel,
        titulo: a.titulo,
        href: a.href,
        grupo: a.areaCurto,
        grupoCor: a.areaCor,
        icone: a.icone,
      });
    }
  }
  if (visivel('escolar')) lista.push(...dasTrilhas('escolar', await materiasEscolar()));
  if (visivel('ds')) lista.push(...dasTrilhas('ds', await materiasDs()));
  cache = lista;
  return lista;
}
