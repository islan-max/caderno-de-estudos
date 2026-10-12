/* ---------------------------------------------------------------------------
 * Bloco "Hoje" da página inicial: até três ações, cada uma com o motivo.
 * ------------------------------------------------------------------------- */
import { gravarPerfil, lerEventos, lerPerfil } from '../lib/aprendizagem/armazem';
import { diaDaData, vigentes } from '../lib/aprendizagem/eventos';
import { aulaPrecisaRevisar } from '../lib/aprendizagem/jornada';
import { planoDeHoje, type Acao } from '../lib/aprendizagem/hoje';
import { contarCartoes } from '../lib/aprendizagem/revisao';
import { normalizarPerfil, tamanhoDaFila } from '../lib/aprendizagem/perfil';
import { toast } from './avisos';
import { carregarIndice } from './busca';
import { CHAVE_ULTIMA, vistas } from './progresso';
import type { Ultima } from './progresso';
import { ler, base } from './util';

/** Cartões de revisão (só os ids), para contar vencidos e novos no Hoje. Falha de rede = sem cartões. */
async function carregarIdsDeCartoes(): Promise<string[]> {
  try {
    const r = await fetch(`${base()}cartoes.json`.replace(/\/{2,}/g, '/'));
    return ((await r.json()) as { id: string }[]).map((c) => c.id);
  } catch {
    return [];
  }
}

/**
 * Bloco "Hoje": no máximo três ações, cada uma com o motivo escrito (regras em lib/aprendizagem/hoje.ts).
 * Só a aula tem "Trocar". O que ficou para trás volta sozinho: não há agenda para atrasar.
 */
export async function montarHoje() {
  const bloco = document.querySelector<HTMLElement>('[data-hoje]');
  if (!bloco) return;
  const lista = bloco.querySelector<HTMLElement>('[data-hoje-lista]')!;
  const form = bloco.querySelector<HTMLFormElement>('[data-perfil-form]');
  const hrefRevisao = `${base()}revisao/`.replace(/\/{2,}/g, '/');

  const dados = await carregarIndice();
  const cartoes = await carregarIdsDeCartoes();

  const desenhar = () => {
    const perfil = lerPerfil();
    const eventos = vigentes(lerEventos());
    const hoje = diaDaData(new Date());
    const progresso = vistas();
    const ultima = ler<Ultima>(CHAVE_ULTIMA, {});
    const { vencidos, novos } = contarCartoes(eventos, cartoes, hoje);
    const comEvento = new Set(eventos.map((e) => e.aulaId).filter(Boolean));
    const acoes = planoDeHoje({
      aulas: dados.map((a) => ({ id: a.id, t: a.t, href: a.h, s: a.s, p: a.p })),
      concluidas: new Set(Object.keys(progresso)),
      ultimaId: ultima.id,
      prioridades: perfil.prioridades,
      vencidos,
      novos,
      hrefRevisao,
      aulasParaRever: dados.filter((a) => comEvento.has(a.id) && aulaPrecisaRevisar(eventos, a.id, hoje)).map((a) => a.id),
    });

    lista.replaceChildren();
    if (acoes.length === 0) {
      acoes.push({
        tipo: 'aula',
        titulo: 'Você concluiu as aulas disponíveis do ENEM.',
        motivo: 'A trilha continua mostrando os conteúdos que ainda estão em preparação.',
        rotulo: 'Ver a trilha',
        href: `${base()}enem`.replace(/\/{2,}/g, '/'),
        longa: false,
      });
    }
    for (const acao of acoes) lista.append(itemDeAcao(acao));
    bloco.hidden = false;
    document.querySelector<HTMLElement>('[data-continuar]')?.setAttribute('hidden', '');
  };

  const itemDeAcao = (acao: Acao) => {
    const li = document.createElement('li');
    li.className = 'hoje__item';
    const titulo = document.createElement('h3');
    titulo.className = 'hoje__titulo';
    const motivo = document.createElement('p');
    motivo.className = 'hoje__motivo';
    const link = document.createElement('a');
    link.className = 'hoje__acao';
    const mostrar = (a: Acao) => {
      titulo.textContent = a.titulo;
      motivo.textContent = a.motivo;
      link.textContent = a.rotulo;
      link.href = a.href;
    };
    mostrar(acao);
    const acoes = document.createElement('div');
    acoes.className = 'hoje__botoes';
    acoes.append(link);
    const outras = acao.alternativas ?? [];
    if (outras.length > 1) {
      let atual = 0;
      const trocar = document.createElement('button');
      trocar.type = 'button';
      trocar.className = 'hoje__trocar';
      trocar.textContent = 'Trocar aula';
      trocar.addEventListener('click', () => {
        atual = (atual + 1) % outras.length;
        mostrar(outras[atual]);
      });
      acoes.append(trocar);
    }
    li.append(titulo, motivo, acoes);
    return li;
  };

  desenhar();

  if (!form) return;
  const perfil = lerPerfil();
  const selects = [...form.querySelectorAll<HTMLSelectElement>('select[name="prioridade"]')];
  selects.forEach((s, i) => { s.value = perfil.prioridades[i] ?? ''; });
  (form.elements.namedItem('ritmo') as HTMLSelectElement).value = String(perfil.ritmo);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const novo = normalizarPerfil({
      prioridades: selects.map((s) => s.value).filter(Boolean),
      ritmo: Number((form.elements.namedItem('ritmo') as HTMLSelectElement).value),
    });
    if (gravarPerfil(novo)) {
      desenhar();
      toast(`Preferências salvas. Cartões por sessão: ${tamanhoDaFila(novo)}.`, 'check');
    } else {
      toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
    }
  });
}
