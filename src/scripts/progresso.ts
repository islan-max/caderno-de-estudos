/* ---------------------------------------------------------------------------
 * Progresso das aulas: vistas, andamento, última aula e o zerar tudo.
 * ------------------------------------------------------------------------- */
import { toast } from './avisos';
import { confirmarAcao } from './confirmacao';
import { restaurarAcessibilidade } from './preferencias';
import { ler, gravar, movimentoReduzido } from './util';

const CHAVE_PROGRESSO = 'cdt:progresso';

export const CHAVE_ULTIMA = 'cdt:ultima';

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
      'As aulas que você marcou como vistas e o andamento de cada uma voltam ao zero neste navegador. Isso não pode ser desfeito.',
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
    // O check verde é só visual: o leitor de tela recebe a mesma informação em texto.
    const sr = el.querySelector('[data-vista-texto]');
    if (sr) sr.textContent = vista ? 'Aula já vista.' : '';
  });

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

/** Guarda a última aula aberta para o card "continuar de onde parou". */
export function registrarUltima(el: HTMLElement) {
  gravar(CHAVE_ULTIMA, {
    id: el.dataset.aula,
    titulo: el.dataset.titulo,
    materia: el.dataset.materia,
    href: location.pathname,
    ts: Date.now(),
  });
}

export interface Ultima {
  id?: string;
  titulo?: string;
  materia?: string;
  href?: string;
  ts?: number;
}

/** Aulas que a pessoa desmarcou na mão: não se concluem sozinhas de novo nesta visita. */
export const semConclusaoAutomatica = new Set<string>();
