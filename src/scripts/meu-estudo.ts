/* ---------------------------------------------------------------------------
 * Página /meu-estudo: revisão de hoje, dias de estudo, progresso por matéria, registro de estudo
 * fora do site, histórico editável e dados.
 *
 * Nada aqui é guardado: tudo é calculado na hora do registro de eventos e do progresso das aulas
 * (src/lib/estudo.ts). Apagar um registro ou desmarcar uma aula recalcula tudo.
 * ------------------------------------------------------------------------- */
import { META_DIAS_MAX, META_DIAS_MIN, acoesPorDia, diaLocal, diasSemRegistro, estadoDaAula, historicoDaMeta, inicioDaSemana, mesclarRegistros, nivelDoDia, normalizarMetas, normalizarRegistro, progressoDaSemana, secoesDaAula, somarDias } from '../lib/estudo';
import type { EstadoSecao, Evento, ProgressoMeta } from '../lib/estudo';
import { u } from '../lib/url';
import { carregarIndice } from './busca';
import type { AulaBusca } from './busca';
import { montarBarrasDeRolagem } from './barra-rolagem';
import { toast } from './avisos';
import { confirmarAcao } from './confirmacao';
import { filaDeHoje } from './fila';
import { CHAVE_ANDAMENTO, CHAVE_PROGRESSO, andamentos, vistas } from './progresso';
import type { Andamento } from './progresso';
import { apagarEvento, gravarMetas, gravarPreferencias, gravarRegistro, lerAjustes, lerMetas, lerPreferencias, lerRegistro, registrar } from './registro';
import { mesclarPreferencias, normalizarPreferencias } from '../lib/recomendacao';
import { dataExtensa, escapar, gravar, ler } from './util';

/** O painel de dias mostra sempre os últimos 6 meses (180 dias). */
const PERIODO = 180;
/** Quem fechou o cartão "Revisão de hoje" desta página não o vê mais (a Revisão fica na barra do topo). */
const CHAVE_SEM_REVISAO = 'cdt:estudo-sem-revisao';
const DIAS_POR_PAGINA = 30;
const SELO_ESTADO: Record<EstadoSecao, string> = { firme: 'Firme', acertou: 'Acertou', rever: 'Rever' };

const diaDe = (dia: string) => new Date(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10), 12);
const nomeDoDia = (dia: string) => diaDe(dia).toLocaleDateString('pt-BR', { weekday: 'long' });
const dm = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const somar = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

let encerrar: AbortController | null = null;

export async function montarEstudo() {
  const raiz = document.querySelector<HTMLElement>('[data-estudo]');
  if (!raiz) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;

  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const bloco = (nome: string) => q(`[data-bloco="${nome}"]`);

  const indice = await carregarIndice();
  if (!raiz.isConnected) return;
  const porId = new Map(indice.map((a) => [a.id, a]));
  const nomeDaAula = (id: string) => porId.get(id)?.t ?? id.split('/').pop() ?? id;

  let paginaHistorico = DIAS_POR_PAGINA;
  const diasAbertos = new Set<string>();

  /* ------------------------------------------------- revisão de hoje */
  function desenharRevisao() {
    if (ler<boolean>(CHAVE_SEM_REVISAO, false)) {
      bloco('revisao').innerHTML = '';
      return;
    }
    const { fila, temConcluidas } = filaDeHoje(indice);
    const semana = Date.now() - 7 * 24 * 3600 * 1000;
    const revistas = lerRegistro().eventos.filter((e) => e.k === 'c' && e.t >= semana).length;

    let corpo: string;
    if (!temConcluidas) {
      corpo = `<p class="est-revisao__numero">Ainda sem cartões</p>
        <p class="est-revisao__detalhe">Os cartões de uma aula entram na revisão no dia seguinte a você concluí-la.</p>`;
    } else if (!fila.hoje.length) {
      corpo = `<p class="est-revisao__numero">Nada para revisar hoje</p>
        <p class="est-revisao__detalhe">${fila.proxima ? `Próxima revisão: <strong>${escapar(dataExtensa(fila.proxima))}</strong> · ` : ''}${plural(revistas, 'cartão revisto', 'cartões revistos')} nos últimos 7 dias</p>`;
    } else {
      corpo = `<p class="est-revisao__numero"><strong>${fila.hoje.length}</strong> ${fila.hoje.length === 1 ? 'cartão para hoje' : 'cartões para hoje'}</p>
        <p class="est-revisao__detalhe">${fila.vencidos.length > fila.hoje.length ? `${fila.vencidos.length} na fila no total · ` : ''}${plural(revistas, 'cartão revisto', 'cartões revistos')} nos últimos 7 dias</p>`;
    }
    bloco('revisao').innerHTML = `
      <section class="est-revisao" aria-labelledby="estudo-revisao">
        <span class="est-revisao__icone" aria-hidden="true"><i class="fa-solid fa-repeat"></i></span>
        <div class="est-revisao__corpo">
          <h2 id="estudo-revisao" class="est-revisao__selo">Revisão de hoje</h2>
          ${corpo}
        </div>
        ${fila.hoje.length ? `<a class="est-botao est-botao--revisao" href="${u('/revisao')}">Revisar agora <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>` : ''}
        <button type="button" class="est-revisao__fechar" data-fechar-revisao aria-label="Remover este cartão de Meu estudo" title="Remover este cartão">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </section>`;
  }

  /* -------------------------------------------------------------- dias */
  function desenharDias() {
    const mapa = acoesPorDia(lerRegistro().eventos, vistas());
    const agora = new Date();
    const hoje = diaLocal(agora.getTime());
    const inicio = somar(agora, -(PERIODO - 1));

    let diasComEstudo = 0;
    let acoes = 0;
    for (let i = 0; i < PERIODO; i++) {
      const n = mapa.get(diaLocal(somar(agora, -i).getTime())) ?? 0;
      if (n) {
        diasComEstudo++;
        acoes += n;
      }
    }

    const resumo = `<p class="dias__resumo"><span class="dias__periodo">Últimos 6 meses</span> <span aria-hidden="true">·</span> <strong>${diasComEstudo}</strong> de ${PERIODO} dias com estudo <span aria-hidden="true">·</span> ${plural(acoes, 'ação', 'ações')}</p>`;

    const domingo = somar(inicio, -inicio.getDay());
    const colunas = Math.ceil(((agora.getTime() - domingo.getTime()) / 864e5 + 1) / 7);
    const diaInicio = diaLocal(inicio.getTime());
    // A primeira coluna da grade são os nomes dos dias, para as linhas ficarem sempre alinhadas.
    let celulas = ['', 'seg', '', 'qua', '', 'sex', ''].map((n) => `<span class="dias__nome">${n}</span>`).join('');
    let meses = '';
    const resumoSemanas: string[] = [];
    for (let c = 0; c < colunas; c++) {
      const d0 = somar(domingo, c * 7);
      if (c === 0 || d0.getDate() <= 7) {
        const mes = d0.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        meses += `<span style="grid-column: ${c + 2}">${escapar(mes)}</span>`;
      }
      let diasSemana = 0;
      let acoesSemana = 0;
      for (let r = 0; r < 7; r++) {
        const data = somar(domingo, c * 7 + r);
        const dia = diaLocal(data.getTime());
        if (dia < diaInicio || dia > hoje) {
          celulas += '<span class="dias__dia dias__dia--fora"></span>';
          continue;
        }
        const n = mapa.get(dia) ?? 0;
        if (n) {
          diasSemana++;
          acoesSemana += n;
        }
        celulas += `<span class="dias__dia" data-n="${nivelDoDia(n)}" title="${escapar(dataExtensa(dia, true))}: ${plural(n, 'ação', 'ações')}"></span>`;
      }
      resumoSemanas.push(`<li>Semana de ${escapar(dm(d0))}: ${plural(diasSemana, 'dia com estudo', 'dias com estudo')}, ${plural(acoesSemana, 'ação', 'ações')}.</li>`);
    }
    const min = colunas > 27 ? '0.55rem' : '0.8rem';
    // O calendário é visual; a mesma informação, semana a semana, fica para o leitor de tela.
    const visual = `
      <div class="cal" data-rolagem="x" style="--cols: ${colunas}; --min: ${min};">
        <div class="cal__rolagem" data-rolagem-area data-cal-rolagem tabindex="0" role="group" aria-label="Calendário de dias de estudo: role para os lados para ver as semanas mais antigas">
          <div class="cal__meses" aria-hidden="true">${meses}</div>
          <div class="dias" aria-hidden="true">${celulas}</div>
        </div>
      </div>
      <ol class="apenas-leitor">${resumoSemanas.reverse().join('')}</ol>`;

    bloco('dias').innerHTML = `
      ${resumo}
      ${visual}
      <p class="dias__legenda" aria-hidden="true">Menos
        <span class="dias__dia" data-n="0"></span><span class="dias__dia" data-n="1"></span><span class="dias__dia" data-n="2"></span><span class="dias__dia" data-n="3"></span><span class="dias__dia" data-n="4"></span>
      Mais</p>
      <p class="est-nota">Cada quadrado é um dia. A cor mostra quantas ações houve: aulas concluídas, questões corrigidas, cartões revistos e estudos fora do site. Dia sem cor é “sem registro”, não é falha.</p>`;
    // O mais recente fica à vista quando o calendário é mais largo que a tela.
    const rolagem = bloco('dias').querySelector<HTMLElement>('[data-cal-rolagem]');
    if (rolagem) rolagem.scrollLeft = rolagem.scrollWidth;
  }

  /* ---------------------------------------------------------- matérias */
  function desenharMaterias() {
    const eventos = lerRegistro().eventos;
    const feitas = vistas();
    const grupos = new Map<string, { nome: string; grupo: string; aulas: AulaBusca[] }>();
    for (const a of indice) {
      const g = grupos.get(a.s) ?? { nome: a.m, grupo: a.a, aulas: [] };
      g.aulas.push(a);
      grupos.set(a.s, g);
    }

    const cartoes: string[] = [];
    let semAtividade = 0;
    for (const g of grupos.values()) {
      const concluidas = g.aulas.filter((a) => feitas[a.id]).length;
      let firmes = 0;
      let reverTotal = 0;
      const linhas: string[] = [];
      for (const a of g.aulas) {
        const secoes = secoesDaAula(eventos, a.id);
        const { estado, rever } = estadoDaAula({ eventos, aula: a.id, vista: Boolean(feitas[a.id]) });
        if (!feitas[a.id] && !secoes.length) continue;
        firmes += secoes.filter((s) => s.estado === 'firme').length;
        reverTotal += rever.length;
        const situacao =
          estado === 'rever'
            ? `<span class="mat-aula__estado mat-aula__estado--rever">${plural(rever.length, 'seção a rever', 'seções a rever')}</span>`
            : `<span class="mat-aula__estado">${feitas[a.id] ? 'concluída' : 'em andamento'}</span>`;
        linhas.push(`
          <li class="mat-aula">
            <a class="mat-aula__titulo" href="${escapar(a.h)}">${escapar(a.t)}</a>${situacao}
            ${rever.length ? `<p class="mat-aula__rever">${rever.map((r) => escapar(r.rotulo)).join(' · ')}</p>` : ''}
          </li>`);
      }
      if (!concluidas && !linhas.length) {
        semAtividade++;
        continue;
      }
      const pct = Math.round((concluidas / g.aulas.length) * 100);
      const meta = [
        reverTotal ? `<span class="mat__rever">${reverTotal} a rever</span>` : '',
        firmes ? `<span>${plural(firmes, 'seção firme', 'seções firmes')}</span>` : '',
      ]
        .filter(Boolean)
        .join('');
      cartoes.push(`
        <li class="mat">
          <details class="mat__det" ${reverTotal ? 'open' : ''}>
            <summary class="mat__cabeca">
              <span class="mat__id"><strong>${escapar(g.nome)}</strong><small>${escapar(g.grupo)}</small></span>
              <span class="mat__num">${concluidas} de ${g.aulas.length} ${g.aulas.length === 1 ? 'aula' : 'aulas'}</span>
              <span class="mat__seta" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
              <span class="mat__barra" aria-hidden="true"><i style="width:${pct}%"></i></span>
              ${meta ? `<span class="mat__meta">${meta}</span>` : ''}
            </summary>
            <ul class="mat__aulas">${linhas.join('')}</ul>
          </details>
        </li>`);
    }

    bloco('materias').innerHTML = cartoes.length
      ? `<ul class="mat__lista">${cartoes.join('')}</ul>${semAtividade ? `<p class="est-nota">Outras ${semAtividade} matérias ainda sem atividade.</p>` : ''}`
      : '<p class="est-vazio">Quando você concluir aulas e corrigir questões, o resumo de cada matéria aparece aqui.</p>';
  }

  /* --------------------------------------------------------- histórico */
  const RESPOSTAS = ['não lembrei', 'com dificuldade', 'lembrei'];

  function descrever(e: Evento): string {
    if (e.k === 'q') return `Questão ${e.n + 1} de “${nomeDaAula(e.a)}”: ${e.ok ? 'acertou' : 'errou'}`;
    if (e.k === 'c') {
      const [aula, n] = e.c.split('#');
      return `Cartão ${n} de “${nomeDaAula(aula)}”: ${RESPOSTAS[e.r]}${e.rv ? ' · aula marcada para rever' : ''}`;
    }
    return `Fora do site · ${e.m}${e.tx ? ': ' + e.tx : ''}${e.min ? ` (${e.min} min, informado por você)` : ''}`;
  }

  function desenharHistorico() {
    const eventos = lerRegistro().eventos;
    const feitas = vistas();
    type Linha = { t: number; texto: string; id?: string; tipo: 'q' | 'c' | 'x' | 'a' };
    const linhas: Linha[] = eventos.map((e) => ({ t: e.t, texto: descrever(e), id: e.id, tipo: e.k }));
    for (const [aula, t] of Object.entries(feitas)) {
      if (porId.has(aula) && Number.isFinite(t)) linhas.push({ t, texto: `Aula concluída: “${nomeDaAula(aula)}”`, tipo: 'a' });
    }
    const alvo = bloco('historico');
    if (!linhas.length) {
      alvo.innerHTML = '<p class="est-vazio">Ainda não há registros. Corrija as questões de uma aula ou revise um cartão e eles aparecem aqui.</p>';
      return;
    }

    const porDia = new Map<string, Linha[]>();
    for (const l of linhas.sort((a, b) => b.t - a.t)) {
      const d = diaLocal(l.t);
      porDia.set(d, [...(porDia.get(d) ?? []), l]);
    }
    const dias = [...porDia.entries()];
    const visiveis = dias.slice(0, paginaHistorico);

    const resumoDoDia = (ls: Linha[]) => {
      const n = (t: Linha['tipo']) => ls.filter((l) => l.tipo === t).length;
      return [
        n('q') ? plural(n('q'), 'questão', 'questões') : '',
        n('c') ? plural(n('c'), 'cartão', 'cartões') : '',
        n('a') ? plural(n('a'), 'aula concluída', 'aulas concluídas') : '',
        n('x') ? plural(n('x'), 'estudo fora', 'estudos fora') : '',
      ]
        .filter(Boolean)
        .join(' · ');
    };

    const rolagemAnterior = alvo.querySelector<HTMLElement>('.hist')?.scrollTop ?? 0;
    alvo.innerHTML = `
      <div class="hist-host" data-rolagem>
        <div class="hist" data-rolagem-area tabindex="0" role="region" aria-label="Histórico por dia: role para ver os dias mais antigos">
          ${visiveis
            .map(([dia, ls]) => {
              const lista = `<ul class="hist__lista">
                ${ls
                  .map(
                    (l) => `
                  <li class="hist__item">
                    <span class="hist__hora">${new Date(l.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span class="hist__texto">${escapar(l.texto)}</span>
                    ${
                      l.id
                        ? `<button type="button" class="est-apagar" data-apagar="${escapar(l.id)}" aria-label="Apagar registro: ${escapar(l.texto)}" title="Apagar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg></button>`
                        : '<span class="hist__nota">desmarque na aula</span>'
                    }
                  </li>`
                  )
                  .join('')}
              </ul>`;
              return `
            <details class="hist__dia" data-dia="${dia}" ${diasAbertos.has(dia) ? 'open' : ''}>
              <summary class="hist__cabeca">
                <span class="hist__data">${escapar(dataExtensa(dia, true))}</span>
                <span class="hist__resumo">${escapar(resumoDoDia(ls))}</span>
                <span class="hist__contagem">${plural(ls.length, 'registro', 'registros')}</span>
                <span class="hist__seta" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
              </summary>
              <div class="hist__corpo">${lista}</div>
            </details>`;
            })
            .join('')}
          ${dias.length > visiveis.length ? `<p class="hist__mais"><button type="button" class="est-botao" data-mais>Mostrar mais dias</button></p>` : ''}
        </div>
      </div>`;
    const area = alvo.querySelector<HTMLElement>('.hist');
    if (area) area.scrollTop = rolagemAnterior;
  }

  /* ------------------------------------------------------------ dados */
  function desenharDados() {
    const n = lerRegistro().eventos.length;
    const aulas = Object.keys(vistas()).length;
    q('[data-dados-resumo]').textContent = `Agora: ${plural(n, 'registro', 'registros')} e ${plural(aulas, 'aula concluída', 'aulas concluídas')}.`;
  }

  /* ------------------------------------------------------ metas da semana */
  const nomeDaMateria = new Map(indice.map((a) => [a.s, a.m]));
  const nomeMateria = (chave: string) => nomeDaMateria.get(chave) ?? chave.split('/')[1];

  function textoDaSituacao(m: ProgressoMeta): string {
    if (m.situacao === 'cumprida') return 'Meta da semana cumprida.';
    if (m.situacao === 'fora-de-alcance') return `Esta semana não dá mais para chegar a ${plural(m.meta, 'dia', 'dias')}; a próxima começa na segunda.`;
    if (m.situacao === 'apertada') return `Faltam ${plural(m.faltam, 'dia', 'dias')} e restam ${plural(m.restantes, 'dia', 'dias')} na semana, contando hoje.`;
    return `Faltam ${plural(m.faltam, 'dia', 'dias')}; restam ${plural(m.restantes, 'dia', 'dias')} na semana, contando hoje.`;
  }

  function desenharMetas() {
    const metas = lerMetas();
    const hoje = diaLocal(Date.now());
    const { eventos } = lerRegistro();
    const feitas = vistas();
    const lista = progressoDaSemana({ eventos, vistas: feitas, metas, hoje });
    const ini = inicioDaSemana(hoje);

    const select = q<HTMLSelectElement>('[data-metas-materia]');
    if (!select.options.length) {
      const grupos = new Map<string, Map<string, string>>();
      for (const a of indice) {
        const g = grupos.get(a.a) ?? new Map<string, string>();
        g.set(a.s, a.m);
        grupos.set(a.a, g);
      }
      select.innerHTML = [...grupos]
        .map(([grupo, mats]) => {
          const opcoes = [...mats]
            .sort((x, y) => x[1].localeCompare(y[1], 'pt-BR'))
            .map(([chave, nome]) => `<option value="${escapar(chave)}">${escapar(nome)}</option>`)
            .join('');
          return `<optgroup label="${escapar(grupo)}">${opcoes}</optgroup>`;
        })
        .join('');
    }

    if (!lista.length) {
      bloco('metas').innerHTML = '<p class="metas__vazio">Você ainda não definiu metas. Elas são opcionais: use o formulário abaixo se quiser acompanhar uma matéria.</p>';
      return;
    }

    const itens = lista.map((m) => {
      const quadrados = Array.from({ length: 7 }, (_, i) => {
        const d = somarDias(ini, i);
        const fez = m.dias.includes(d);
        return `<li class="meta__dia" data-feito="${fez}"><span class="apenas-leitor">${nomeDoDia(d)}: ${fez ? 'com ação' : 'sem ação'}</span><span aria-hidden="true">${nomeDoDia(d)[0].toUpperCase()}</span></li>`;
      }).join('');
      const hist = historicoDaMeta({ eventos, vistas: feitas, materia: m.materia, meta: m.meta, hoje });
      const linhas = hist
        .slice()
        .reverse()
        .map((sem) => `<tr><th scope="row">${escapar(dm(diaDe(sem.inicio)))}</th><td>${plural(sem.feito, 'dia', 'dias')}</td><td>${sem.emAndamento ? 'em andamento' : sem.cumpriu ? 'meta cumprida' : 'abaixo da meta'}</td></tr>`)
        .join('');
      const nome = nomeMateria(m.materia);
      return `
        <li class="meta" data-situacao="${m.situacao}">
          <div class="meta__topo">
            <h3 class="meta__nome">${escapar(nome)}</h3>
            <p class="meta__conta">${m.feito} de ${plural(m.meta, 'dia', 'dias')}</p>
          </div>
          <ol class="meta__dias" aria-label="Semana de ${escapar(dm(diaDe(ini)))}: dias com ação em ${escapar(nome)}">${quadrados}</ol>
          <p class="meta__situacao">${escapar(textoDaSituacao(m))}</p>
          <div class="meta__acoes">
            <button type="button" class="est-botao" data-meta-alterar="${escapar(m.materia)}">Alterar</button>
            <button type="button" class="est-botao" data-meta-remover="${escapar(m.materia)}">Remover</button>
          </div>
          <details class="meta__hist">
            <summary>Últimas 8 semanas</summary>
            <table class="meta__tabela">
              <caption class="apenas-leitor">Dias com ação em ${escapar(nome)} por semana</caption>
              <thead><tr><th scope="col">Semana de</th><th scope="col">Dias</th><th scope="col">Resultado</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </details>
        </li>`;
    });

    const sem = diasSemRegistro({ eventos, vistas: feitas, hoje });
    const aviso = sem.length
      ? `<p class="metas__aviso">Dias dos últimos 7 sem nenhum registro: ${sem.map((d) => nomeDoDia(d)).join(', ')}. Dia sem registro não é falha, é só um dia sem quadrado.</p>`
      : '';
    bloco('metas').innerHTML = `<ul class="metas__lista">${itens.join('')}</ul>${aviso}`;
  }

  const erroMeta = q('[data-metas-erro]');
  const okMeta = q('[data-metas-ok]');
  const avisoMeta = (texto: string, erro = false) => {
    erroMeta.hidden = !erro;
    erroMeta.textContent = erro ? texto : '';
    okMeta.textContent = '';
    if (!erro) window.setTimeout(() => (okMeta.textContent = texto), 30);
  };

  q<HTMLFormElement>('[data-metas-form]').addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      const materia = q<HTMLSelectElement>('[data-metas-materia]').value;
      const campo = q<HTMLInputElement>('#meta-dias');
      const dias = Number(campo.value);
      const metas = lerMetas();
      if (!Number.isInteger(dias) || dias < META_DIAS_MIN || dias > META_DIAS_MAX) {
        campo.setAttribute('aria-invalid', 'true');
        return avisoMeta(`Escolha de ${META_DIAS_MIN} a ${META_DIAS_MAX} dias por semana.`, true);
      }
      campo.removeAttribute('aria-invalid');
      const nova = { ...metas, [materia]: dias };
      if (!(materia in normalizarMetas(nova))) {
        return avisoMeta('O caderno guarda até 12 metas. Remova uma para criar outra.', true);
      }
      if (!gravarMetas(nova)) return avisoMeta('Não foi possível guardar a meta neste navegador.', true);
      desenharMetas();
      avisoMeta(`Meta definida: ${nomeMateria(materia)}, ${plural(dias, 'dia', 'dias')} por semana.`);
    },
    { signal }
  );

  bloco('metas').addEventListener(
    'click',
    (e) => {
      const alvo = e.target as HTMLElement;
      const alterar = alvo.closest<HTMLElement>('[data-meta-alterar]');
      if (alterar) {
        const materia = alterar.dataset.metaAlterar!;
        q<HTMLSelectElement>('[data-metas-materia]').value = materia;
        const campo = q<HTMLInputElement>('#meta-dias');
        campo.value = String(lerMetas()[materia] ?? campo.value);
        campo.focus();
        return;
      }
      const remover = alvo.closest<HTMLElement>('[data-meta-remover]');
      if (!remover) return;
      const { [remover.dataset.metaRemover!]: _, ...resto } = lerMetas();
      gravarMetas(resto);
      desenharMetas();
      q<HTMLElement>('#estudo-metas').focus();
      toast('Meta removida. O histórico de estudo continua igual.');
    },
    { signal }
  );

  function desenharTudo() {
    desenharRevisao();
    desenharDias();
    desenharMetas();
    desenharMaterias();
    desenharHistorico();
    desenharDados();
    // As listas dos dias e o campo de leitura ganham a barra de rolagem do caderno.
    montarBarrasDeRolagem();
  }

  /* ------------------------------------------------------------ ações */
  bloco('revisao').addEventListener(
    'click',
    (e) => {
      if (!(e.target as HTMLElement).closest('[data-fechar-revisao]')) return;
      gravar(CHAVE_SEM_REVISAO, true);
      desenharRevisao();
      toast('Cartão removido. A Revisão continua na barra do topo.');
    },
    { signal }
  );

  bloco('historico').addEventListener(
    'toggle',
    (e) => {
      const d = e.target as HTMLElement;
      if (d instanceof HTMLDetailsElement && d.dataset.dia) {
        if (d.open) diasAbertos.add(d.dataset.dia);
        else diasAbertos.delete(d.dataset.dia);
      }
    },
    { capture: true, signal }
  );

  bloco('historico').addEventListener(
    'click',
    async (e) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('[data-mais]')) {
        paginaHistorico += DIAS_POR_PAGINA;
        desenharHistorico();
        montarBarrasDeRolagem();
        return;
      }
      const botao = alvo.closest<HTMLElement>('[data-apagar]');
      if (!botao) return;
      const id = botao.dataset.apagar!;
      const evento = lerRegistro().eventos.find((x) => x.id === id);
      if (!evento) return;
      const r = await confirmarAcao({
        titulo: 'Apagar este registro?',
        texto: `${descrever(evento)}. Apagar recalcula as seções a rever, a fila de revisão e os dias de estudo.`,
        confirmar: 'Apagar registro',
      });
      if (!r.ok) return;
      apagarEvento(id);
      desenharTudo();
      toast('Registro apagado', 'circle-check');
      q('#estudo-historico').focus();
    },
    { signal }
  );

  // Estudo fora do site: só a matéria é obrigatória; o resto é opcional.
  const fora = q<HTMLFormElement>('[data-fora]');
  const erro = q('[data-fora-erro]');
  const foraOk = q('[data-fora-ok]');
  // Sugestões de matéria: as que já têm atividade primeiro. Clicar preenche o campo.
  const comAtividade = new Set(indice.filter((a) => vistas()[a.id]).map((a) => a.m));
  const sugestoesDeMateria = [...new Set([...comAtividade, ...indice.map((a) => a.m)])].slice(0, 5);
  q('[data-fora-lista]').innerHTML = sugestoesDeMateria
    .map((m) => `<button type="button" class="fora__sugestao" data-sugestao="${escapar(m)}">${escapar(m)}</button>`)
    .join('');
  q('[data-fora-lista]').addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sugestao]');
      if (!b) return;
      const campo = q<HTMLInputElement>('#fora-materia');
      campo.value = b.dataset.sugestao!;
      campo.removeAttribute('aria-invalid');
      erro.hidden = true;
      q<HTMLInputElement>('#fora-texto').focus();
    },
    { signal }
  );
  fora.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      const dados = new FormData(fora);
      const materia = String(dados.get('materia') ?? '').trim();
      const texto = String(dados.get('texto') ?? '').trim();
      const min = Number(dados.get('min'));
      if (!materia) {
        erro.textContent = 'Diga a matéria ou o assunto que você estudou.';
        erro.hidden = false;
        q<HTMLInputElement>('#fora-materia').setAttribute('aria-invalid', 'true');
        q<HTMLInputElement>('#fora-materia').focus();
        return;
      }
      if (dados.get('min') && !(min >= 1 && min <= 1440)) {
        erro.textContent = 'Os minutos precisam ficar entre 1 e 1440, ou o campo pode ficar vazio.';
        erro.hidden = false;
        q<HTMLInputElement>('#fora-min').focus();
        return;
      }
      erro.hidden = true;
      q<HTMLInputElement>('#fora-materia').removeAttribute('aria-invalid');
      const ok = registrar({
        k: 'x',
        m: materia.slice(0, 80),
        ...(texto ? { tx: texto.slice(0, 200) } : {}),
        ...(min >= 1 && min <= 1440 ? { min: Math.round(min) } : {}),
      });
      if (!ok) {
        erro.textContent = 'Não foi possível salvar neste navegador.';
        erro.hidden = false;
        return;
      }
      fora.reset();
      foraOk.textContent = '';
      window.setTimeout(() => (foraOk.textContent = 'Estudo registrado.'), 30);
      toast('Estudo registrado', 'circle-check');
      desenharTudo();
    },
    { signal }
  );

  // Levar os dados: baixar e carregar um arquivo (a única forma de mover o histórico entre aparelhos).
  const dadosStatus = q('[data-dados-status]');
  const avisarDados = (texto: string, erroDeArquivo = false) => {
    dadosStatus.dataset.erro = String(erroDeArquivo);
    dadosStatus.textContent = '';
    window.setTimeout(() => (dadosStatus.textContent = texto), 30);
    toast(texto, erroDeArquivo ? 'triangle-exclamation' : 'circle-check');
  };
  q('[data-baixar]').addEventListener(
    'click',
    () => {
      const pacote = {
        app: 'caderno-de-estudos',
        v: 1,
        exportadoEm: new Date().toISOString(),
        registro: lerRegistro(),
        progresso: vistas(),
        andamento: andamentos(),
        ajustes: lerAjustes(),
        metas: lerMetas(),
        recomendacao: lerPreferencias(),
      };
      const arquivo = new Blob([JSON.stringify(pacote, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(arquivo);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caderno-de-estudos-${diaLocal(Date.now())}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisarDados('Cópia gerada: confira a pasta de downloads.');
    },
    { signal }
  );

  async function importar(arquivo: File) {
    if (arquivo.size > 5_000_000) return avisarDados('Esse arquivo é grande demais para ser do caderno.', true);
    let dados: any;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      return avisarDados('Esse arquivo não é um JSON válido.', true);
    }
    if (dados?.app !== 'caderno-de-estudos') return avisarDados('Esse arquivo não é de dados do caderno de estudos.', true);

    const r = await confirmarAcao({
      titulo: 'Juntar os dados do arquivo?',
      texto: 'Os registros e as aulas concluídas do arquivo são somados aos deste navegador. Nada do que já existe aqui é apagado.',
      confirmar: 'Juntar dados',
    });
    if (!r.ok) return;

    const antes = lerRegistro();
    const junto = mesclarRegistros(antes, normalizarRegistro(dados.registro));
    gravarRegistro(junto);

    const prog = vistas();
    for (const [id, t] of Object.entries(dados.progresso ?? {})) {
      if (/^(enem|escolar|ds)\/[a-z0-9/_-]+$/.test(id) && Number.isFinite(t) && !prog[id]) prog[id] = t as number;
    }
    gravar(CHAVE_PROGRESSO, prog);

    const and = andamentos();
    for (const [id, a] of Object.entries((dados.andamento ?? {}) as Record<string, Andamento>)) {
      if (!/^(enem|escolar|ds)\/[a-z0-9/_-]+$/.test(id) || !a || !Number.isFinite(a.l)) continue;
      const atual = and[id] ?? { l: 0, q: 0, z: 0 };
      and[id] = {
        l: Math.min(100, Math.max(atual.l, Math.round(a.l))),
        q: a.q || atual.q ? 1 : 0,
        z: a.z || atual.z ? 1 : 0,
        ...(a.t || atual.t ? { t: Math.max(a.t ?? 0, atual.t ?? 0) } : {}),
      };
    }
    gravar(CHAVE_ANDAMENTO, and);

    // Metas: as do arquivo entram só onde a matéria ainda não tem meta aqui.
    gravarMetas({ ...normalizarMetas(dados.metas), ...lerMetas() });
    gravarPreferencias(mesclarPreferencias(lerPreferencias(), normalizarPreferencias(dados.recomendacao)));

    desenharTudo();
    avisarDados(`Dados juntados: ${plural(junto.eventos.length - antes.eventos.length, 'registro novo', 'registros novos')}.`);
  }

  const entrada = q<HTMLInputElement>('[data-carregar]');
  q('[data-carregar-botao]').addEventListener('click', () => entrada.click(), { signal });
  entrada.addEventListener(
    'change',
    () => {
      const arquivo = entrada.files?.[0];
      entrada.value = '';
      if (arquivo) void importar(arquivo);
    },
    { signal }
  );
  // Arrastar o arquivo para o quadro também carrega.
  const solta = q('[data-solta]');
  solta.addEventListener('dragover', (e) => {
    e.preventDefault();
    solta.dataset.sobre = 'true';
  }, { signal });
  solta.addEventListener('dragleave', () => delete solta.dataset.sobre, { signal });
  solta.addEventListener(
    'drop',
    (e) => {
      e.preventDefault();
      delete solta.dataset.sobre;
      const arquivo = e.dataTransfer?.files?.[0];
      if (arquivo) void importar(arquivo);
    },
    { signal }
  );

  desenharTudo();
  q('[data-estudo-status]').hidden = true;
  q('[data-estudo-corpo]').hidden = false;
  // O calendário foi desenhado com a página ainda escondida (largura 0): só agora dá para deixar o mais recente à vista.
  const cal = raiz.querySelector<HTMLElement>('[data-cal-rolagem]');
  if (cal) cal.scrollLeft = cal.scrollWidth;
}
