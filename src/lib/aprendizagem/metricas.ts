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
    formula: 'dia local com pelo menos uma aula concluída ou questão respondida. Abrir uma página não conta.',
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
  'revisao-vencida': {
    nome: 'Revisão vencida',
    formula: 'cartão com data de revisão igual ou anterior a hoje (disponível quando os flashcards existirem).',
    naoMede: 'Quanto você esqueceu.',
    comoMelhorar: 'Fazer a fila de revisão do dia.',
  },
};

export function progressoDaMateria(concluidas: number, publicadas: number): number {
  return publicadas === 0 ? 0 : Math.min(1, concluidas / publicadas);
}

/** Dias locais (ordenados) com conclusão ou resposta. */
export function diasDeEstudo(vigentesDoEstudante: Evento[]): string[] {
  const dias = vigentesDoEstudante
    .filter((e) => e.tipo === 'aula_concluida' || e.tipo === 'questao_respondida')
    .map(diaLocal);
  return [...new Set(dias)].sort();
}
