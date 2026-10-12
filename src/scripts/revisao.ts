import { lerEventos, lerPerfil, registrarRevisao } from '../lib/aprendizagem/armazem.ts';
import { diaDaData, vigentes } from '../lib/aprendizagem/eventos.ts';
import { filaDoDia } from '../lib/aprendizagem/revisao.ts';
import { tamanhoDaFila } from '../lib/aprendizagem/perfil.ts';

interface Cartao {
  id: string;
  aulaId: string;
  aula: string;
  href: string;
  tipo: 'pergunta' | 'lacuna' | 'verdadeiro-falso';
  frente: string;
  verso: string;
  conceito: string;
}

const ROTULO = { pergunta: 'Pergunta', lacuna: 'Complete', 'verdadeiro-falso': 'Verdadeiro ou falso' } as const;

/** Página /revisao: uma fila curta de cartões, com a resposta escondida até o estudante tentar lembrar. */
export async function montarRevisao() {
  const raiz = document.querySelector<HTMLElement>('[data-revisao]');
  if (!raiz) return;
  const q = <T extends HTMLElement>(seletor: string) => raiz.querySelector<T>(seletor)!;
  const resumo = q('[data-revisao-resumo]');
  const fim = q('[data-revisao-fim]');
  const cartaoEl = q('[data-cartao]');
  const revelar = q<HTMLButtonElement>('[data-cartao-revelar]');
  const verso = q('[data-cartao-verso]');

  let cartoes: Cartao[];
  try {
    const base = document.documentElement.dataset.base || '/';
    cartoes = await (await fetch(`${base}cartoes.json`.replace(/\/{2,}/g, '/'))).json();
  } catch {
    resumo.textContent = 'Não foi possível carregar os cartões agora.';
    return;
  }
  if (cartoes.length === 0) {
    resumo.textContent = 'Ainda não há cartões de revisão.';
    return;
  }

  const hoje = diaDaData(new Date());
  const { fila, restantes, vencidos } = filaDoDia(vigentes(lerEventos()), cartoes.map((c) => c.id), hoje, tamanhoDaFila(lerPerfil()));
  if (fila.length === 0) {
    resumo.textContent = 'Nenhum cartão para revisar hoje.';
    return;
  }
  resumo.textContent =
    vencidos > 0
      ? `${fila.length} cartões para hoje, ${Math.min(vencidos, fila.length)} deles já na hora de rever.`
      : `${fila.length} cartões novos para hoje.`;

  const porId = new Map(cartoes.map((c) => [c.id, c]));
  let posicao = 0;
  let revisados = 0;

  const mostrar = () => {
    const c = porId.get(fila[posicao])!;
    q('[data-cartao-tipo]').textContent = `${ROTULO[c.tipo]} · ${posicao + 1} de ${fila.length}`;
    const aula = q<HTMLAnchorElement>('[data-cartao-aula]');
    aula.textContent = c.aula;
    aula.href = c.href;
    q('[data-cartao-frente]').textContent = c.frente;
    q('[data-cartao-resposta]').textContent = c.verso;
    verso.hidden = true;
    revelar.hidden = false;
    revelar.setAttribute('aria-expanded', 'false');
    cartaoEl.hidden = false;
    revelar.focus({ preventScroll: true });
  };

  const encerrar = () => {
    cartaoEl.hidden = true;
    resumo.textContent = '';
    fim.hidden = false;
    fim.textContent =
      `Fila de hoje concluída: ${revisados} ${revisados === 1 ? 'cartão revisado' : 'cartões revisados'}.` +
      (restantes > 0 ? ` Outros ${restantes} ficam para a próxima vez.` : '');
    fim.focus({ preventScroll: true });
  };

  revelar.addEventListener('click', () => {
    revelar.hidden = true;
    revelar.setAttribute('aria-expanded', 'true');
    verso.hidden = false;
    // O foco vai para a resposta: o leitor de tela a lê e as notas ficam logo depois.
    verso.focus({ preventScroll: true });
  });

  raiz.querySelectorAll<HTMLButtonElement>('[data-resultado]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const c = porId.get(fila[posicao])!;
      const resultado = botao.dataset.resultado as 'lembrei' | 'dificil' | 'nao_lembrei';
      if (!registrarRevisao({ cartaoId: c.id, aulaId: c.aulaId, conceito: c.conceito, resultado })) {
        resumo.textContent = 'Não foi possível salvar neste navegador. O cartão volta na próxima vez.';
      }
      revisados += 1;
      posicao += 1;
      if (posicao >= fila.length) encerrar();
      else mostrar();
    });
  });

  mostrar();
}
