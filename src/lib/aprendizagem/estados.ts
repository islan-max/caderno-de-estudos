import { diaLocal, type Evento } from './eventos.ts';

export type EstadoConceito = 'nao-iniciado' | 'praticado' | 'precisa-revisar' | 'retido';

/**
 * Estado de um conceito, só pelas evidências vigentes.
 * - precisa-revisar: o último resultado foi erro (prevalece sobre os demais);
 * - retido: desde o último erro, acertos em pelo menos dois dias diferentes;
 * - praticado: algum acerto;
 * - nao-iniciado: nenhuma evidência.
 * shortcut: "revisão em dia" não entra na conta; um cartão vencido não rebaixa o estado.
 */
export function estadoDoConceito(vigentesDoEstudante: Evento[], conceitoId: string): EstadoConceito {
  // "Com dificuldade" não é acerto nem erro: não muda o estado.
  const ACERTOS = ['acertou', 'lembrei'];
  const ERROS = ['errou', 'nao_lembrei'];
  const resultados = vigentesDoEstudante
    .filter((e) => e.resultado && e.conceitoIds.includes(conceitoId) && [...ACERTOS, ...ERROS].includes(e.resultado))
    .sort((a, b) => a.quando.localeCompare(b.quando));
  if (resultados.length === 0) return 'nao-iniciado';

  const ultimoErro = resultados.map((e) => ERROS.includes(e.resultado!)).lastIndexOf(true);
  if (ultimoErro === resultados.length - 1) return 'precisa-revisar';

  const acertosDesdeOErro = resultados.slice(ultimoErro + 1);
  const dias = new Set(acertosDesdeOErro.map(diaLocal));
  return dias.size >= 2 ? 'retido' : 'praticado';
}
