import { diaLocal, type Evento } from './eventos.ts';

export type EstadoConceito = 'nao-iniciado' | 'praticado' | 'precisa-revisar' | 'retido';

/**
 * Estado de um conceito, só pelas evidências vigentes.
 * - precisa-revisar: o último resultado foi erro (prevalece sobre os demais);
 * - retido: desde o último erro, acertos em pelo menos dois dias diferentes;
 * - praticado: algum acerto;
 * - nao-iniciado: nenhuma evidência.
 * shortcut: "revisão em dia" ainda não conta (não há cartões); entra na etapa 3.
 */
export function estadoDoConceito(vigentesDoEstudante: Evento[], conceitoId: string): EstadoConceito {
  const resultados = vigentesDoEstudante
    .filter((e) => e.resultado && e.conceitoIds.includes(conceitoId))
    .sort((a, b) => a.quando.localeCompare(b.quando));
  if (resultados.length === 0) return 'nao-iniciado';

  const ultimoErro = resultados.map((e) => e.resultado).lastIndexOf('errou');
  if (ultimoErro === resultados.length - 1) return 'precisa-revisar';

  const acertosDesdeOErro = resultados.slice(ultimoErro + 1);
  const dias = new Set(acertosDesdeOErro.map(diaLocal));
  return dias.size >= 2 ? 'retido' : 'praticado';
}
