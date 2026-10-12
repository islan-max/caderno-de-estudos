import { editarSessao, excluirSessao, lerEventos, registrarEstudoExterno } from '../lib/aprendizagem/armazem.ts';
import { diaDaData, vigentes, type Evento } from '../lib/aprendizagem/eventos.ts';
import { estadoDoConceito } from '../lib/aprendizagem/estados.ts';
import { diasDeEstudo, progressoDaMateria } from '../lib/aprendizagem/metricas.ts';
import { contarCartoes } from '../lib/aprendizagem/revisao.ts';
import { montarSessoes, type Sessao } from '../lib/aprendizagem/sessoes.ts';

interface Aula { id: string; m: string; s: string }
interface Conceito { id: string; nome: string; aula: string; href: string }

const SEMANAS = 12;
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...filhos: (string | Node)[]) {
  const e = document.createElement(tag);
  const { class: classe, ...resto } = props as Record<string, unknown>;
  if (classe) e.className = String(classe);
  Object.assign(e, resto);
  e.append(...filhos);
  return e;
}

async function json<T>(arquivo: string): Promise<T[]> {
  try {
    const base = document.documentElement.dataset.base || '/';
    return await (await fetch(`${base}${arquivo}`.replace(/\/{2,}/g, '/'))).json();
  } catch {
    return [];
  }
}

function progressoLocal(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('cdt:progresso') ?? '{}');
  } catch {
    return {};
  }
}

/** Resumo em texto das atividades de um conjunto de eventos. */
function resumoDe(eventos: Evento[], minutosExternos = 0) {
  const n = (tipo: string) => eventos.filter((e) => e.tipo === tipo).length;
  const partes = [
    n('questao_respondida') && plural(n('questao_respondida'), 'questão respondida', 'questões respondidas'),
    n('aula_concluida') && plural(n('aula_concluida'), 'aula concluída', 'aulas concluídas'),
    n('cartao_revisado') && plural(n('cartao_revisado'), 'cartão revisado', 'cartões revisados'),
    minutosExternos && `${minutosExternos} min fora do site`,
  ].filter(Boolean);
  return partes.join(', ');
}

/** Página "Meu aprendizado": tudo é recalculado dos eventos a cada desenho. */
export async function montarAprendizado() {
  const raiz = document.querySelector<HTMLElement>('[data-aprendizado]');
  if (!raiz) return;
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const conceitos: Conceito[] = JSON.parse(raiz.dataset.conceitos || '[]');
  const [aulas, cartoes] = await Promise.all([json<Aula>('aulas.json'), json<{ id: string }>('cartoes.json')]);
  const ids = cartoes.map((c) => c.id);

  const desenhar = () => {
    const eventos = vigentes(lerEventos());
    const hoje = new Date();
    const hojeStr = diaDaData(hoje);

    // ---- dias de estudo: calendário (visual) e lista (texto) com os mesmos dados
    const ativos = new Set(diasDeEstudo(eventos));
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay() - (SEMANAS - 1) * 7, 12);
    const calendario = q('[data-calendario]');
    calendario.replaceChildren();
    for (let d = new Date(inicio); diaDaData(d) <= hojeStr; d.setDate(d.getDate() + 1)) {
      const dia = diaDaData(d);
      const c = el('span', { class: 'cal__dia' });
      if (ativos.has(dia)) c.dataset.ativo = '';
      if (dia === hojeStr) c.dataset.hoje = '';
      calendario.append(c);
    }
    const ultimos7 = new Set(Array.from({ length: 7 }, (_, i) => diaDaData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i, 12))));
    const em7 = [...ativos].filter((d) => ultimos7.has(d)).length;
    q('[data-dias-resumo]').textContent = `Dias com atividade nos últimos 7 dias: ${em7} de 7.`;
    const dias = [...ativos].filter((d) => d >= diaDaData(inicio)).sort().reverse();
    q('[data-dias-lista]').replaceChildren(
      ...(dias.length
        ? dias.map((dia) => {
            const doDia = eventos.filter((e) => diaDaData(new Date(e.quando)) === dia);
            const externos = doDia.filter((e) => e.tipo === 'estudo_externo').reduce((s, e) => s + (e.minutos ?? 0), 0);
            const [a, m, d] = dia.split('-');
            return el('li', { class: 'aprend__item' }, el('strong', {}, `${d}/${m}/${a}`), `: ${resumoDe(doDia, externos)}.`);
          })
        : [el('li', { class: 'aprend__item' }, 'Nenhum dia com registro nas últimas 12 semanas.')])
    );

    // ---- progresso por matéria: aulas concluídas ÷ aulas publicadas
    const concluidas = progressoLocal();
    const materias = new Map<string, { nome: string; total: number; feitas: number }>();
    for (const a of aulas) {
      const g = materias.get(a.s) ?? { nome: a.m, total: 0, feitas: 0 };
      g.total += 1;
      if (concluidas[a.id]) g.feitas += 1;
      materias.set(a.s, g);
    }
    const comProgresso = [...materias.values()].filter((g) => g.feitas > 0).sort((a, b) => b.feitas - a.feitas);
    q('[data-materias]').replaceChildren(
      ...(comProgresso.length
        ? comProgresso.map((g) => {
            const p = Math.round(progressoDaMateria(g.feitas, g.total) * 100);
            const barra = el('progress', { value: g.feitas, max: g.total });
            barra.setAttribute('aria-label', `${g.nome}: ${g.feitas} de ${g.total} aulas`);
            return el('li', { class: 'aprend__item' }, el('strong', {}, g.nome), `: ${g.feitas} de ${g.total} aulas (${p}%).`, barra);
          })
        : [el('li', { class: 'aprend__item' }, 'Você ainda não concluiu nenhuma aula.')])
    );

    // ---- conceitos que precisam de atenção
    const atencao = conceitos.filter((c) => estadoDoConceito(eventos, c.id) === 'precisa-revisar');
    q('[data-atencao]').replaceChildren(
      ...(atencao.length
        ? atencao.map((c) => {
            const aula = el('a', { href: c.href }, c.aula);
            return el('li', { class: 'aprend__item' }, el('strong', {}, c.nome), ': o último resultado foi um erro. Vale rever na aula ', aula, '.');
          })
        : [el('li', { class: 'aprend__item' }, 'Nenhum conceito marcado para revisar agora.')])
    );

    // ---- revisões
    const feitas7 = eventos.filter((e) => e.tipo === 'cartao_revisado' && ultimos7.has(diaDaData(new Date(e.quando)))).length;
    const { vencidos } = contarCartoes(eventos, ids, hojeStr);
    q('[data-revisoes]').textContent = `Cartões revisados nos últimos 7 dias: ${feitas7}. Cartões na data de rever: ${vencidos}.`;

    // ---- histórico de sessões
    const sessoes = montarSessoes(eventos).slice(0, 20);
    q('[data-sessoes]').replaceChildren(
      ...(sessoes.length ? sessoes.map(itemDeSessao) : [el('li', { class: 'aprend__item' }, 'Nenhuma sessão registrada ainda.')])
    );
  };

  const status = q('[data-sessoes-status]');
  const aviso = (texto: string) => { status.textContent = texto; };
  const recomecar = (texto: string) => {
    desenhar();
    aviso(texto);
    q('[data-sessoes-titulo]').focus({ preventScroll: true });
  };

  const itemDeSessao = (s: Sessao) => {
    const quando = s.origem === 'manual' ? `${dataCurta(s.inicio)}` : `${dataCurta(s.inicio)}, ${hora(s.inicio)}`;
    const li = el('li', { class: 'aprend__item' });
    const detalhes = s.origem === 'manual'
      ? [s.assunto, s.objetivo].filter(Boolean).join(' · ') || 'Estudo fora do site'
      : resumoDe(s.eventos);
    li.append(
      el('strong', {}, `${quando} · ${s.origem === 'manual' ? 'Fora do site' : 'Automática'}`),
      `: ${detalhes}. ${s.origem === 'manual' ? 'Duração informada' : 'Tempo ativo estimado'}: ${s.minutos} min${s.editada ? ' (editado por você)' : ''}.`
    );
    if (s.origem === 'automatica' && s.objetivo) li.append(` Objetivo: ${s.objetivo}.`);
    const acoes = el('div', { class: 'aprend__acoes' });
    const editar = el('button', { type: 'button', class: 'aprend__botao' }, 'Editar');
    const excluir = el('button', { type: 'button', class: 'aprend__botao' }, 'Excluir');
    editar.setAttribute('aria-label', `Editar a sessão de ${quando}`);
    excluir.setAttribute('aria-label', `Excluir a sessão de ${quando}`);
    acoes.append(editar, excluir);
    li.append(acoes);

    const painel = el('div');
    li.append(painel);
    const fechar = (foco: HTMLElement) => { painel.replaceChildren(); foco.focus(); };

    editar.addEventListener('click', () => {
      const minutos = el('input', { type: 'number', min: '0', max: '600', value: String(s.minutos), id: `ed-m-${s.id}` });
      const objetivo = el('input', { type: 'text', maxLength: 160, value: s.objetivo ?? '', id: `ed-o-${s.id}` });
      const erro = el('p', { class: 'aprend__erro' });
      erro.setAttribute('role', 'alert');
      const form = el('form', { class: 'aprend__form' },
        el('label', { htmlFor: minutos.id }, 'Duração em minutos'), minutos,
        el('label', { htmlFor: objetivo.id }, 'Objetivo (opcional)'), objetivo, erro,
        el('div', { class: 'aprend__acoes' },
          el('button', { type: 'submit', class: 'aprend__botao aprend__botao--principal' }, 'Salvar'),
          el('button', { type: 'button', class: 'aprend__botao' }, 'Cancelar'))
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (editarSessao(s.id, { minutos: Number(minutos.value), objetivo: objetivo.value })) recomecar('Sessão atualizada. Só o tempo e o objetivo mudaram.');
        else { erro.textContent = 'Informe um número de minutos entre 0 e 600.'; minutos.setAttribute('aria-invalid', 'true'); minutos.focus(); }
      });
      form.querySelector<HTMLButtonElement>('button[type=button]')!.addEventListener('click', () => fechar(editar));
      painel.replaceChildren(form);
      minutos.focus();
    });

    excluir.addEventListener('click', () => {
      const texto = s.origem === 'manual'
        ? 'Excluir este registro de estudo fora do site? O dia deixa de contar como dia de estudo.'
        : 'Excluir esta sessão do histórico e do tempo? Suas respostas e aulas concluídas continuam valendo.';
      const marca = el('input', { type: 'checkbox', id: `ex-e-${s.id}` });
      const confirmar = el('button', { type: 'button', class: 'aprend__botao aprend__botao--principal' }, 'Confirmar exclusão');
      const cancelar = el('button', { type: 'button', class: 'aprend__botao' }, 'Cancelar');
      const caixa = el('div', { class: 'aprend__form' }, el('p', {}, texto));
      if (s.origem === 'automatica' && s.eventos.length) {
        caixa.append(el('label', { class: 'aprend__confirma', htmlFor: marca.id }, marca,
          'Também desconsiderar as respostas e conclusões desta sessão (elas deixam de contar nos estados e nos dias de estudo).'));
      }
      caixa.append(el('div', { class: 'aprend__acoes' }, confirmar, cancelar));
      confirmar.addEventListener('click', () => {
        const ok = excluirSessao(s, { ignorarEvidencias: marca.checked });
        recomecar(ok ? 'Sessão excluída.' : 'Não foi possível salvar neste navegador.');
      });
      cancelar.addEventListener('click', () => fechar(excluir));
      painel.replaceChildren(caixa);
      confirmar.focus();
    });
    return li;
  };

  // ---- estudo fora do site
  const form = q<HTMLFormElement>('[data-externo-form]');
  const erro = q('[data-externo-erro]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(form);
    const minutos = Number(dados.get('minutos'));
    const campo = form.elements.namedItem('minutos') as HTMLInputElement;
    if (!registrarEstudoExterno({ minutos, assunto: String(dados.get('assunto') ?? ''), objetivo: String(dados.get('objetivo') ?? '') })) {
      erro.hidden = false;
      erro.textContent = 'Informe um número de minutos entre 1 e 600.';
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
      return;
    }
    erro.hidden = true;
    campo.removeAttribute('aria-invalid');
    form.reset();
    recomecar('Estudo registrado.');
  });

  desenhar();
}
