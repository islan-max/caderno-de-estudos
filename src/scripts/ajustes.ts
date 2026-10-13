/* ---------------------------------------------------------------------------
 * Página /ajustes: matérias em foco, tamanho da revisão diária e sugestões escondidas.
 * Os campos são <input> de verdade (teclado e leitor de tela vêm de graça) desenhados como cartões.
 * Cada mudança é salva na hora e a prévia do Hoje é recalculada.
 * ------------------------------------------------------------------------- */
import { FILA_MAX, FILA_MIN, LIMITES_FILA, LIMITE_FOCO, limparFoco } from '../lib/estudo';
import type { Sugestao } from '../lib/estudo';
import { carregarIndice } from './busca';
import { toast } from './avisos';
import { dispensasDoHoje, gravarAjustes, lerAjustes, limparDispensas } from './registro';
import type { Ajustes } from './registro';
import { sugestoesAtuais, tipoDeHoje } from './sugestoes';
import type { TipoHoje } from './sugestoes';
import { montarBarrasDeRolagem } from './barra-rolagem';
import { escapar } from './util';

const ABAS: Record<string, string> = { enem: 'ENEM', escolar: 'Escolar', ds: 'DS' };
const ICONES: Record<Sugestao['tipo'], string> = {
  revisao: 'repeat',
  rever: 'arrows-rotate',
  continuar: 'play',
  proxima: 'route',
  comecar: 'compass',
};
const TAMANHOS: { chave: keyof typeof LIMITES_FILA; nome: string; texto: string }[] = [
  { chave: 'curta', nome: 'Curta', texto: 'Para dias corridos: só o mais urgente.' },
  { chave: 'media', nome: 'Média', texto: 'O ritmo padrão, para a maioria dos dias.' },
  { chave: 'longa', nome: 'Longa', texto: 'Para dias de estudo pesado ou para tirar atraso.' },
];
const TIPOS_HOJE: { chave: TipoHoje; nome: string; vazio: string }[] = [
  { chave: 'revisao', nome: 'Revisão de cartões', vazio: 'Nenhum cartão para revisar agora.' },
  { chave: 'rever', nome: 'Seção a rever', vazio: 'Nada para rever agora.' },
  { chave: 'aula', nome: 'Aula para continuar ou começar', vazio: 'Nenhuma aula para sugerir agora.' },
];

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

let encerrar: AbortController | null = null;

export async function montarAjustes() {
  const raiz = document.querySelector<HTMLElement>('[data-ajustes]');
  if (!raiz) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;

  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const bloco = (nome: string) => q(`[data-bloco="${nome}"]`);

  const indice = await carregarIndice();
  if (!raiz.isConnected) return;
  const tituloDaAula = new Map(indice.map((a) => [a.id, a.t]));

  let ajustes = lerAjustes();
  /** "Livre" fica marcada enquanto a pessoa digita, mesmo que o número caia num dos ritmos. */
  let filaLivre = !Object.values(LIMITES_FILA).includes(ajustes.fila as never);

  /* ------------------------------------------------------------ foco */
  /** aba → área (só o ENEM tem áreas) → matérias. */
  function materiasAgrupadas() {
    const abas = new Map<string, Map<string, Map<string, { nome: string; icone: string; aulas: number }>>>();
    for (const a of indice) {
      const [aba] = a.s.split('/');
      const areas = abas.get(aba) ?? new Map();
      const area = aba === 'enem' ? a.a : '';
      const materias = areas.get(area) ?? new Map();
      const m = materias.get(a.s) ?? { nome: a.m, icone: a.i, aulas: 0 };
      m.aulas++;
      materias.set(a.s, m);
      areas.set(area, materias);
      abas.set(aba, areas);
    }
    return abas;
  }
  const grupos = materiasAgrupadas();
  const dadosDaMateria = new Map<string, { nome: string; icone: string }>();
  for (const areas of grupos.values()) for (const g of areas.values()) for (const [s, m] of g) dadosDaMateria.set(s, m);
  const corDe = (s: string) => `var(--color-${s.split('/')[1]}, var(--color-ink))`;

  /** Três painéis, um por categoria: cada um com o seu limite e a sua cor. */
  function desenharFoco() {
    const usadas = (aba: string) => ajustes.foco.filter((s) => s.split('/')[0] === aba).length;
    const cheia = (aba: string) => usadas(aba) >= (LIMITE_FOCO[aba] ?? 0);

    // Redesenhar volta a lista ao topo: guarda a rolagem de cada painel para devolvê-la.
    const rolagens = [...bloco('foco').querySelectorAll<HTMLElement>('.aj-painel__rola')].map((e) => e.scrollTop);
    bloco('foco').innerHTML = `
      <div class="aj-paineis">
        ${[...grupos.entries()]
          .map(([aba, areas]) => {
            const max = LIMITE_FOCO[aba] ?? 0;
            return `
          <div class="aj-painel aj-painel--${aba}" role="group" aria-labelledby="aj-painel-${aba}" style="--aba: var(--color-${aba})">
            <div class="aj-painel__cabeca">
              <span class="aj-painel__nome" id="aj-painel-${aba}">${ABAS[aba] ?? aba}</span>
              <span class="aj-painel__contagem" aria-live="polite"><strong>${usadas(aba)}</strong> de ${max}<span class="apenas-leitor"> matérias em foco</span></span>
            </div>
            <div class="aj-painel__corpo" data-rolagem>
            <div class="aj-painel__rola" data-rolagem-area tabindex="0" role="region" aria-label="Matérias: ${ABAS[aba] ?? aba}">
            ${[...areas.entries()]
              .map(
                ([area, materias]) => `
              ${area ? `<p class="aj-painel__area">${escapar(area)}</p>` : ''}
              <ul class="aj-lista">
                ${[...materias.entries()]
                  .map(([s, m]) => {
                    const marcada = ajustes.foco.includes(s);
                    const trava = cheia(aba) && !marcada;
                    return `
                  <li>
                    <label class="aj-linha ${trava ? 'aj-linha--trava' : ''}" style="--cor: ${corDe(s)}">
                      <input type="checkbox" value="${escapar(s)}" ${marcada ? 'checked' : ''} ${trava ? 'disabled' : ''} />
                      <span class="aj-linha__caixa" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
                      <i class="fa-solid fa-${escapar(m.icone)} aj-linha__icone" aria-hidden="true"></i>
                      <span class="aj-linha__nome">${escapar(m.nome)}</span>
                      <small class="aj-linha__aulas">${m.aulas}<span class="apenas-leitor"> ${m.aulas === 1 ? 'aula' : 'aulas'}</span></small>
                    </label>
                  </li>`;
                  })
                  .join('')}
              </ul>`
              )
              .join('')}
            ${cheia(aba) ? '<p class="aj-painel__limite">Limite da categoria. Desmarque uma para trocar.</p>' : ''}
            </div>
            </div>
          </div>`;
          })
          .join('')}
      </div>
      <p class="aj-nota">${ajustes.foco.length ? 'Cada categoria conta à parte. Sem nenhuma marcada, o caderno decide pelo que você mais estuda.' : 'Nenhuma escolhida: o caderno decide pelo que você mais estuda.'}</p>`;
    bloco('foco').querySelectorAll<HTMLElement>('.aj-painel__rola').forEach((e, i) => (e.scrollTop = rolagens[i] ?? 0));
    montarBarrasDeRolagem();
  }

  /* ------------------------------------------------------------ fila */
  function desenharFila() {
    const tempo = (n: number) => `cerca de ${Math.max(1, Math.round(n / 2))} min`;
    bloco('fila').innerHTML = `
      <fieldset class="aj-tamanhos">
        <legend class="apenas-leitor">Cartões por dia na revisão</legend>
        ${TAMANHOS.map((t) => {
          const n = LIMITES_FILA[t.chave];
          return `
          <label class="aj-tamanho">
            <input type="radio" name="fila" value="${t.chave}" ${!filaLivre && ajustes.fila === n ? 'checked' : ''} />
            <span class="aj-tamanho__corpo">
              <span class="aj-tamanho__nome">${t.nome}<i class="fa-solid fa-check aj-tamanho__ok" aria-hidden="true"></i></span>
              <span class="aj-tamanho__n"><strong>${n}</strong> cartões</span>
              <span class="aj-tamanho__tempo">${tempo(n)}</span>
              <span class="aj-tamanho__texto">${t.texto}</span>
            </span>
          </label>`;
        }).join('')}
        <label class="aj-tamanho aj-tamanho--livre">
          <input type="radio" name="fila" value="livre" ${filaLivre ? 'checked' : ''} />
          <span class="aj-tamanho__corpo">
            <span class="aj-tamanho__nome">Livre<i class="fa-solid fa-check aj-tamanho__ok" aria-hidden="true"></i></span>
            <span class="aj-tamanho__n"><strong data-fila-n>${filaLivre ? ajustes.fila : '…'}</strong> cartões</span>
            <span class="aj-tamanho__tempo" data-fila-tempo>${filaLivre ? tempo(ajustes.fila) : 'você escolhe'}</span>
            <span class="aj-tamanho__campo">
              <span class="aj-passo">
                <button type="button" class="aj-passo__botao" data-fila-passo="-1" aria-label="Um cartão a menos" title="Um a menos">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>
                </button>
                <input class="aj-numero" type="number" inputmode="numeric" min="${FILA_MIN}" max="${FILA_MAX}" step="1" value="${ajustes.fila}" aria-label="Quantos cartões por dia (${FILA_MIN} a ${FILA_MAX})" data-fila-numero />
                <button type="button" class="aj-passo__botao" data-fila-passo="1" aria-label="Um cartão a mais" title="Um a mais">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>
                </button>
              </span>
              <span class="aj-tamanho__texto">de ${FILA_MIN} a ${FILA_MAX}</span>
            </span>
          </span>
        </label>
      </fieldset>`;
  }

  /* ---------------------------------------------------------- prévia */
  function desenharPrevia() {
    const atuais = new Map<TipoHoje, ReturnType<typeof sugestoesAtuais>[number]>();
    for (const sug of sugestoesAtuais(indice, ajustes, true, true)) atuais.set(tipoDeHoje(sug), sug);
    const mestre = ajustes.hoje.mostrar;
    bloco('previa').innerHTML = `
      <label class="aj-troca aj-troca--mestre">
        <input type="checkbox" role="switch" data-hoje-mostrar ${mestre ? 'checked' : ''} />
        <span class="aj-troca__trilho" aria-hidden="true"></span>
        <span class="aj-troca__texto"><strong>Mostrar o Hoje na página inicial</strong><small>${mestre ? 'Ligado: o Hoje aparece com as sugestões marcadas abaixo.' : 'Desligado: a página inicial não mostra o Hoje.'}</small></span>
      </label>
      <ul class="aj-previa ${mestre ? '' : 'aj-previa--off'}">
        ${TIPOS_HOJE.map((t) => {
          const sug = atuais.get(t.chave);
          const ligado = ajustes.hoje[t.chave];
          return `
          <li class="aj-previa__item ${ligado ? '' : 'aj-previa__item--off'}" data-tipo="${sug?.tipo ?? t.chave}">
            <span class="aj-previa__icone" aria-hidden="true"><i class="fa-solid fa-${ICONES[sug?.tipo ?? (t.chave === 'aula' ? 'proxima' : t.chave)]}"></i></span>
            <div class="aj-previa__corpo">
              <p class="aj-previa__tipo">${t.nome}</p>
              <p class="aj-previa__titulo">${sug ? escapar(sug.titulo) : t.vazio}</p>
              ${sug ? `<p class="aj-previa__motivo">${escapar(sug.motivo)}</p>` : ''}
            </div>
            <label class="aj-troca aj-troca--solo">
              <input type="checkbox" role="switch" data-hoje-tipo="${t.chave}" ${ligado ? 'checked' : ''} ${mestre ? '' : 'disabled'} />
              <span class="aj-troca__trilho" aria-hidden="true"></span>
              <span class="apenas-leitor">Mostrar no Hoje: ${t.nome}</span>
            </label>
          </li>`;
        }).join('')}
      </ul>`;
  }

  /* ------------------------------------------------------ escondidas */
  function nomeDaSugestao(id: string): string {
    if (id === 'revisao') return 'Revisão de cartões';
    const [tipo, ...resto] = id.split(':');
    const aula = resto.join(':');
    const titulo = tituloDaAula.get(aula) ?? aula.split('/').pop() ?? aula;
    return tipo === 'rever' ? `Rever: ${titulo}` : titulo;
  }

  function desenharEscondidas() {
    const d = Object.entries(dispensasDoHoje()).sort((a, b) => a[1] - b[1]);
    bloco('escondidas').innerHTML = d.length
      ? `<ul class="aj-escondidas">${d
          .map(
            ([id, ate]) => `
        <li class="aj-escondida"><span class="aj-escondida__nome">${escapar(nomeDaSugestao(id))}</span><span class="aj-escondida__hora"><i class="fa-solid fa-clock" aria-hidden="true"></i> volta às ${hora(ate)}</span></li>`
          )
          .join('')}</ul>
         <button type="button" class="aj-botao aj-botao--principal" data-trazer>Trazer tudo de volta agora</button>`
      : '<p class="aj-vazio">Nenhuma sugestão escondida. Quando você usar “Agora não” no Hoje, ela aparece aqui.</p>';
  }

  function desenharTudo() {
    desenharFoco();
    desenharFila();
    desenharPrevia();
    desenharEscondidas();
  }

  function salvar(novo: Ajustes, mensagem: string) {
    ajustes = novo;
    const ok = gravarAjustes(novo);
    toast(ok ? mensagem : 'Não foi possível salvar neste navegador', ok ? 'circle-check' : 'triangle-exclamation');
  }

  /* ----------------------------------------------------------- ações */
  bloco('foco').addEventListener(
    'change',
    (e) => {
      const caixa = e.target as HTMLInputElement;
      if (caixa.type !== 'checkbox') return;
      const foco = caixa.checked ? limparFoco([...ajustes.foco, caixa.value]) : ajustes.foco.filter((s) => s !== caixa.value);
      salvar({ ...ajustes, foco }, caixa.checked ? 'Matéria em foco' : 'Matéria fora do foco');
      desenharFoco();
      desenharPrevia();
      bloco('foco').querySelector<HTMLInputElement>(`input[value="${CSS.escape(caixa.value)}"]`)?.focus();
    },
    { signal }
  );
  bloco('fila').addEventListener(
    'change',
    (e) => {
      const alvo = e.target as HTMLInputElement;
      if (alvo.matches('[data-fila-numero]')) {
        const n = Math.round(Number(alvo.value));
        if (!Number.isFinite(n) || n < FILA_MIN || n > FILA_MAX) {
          alvo.value = String(ajustes.fila);
          toast(`Digite um número de ${FILA_MIN} a ${FILA_MAX}`, 'triangle-exclamation');
          return;
        }
        alvo.value = String(n);
        salvar({ ...ajustes, fila: n }, `Revisão: ${n} ${n === 1 ? 'cartão' : 'cartões'} por dia`);
        filaLivre = true;
        desenharFila();
        desenharPrevia();
        bloco('fila').querySelector<HTMLElement>('[data-fila-numero]')?.focus();
        return;
      }
      if (alvo.name !== 'fila') return;
      if (alvo.value === 'livre') {
        filaLivre = true;
        desenharFila();
        bloco('fila').querySelector<HTMLElement>('[data-fila-numero]')?.focus();
        return;
      }
      const n = LIMITES_FILA[alvo.value as keyof typeof LIMITES_FILA];
      filaLivre = false;
      salvar({ ...ajustes, fila: n }, `Revisão ${TAMANHOS.find((t) => t.chave === alvo.value)?.nome.toLowerCase()}: ${n} cartões`);
      desenharFila();
      desenharPrevia();
      bloco('fila').querySelector<HTMLInputElement>(`input[name="fila"][value="${alvo.value}"]`)?.focus();
    },
    { signal }
  );
  bloco('fila').addEventListener(
    'click',
    (e) => {
      const botao = (e.target as HTMLElement).closest<HTMLElement>('[data-fila-passo]');
      if (!botao) return;
      const campo = bloco('fila').querySelector<HTMLInputElement>('[data-fila-numero]')!;
      const atual = Math.round(Number(campo.value)) || ajustes.fila;
      campo.value = String(Math.min(FILA_MAX, Math.max(FILA_MIN, atual + Number(botao.dataset.filaPasso))));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      // A fila foi redesenhada: o foco volta para o mesmo botão.
      bloco('fila').querySelector<HTMLElement>(`[data-fila-passo="${botao.dataset.filaPasso}"]`)?.focus();
    },
    { signal }
  );
  bloco('previa').addEventListener(
    'change',
    (e) => {
      const caixa = e.target as HTMLInputElement;
      const tipo = caixa.dataset.hojeTipo as TipoHoje | undefined;
      if (caixa.matches('[data-hoje-mostrar]')) {
        salvar({ ...ajustes, hoje: { ...ajustes.hoje, mostrar: caixa.checked } }, caixa.checked ? 'O Hoje volta à página inicial' : 'O Hoje não aparece mais na página inicial');
      } else if (tipo) {
        const nome = TIPOS_HOJE.find((t) => t.chave === tipo)!.nome;
        salvar({ ...ajustes, hoje: { ...ajustes.hoje, [tipo]: caixa.checked } }, `${nome}: ${caixa.checked ? 'aparece' : 'não aparece'} no Hoje`);
      } else return;
      desenharPrevia();
      const de = tipo ? `[data-hoje-tipo="${tipo}"]` : '[data-hoje-mostrar]';
      bloco('previa').querySelector<HTMLElement>(de)?.focus();
    },
    { signal }
  );
  bloco('escondidas').addEventListener(
    'click',
    (e) => {
      if (!(e.target as HTMLElement).closest('[data-trazer]')) return;
      limparDispensas();
      desenharEscondidas();
      desenharPrevia();
      toast('As sugestões voltaram', 'circle-check');
    },
    { signal }
  );

  desenharTudo();
  q('[data-ajustes-status]').hidden = true;
  q('[data-ajustes-corpo]').hidden = false;
}

