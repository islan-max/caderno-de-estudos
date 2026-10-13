/* ---------------------------------------------------------------------------
 * Progresso das aulas: vistas, andamento, última aula e o zerar tudo.
 * ------------------------------------------------------------------------- */
import { estadoDaAula } from '../lib/estudo';
import type { EstadoAula } from '../lib/estudo';
import { toast } from './avisos';
import { confirmarAcao } from './confirmacao';
import { restaurarAcessibilidade } from './preferencias';
import { apagarRegistro, lerRegistro } from './registro';
import { ler, gravar, movimentoReduzido } from './util';

export const CHAVE_PROGRESSO = 'cdt:progresso';

/** Chave antiga (card "continuar de onde parou", substituído pelo Hoje): só é apagada ao zerar. */
const CHAVE_ULTIMA = 'cdt:ultima';

export const CHAVE_ANDAMENTO = 'cdt:andamento';

/** Quanto de cada aula já foi feito: leitura (0 a 100), se as questões foram respondidas e se a
 *  aula tem questões. A aula só conclui com tudo; sem questões, a leitura vale 100%. */
export interface Andamento {
  l: number;
  q: number;
  z: number;
  /** Quando foi aberta pela última vez (ms). */
  t?: number;
}
/** Parte do total que as questões respondidas valem (fixa). A leitura vale o resto. */

const PESO_QUESTOES = 20;

export function andamentos(): Record<string, Andamento> {
  return ler<Record<string, Andamento>>(CHAVE_ANDAMENTO, {});
}

export function percentualDaAula(a?: Andamento): number {
  if (!a) return 0;
  const bruto = a.z ? (a.l * (100 - PESO_QUESTOES)) / 100 + (a.q ? PESO_QUESTOES : 0) : a.l;
  return Math.min(100, Math.round(bruto));
}

type Progresso = Record<string, number>;

export async function zerarProgresso() {
  // Apaga dados do usuário sem volta: pede confirmação (WCAG 3.3.4).
  const r = await confirmarAcao({
    titulo: 'Zerar o progresso?',
    texto:
      'As aulas que você marcou como vistas, o andamento de cada uma e o histórico de respostas, revisões e estudos fora do site voltam ao zero neste navegador. Isso não pode ser desfeito.',
    confirmar: 'Zerar progresso',
    extra: 'Restaurar também os ajustes de acessibilidade (tamanho do texto, contraste etc.) ao padrão',
  });
  if (!r.ok) return;
  if (!gravar(CHAVE_PROGRESSO, {})) {
    toast('Não foi possível salvar neste navegador', 'triangle-exclamation');
    return;
  }
  if (r.extra) restaurarAcessibilidade();
  try {
    localStorage.removeItem(CHAVE_ULTIMA);
    localStorage.removeItem(CHAVE_ANDAMENTO);
  } catch {}
  apagarRegistro();
  refletirProgresso();
  toast('Progresso zerado', 'rotate-left');
  document.querySelectorAll<HTMLElement>('[data-recarrega-progresso]').forEach((el) => {
    el.dataset.recarrega = String(Date.now());
  });
  window.setTimeout(() => location.reload(), 600);
}

export function vistas(): Progresso {
  return ler<Progresso>(CHAVE_PROGRESSO, {});
}

export function marcar(id: string, vista: boolean) {
  const p = vistas();
  if (vista) p[id] = Date.now();
  else delete p[id];
  return gravar(CHAVE_PROGRESSO, p);
}

const TEXTO_ESTADO: Record<EstadoAula, { icone: string }> = {
  'nao-iniciada': { icone: 'arrow-right' },
  andamento: { icone: 'hourglass-half' },
  concluida: { icone: 'circle-check' },
  rever: { icone: 'arrows-rotate' },
};

/** Estado escrito de cada aula da trilha: Concluída, Em andamento, Rever (com a seção) ou Próxima. */
function refletirEstados(p: Progresso, and: Record<string, Andamento>) {
  const eventos = lerRegistro().eventos;
  document.querySelectorAll<HTMLElement>('ol.trilha').forEach((trilha) => {
    let atualMarcada = false;
    trilha.querySelectorAll<HTMLElement>('[data-aula-id]').forEach((el) => {
      const id = el.dataset.aulaId!;
      const { estado, rever } = estadoDaAula({ eventos, aula: id, vista: Boolean(p[id]), andamento: and[id] });
      el.dataset.estado = estado;
      // A primeira aula ainda por fazer é "a próxima": quem abre a trilha sabe por onde seguir.
      const ehAtual = !atualMarcada && (estado === 'nao-iniciada' || estado === 'andamento');
      if (ehAtual) atualMarcada = true;
      const link = el.querySelector('.trilha__link');
      if (ehAtual) link?.setAttribute('aria-current', 'step');
      else link?.removeAttribute('aria-current');

      const caixa = el.querySelector<HTMLElement>('[data-estado-texto]');
      if (!caixa) return;
      const texto =
        estado === 'concluida'
          ? 'Concluída'
          : estado === 'andamento'
            ? 'Em andamento'
            : estado === 'rever'
              ? 'Rever: ' + rever[0].rotulo + (rever.length > 1 ? ` (e mais ${rever.length - 1})` : '')
              : ehAtual
                ? 'Próxima'
                : '';
      caixa.hidden = !texto;
      caixa.dataset.estado = ehAtual && estado === 'nao-iniciada' ? 'proxima' : estado;
      const icone = caixa.querySelector('i');
      if (icone) icone.className = 'fa-solid fa-' + TEXTO_ESTADO[estado].icone;
      const rotulo = caixa.querySelector('[data-estado-rotulo]');
      if (rotulo) rotulo.textContent = texto;
    });
  });
}

/** Pinta as listas: cada item com data-aula-id ganha data-vista. */
export function refletirProgresso() {
  const p = vistas();
  const and = andamentos();
  document.querySelectorAll<HTMLElement>('[data-aula-id]').forEach((el) => {
    const vista = Boolean(p[el.dataset.aulaId!]);
    el.dataset.vista = String(vista);
    // O anel em volta do número da aula mostra o andamento só com cor; cheio só quando concluída.
    // O valor vai por atributo: vale antes e depois de o componente <circle-progress> ser registrado.
    const anel = el.querySelector('circle-progress');
    if (anel) {
      anel.setAttribute('animation', movimentoReduzido() ? 'none' : 'easeOutCubic');
      anel.setAttribute('value', String(vista ? 100 : Math.min(99, percentualDaAula(and[el.dataset.aulaId!]))));
    }
    // O check verde é só visual: o leitor de tela recebe a mesma informação em texto, no estado
    // escrito da aula (refletirEstados), que também é visível.
    const sr = el.querySelector('[data-vista-texto]');
    if (sr) sr.textContent = '';
  });
  refletirEstados(p, and);

  document.querySelectorAll<HTMLElement>('[data-progresso-de]').forEach((el) => {
    const ids = (el.dataset.progressoDe || '').split(' ').filter(Boolean);
    if (!ids.length) return;
    const feitas = ids.filter((id) => p[id]).length;
    const pct = Math.round((feitas / ids.length) * 100);
    el.style.setProperty('--pct', `${pct}%`);
    el.dataset.pct = String(pct);
    const texto = el.querySelector('[data-progresso-texto]');
    if (texto) texto.textContent = `${feitas} de ${ids.length}`;
    const barra = el.querySelector<HTMLElement>('[data-progresso-barra]');
    if (barra) {
      barra.style.transform = `scaleX(${pct / 100})`;
      // Só anuncia em quem de fato é um progressbar. As barras decorativas
      // são aria-hidden: o número já está escrito ao lado, em texto.
      const trilho = barra.parentElement;
      if (trilho?.getAttribute('role') === 'progressbar') {
        trilho.setAttribute('aria-valuenow', String(pct));
      }
    }
    el.dataset.completo = String(feitas === ids.length && ids.length > 0);
  });

  atualizarBotaoVista();
}

function atualizarBotaoVista() {
  const btn = document.querySelector<HTMLElement>('[data-acao="marcar-aula"]');
  if (!btn) return;
  const id = btn.dataset.aula!;
  const vista = Boolean(vistas()[id]);
  // Sem aria-pressed: o próprio rótulo muda ("Marcar como vista" / "Aula concluída").
  // Os dois juntos fariam o leitor dizer "Aula concluída, pressionado".
  btn.dataset.vista = String(vista);
  const icone = btn.querySelector('i');
  if (icone) icone.className = `fa-solid fa-${vista ? 'circle-check' : 'circle'}`;
  const rotulo = btn.querySelector('[data-rotulo]');
  if (rotulo) rotulo.textContent = vista ? 'Aula concluída' : 'Marcar como vista';
}

/** Aulas que a pessoa desmarcou na mão: não se concluem sozinhas de novo nesta visita. */
export const semConclusaoAutomatica = new Set<string>();
