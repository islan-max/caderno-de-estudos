/* ---------------------------------------------------------------------------
 * "Ver o que ficou": diagnóstico por conceito em cada unidade da trilha.
 * ------------------------------------------------------------------------- */
import { lerEventos } from '../lib/aprendizagem/armazem';
import { vigentes } from '../lib/aprendizagem/eventos';
import { diagnosticoDaUnidade } from '../lib/aprendizagem/diagnostico';

const ROTULO_DIAGNOSTICO = { firme: 'Firme', parcial: 'Parcial', lacuna: 'Lacuna', 'dados-insuficientes': 'Dados insuficientes' } as const;

const RESULTADO_EM_TEXTO: Record<string, string> = {
  acertou: 'acertou', errou: 'errou', lembrei: 'lembrou', dificil: 'lembrou com dificuldade', nao_lembrei: 'não lembrou',
};

/** "Ver o que ficou", em cada unidade da trilha: estado por conceito, só com as respostas já dadas. */
export function montarFicou() {
  const eventos = vigentes(lerEventos());
  document.querySelectorAll<HTMLElement>('[data-ficou]').forEach((det) => {
    const conceitos: { id: string; nome: string; aula: string; href: string }[] = JSON.parse(det.dataset.conceitos || '[]');
    const { resultados, conclusivo } = diagnosticoDaUnidade(eventos, conceitos.map((c) => c.id));
    det.querySelector('[data-ficou-resumo]')!.textContent = conclusivo
      ? 'Resultado por conceito, com base nas suas respostas. Não é uma nota.'
      : 'Ainda não há respostas suficientes para dizer o que ficou. Responda as questões das aulas desta unidade.';

    det.querySelector('[data-ficou-lista]')!.replaceChildren(
      ...resultados.map((r, i) => {
        const c = conceitos[i];
        const li = document.createElement('li');
        li.className = 'ficou__item';
        const nome = document.createElement('strong');
        nome.textContent = c.nome;
        const estado = document.createElement('span');
        estado.className = 'ficou__estado';
        estado.dataset.estado = r.estado;
        estado.textContent = ROTULO_DIAGNOSTICO[r.estado];
        const proximo = document.createElement('p');
        proximo.style.margin = '0.25rem 0 0';
        const aula = document.createElement('a');
        aula.href = c.href;
        aula.textContent = c.aula;
        proximo.append(
          r.estado === 'lacuna' ? 'Vale rever na aula ' : r.estado === 'dados-insuficientes' ? 'Responda as questões da aula ' : 'Aula ',
          aula,
          r.estado === 'lacuna' ? ' e os cartões de revisão.' : '.'
        );
        li.append(nome, estado, proximo);

        if (r.evidencias.length) {
          const como = document.createElement('details');
          const resumo = document.createElement('summary');
          resumo.textContent = 'Como chegamos nisso';
          const ul = document.createElement('ul');
          ul.className = 'ficou__evidencias';
          for (const e of r.evidencias) {
            const item = document.createElement('li');
            const dia = new Date(e.quando).toLocaleDateString('pt-BR');
            const o = e.questaoId ? `Questão ${e.questaoId.split('#q')[1]} de ${c.aula}` : 'Cartão de revisão';
            item.textContent = `${o}: ${RESULTADO_EM_TEXTO[e.resultado!] ?? e.resultado}, em ${dia}.`;
            ul.append(item);
          }
          como.append(resumo, ul);
          li.append(como);
        }
        return li;
      })
    );
  });
}
