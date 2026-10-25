/* ---------------------------------------------------------------------------
 * Página /recomendacoes: matérias de interesse, sugestões com o motivo e as avaliações já dadas.
 * As regras estão em src/lib/recomendacao.ts; aqui só se lê o armazenamento e se desenha a página.
 * ------------------------------------------------------------------------- */
import { comFeedback, comInteresse, recomendar } from '../lib/recomendacao';
import type { ItemRec } from '../lib/recomendacao';
import { carregarIndice } from './busca';
import { vistas } from './progresso';
import { gravarPreferencias, lerPreferencias } from './registro';
import { escapar } from './util';

let encerrar: AbortController | null = null;

export async function montarRecomendacoes() {
  const raiz = document.querySelector<HTMLElement>('[data-recomendacoes]');
  if (!raiz) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;

  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const indice = await carregarIndice();
  if (!raiz.isConnected) return;

  const catalogo: ItemRec[] = indice.map((a) => ({ id: a.id, titulo: a.t, materia: a.s, materiaNome: a.m, grupo: a.a, cartoes: a.k }));
  const href = new Map(indice.map((a) => [a.id, a.h]));
  const porId = new Map(catalogo.map((it) => [it.id, it]));
  let prefs = lerPreferencias();
  const gravar = (novas: typeof prefs) => {
    prefs = novas;
    gravarPreferencias(prefs);
  };

  /* ------------------------------------------------------------ matérias */
  function desenharMaterias() {
    const grupos = new Map<string, Map<string, string>>();
    for (const it of catalogo) {
      const g = grupos.get(it.grupo) ?? new Map<string, string>();
      g.set(it.materia, it.materiaNome);
      grupos.set(it.grupo, g);
    }
    q('[data-rec-materias]').innerHTML = [...grupos]
      .map(
        ([grupo, materias]) => `
        <fieldset class="rec__grupo">
          <legend>${escapar(grupo)}</legend>
          ${[...materias]
            .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
            .map(
              ([chave, nome]) =>
                `<label class="rec__materia"><input type="checkbox" value="${escapar(chave)}"${prefs.interesses.includes(chave) ? ' checked' : ''} /> ${escapar(nome)}</label>`,
            )
            .join('')}
        </fieldset>`,
      )
      .join('');
  }

  /* ----------------------------------------------------------- sugestões */
  function desenharSugestoes() {
    const alvo = q('[data-rec-sugestoes]');
    const r = recomendar({ catalogo, prefs, concluidas: Object.keys(vistas()) });
    if (r.semPerfil) {
      alvo.innerHTML = '<p class="metas__vazio">Marque ao menos uma matéria acima para ver sugestões.</p>';
      return;
    }
    if (!r.itens.length) {
      alvo.innerHTML = '<p class="metas__vazio">Nada novo para sugerir agora: o que combina com suas escolhas já foi concluído ou avaliado. Marque outra matéria ou desfaça uma avaliação.</p>';
      return;
    }
    alvo.innerHTML = `<ul class="rec__lista">${r.itens
      .map(
        ({ item, porque }, i) => `
        <li class="rec">
          <a class="rec__titulo" id="rec-t-${i}" href="${escapar(href.get(item.id) ?? '#')}">${escapar(item.titulo)}</a>
          <p class="rec__meta">${escapar(item.materiaNome)} · ${escapar(item.grupo)}</p>
          <p class="rec__porque">Por que: ${porque.map(escapar).join('. ')}.</p>
          <div class="meta__acoes">
            <button type="button" class="est-botao" data-gosto="1" data-aula="${escapar(item.id)}" aria-describedby="rec-t-${i}">Gostei</button>
            <button type="button" class="est-botao" data-gosto="-1" data-aula="${escapar(item.id)}" aria-describedby="rec-t-${i}">Não quero algo assim</button>
          </div>
        </li>`,
      )
      .join('')}</ul>`;
  }

  /* ----------------------------------------------------------- avaliadas */
  function desenharAvaliadas() {
    const alvo = q('[data-rec-avaliadas]');
    const linhas = Object.entries(prefs.feedback)
      .map(([id, v]) => [porId.get(id), v] as const)
      .filter((x): x is readonly [ItemRec, 1 | -1] => Boolean(x[0]))
      .sort((a, b) => a[0].titulo.localeCompare(b[0].titulo, 'pt-BR'));
    if (!linhas.length) {
      alvo.innerHTML = '<p class="metas__vazio">Você ainda não avaliou nenhuma aula.</p>';
      return;
    }
    alvo.innerHTML = `<ul class="rec__lista">${linhas
      .map(
        ([it, v], i) => `
        <li class="rec rec--avaliada">
          <p class="rec__meta"><a id="rec-a-${i}" href="${escapar(href.get(it.id) ?? '#')}">${escapar(it.titulo)}</a> · ${v === 1 ? 'você gostou' : 'você não quer algo assim'}</p>
          <button type="button" class="est-botao" data-desfazer="${escapar(it.id)}" aria-describedby="rec-a-${i}">Desfazer</button>
        </li>`,
      )
      .join('')}</ul>`;
  }

  const aviso = q('[data-rec-status]');
  function desenharTudo(mensagem = '') {
    desenharSugestoes();
    desenharAvaliadas();
    aviso.textContent = '';
    if (mensagem) window.setTimeout(() => (aviso.textContent = mensagem), 30);
  }

  desenharMaterias();
  desenharSugestoes();
  desenharAvaliadas();
  aviso.textContent = '';
  q('[data-rec-corpo]').hidden = false;

  q('[data-rec-materias]').addEventListener(
    'change',
    (e) => {
      const caixa = e.target as HTMLInputElement;
      if (caixa.type !== 'checkbox') return;
      gravar(comInteresse(prefs, caixa.value, caixa.checked));
      desenharTudo('Sugestões atualizadas.');
    },
    { signal },
  );

  q('[data-rec-sugestoes]').addEventListener(
    'click',
    (e) => {
      const botao = (e.target as HTMLElement).closest<HTMLElement>('[data-gosto]');
      if (!botao) return;
      gravar(comFeedback(prefs, botao.dataset.aula!, botao.dataset.gosto === '1' ? 1 : -1));
      desenharTudo(botao.dataset.gosto === '1' ? 'Marcada como “gostei”. A lista foi atualizada.' : 'Entendido: aulas parecidas descem na lista. A lista foi atualizada.');
      q('#rec-sugestoes').focus();
    },
    { signal },
  );

  q('[data-rec-avaliadas]').addEventListener(
    'click',
    (e) => {
      const botao = (e.target as HTMLElement).closest<HTMLElement>('[data-desfazer]');
      if (!botao) return;
      const id = botao.dataset.desfazer!;
      gravar(comFeedback(prefs, id, prefs.feedback[id]));
      desenharTudo('Avaliação desfeita. A lista foi atualizada.');
      q('#rec-avaliadas').focus();
    },
    { signal },
  );
}
