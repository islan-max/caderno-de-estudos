import { diaLocal, type Evento } from './eventos.ts';

/** Toda métrica exibida precisa estar aqui. A interface mostra isso em "Como calculamos". */
export interface DefinicaoDeMetrica {
  nome: string;
  formula: string;
  naoMede: string;
  comoMelhorar: string;
}

export const METRICAS: Record<string, DefinicaoDeMetrica> = {
  'progresso-da-materia': {
    nome: 'Progresso da matéria',
    formula: 'aulas concluídas ÷ aulas publicadas. Aulas "Em breve" não entram na conta.',
    naoMede: 'Se você entendeu ou lembra do conteúdo.',
    comoMelhorar: 'Concluir a próxima aula da trilha.',
  },
  'dia-de-estudo': {
    nome: 'Dia de estudo',
    formula:
      'dia local com pelo menos uma aula concluída, questão respondida, cartão revisado ou estudo fora do site registrado. Abrir uma página não conta.',
    naoMede: 'Quanto tempo você estudou. Dia sem registro é ausência de dado, não zero estudo.',
    comoMelhorar: 'Responder uma questão ou concluir uma aula.',
  },
  'estado-do-conceito': {
    nome: 'Estado do conceito',
    formula:
      'Precisa revisar: o último resultado foi erro. Retido: desde o último erro, acertos em pelo menos dois dias diferentes. Praticado: algum acerto. Sem evidência: não iniciado.',
    naoMede: 'Domínio absoluto. É só o que as suas respostas mostram até agora.',
    comoMelhorar: 'Rever a seção indicada após um erro e responder de novo em outro dia.',
  },
  'diagnostico-do-conceito': {
    nome: 'O que ficou (diagnóstico do conceito)',
    formula:
      'Conta as suas respostas em questões oficiais e em cartões sobre o conceito. Menos de duas respostas: dados insuficientes. Último resultado foi erro: lacuna. Acertos em pelo menos dois dias diferentes desde o último erro: firme. Os demais casos: parcial.',
    naoMede: 'Uma nota. Não há porcentagem nem média: só o que as suas respostas mostram até agora.',
    comoMelhorar: 'Responder as questões da aula e revisar os cartões do conceito, em dias diferentes.',
  },
  'tempo-estimado': {
    nome: 'Tempo ativo estimado',
    formula:
      'Atividades com menos de 30 minutos entre elas formam uma sessão. Cada atividade conta até 5 minutos até a seguinte, e a última conta 1 minuto. Estudo fora do site conta os minutos que você informou.',
    naoMede: 'Aprendizado: tempo não significa compreensão. Também não mede a leitura entre uma atividade e outra.',
    comoMelhorar: 'Não é para melhorar: serve só como contexto. Se estiver errado, edite a duração da sessão.',
  },
  'revisao-vencida': {
    nome: 'Revisão vencida',
    formula: 'cartão já revisado cuja data de revisão é igual ou anterior a hoje. Cartão que nunca foi visto é novo, não vencido.',
    naoMede: 'Quanto você esqueceu.',
    comoMelhorar: 'Fazer a fila de revisão do dia.',
  },
};

export function progressoDaMateria(concluidas: number, publicadas: number): number {
  return publicadas === 0 ? 0 : Math.min(1, concluidas / publicadas);
}

/** Dias locais (ordenados) com conclusão, resposta ou revisão. */
export function diasDeEstudo(vigentesDoEstudante: Evento[]): string[] {
  const dias = vigentesDoEstudante
    .filter((e) => ['aula_concluida', 'questao_respondida', 'cartao_revisado', 'estudo_externo'].includes(e.tipo))
    .map(diaLocal);
  return [...new Set(dias)].sort();
}
