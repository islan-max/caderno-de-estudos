/* ---------------------------------------------------------------------------
 * Aviso no topo da aula: lista as seções a rever (questões erradas que ainda não foram acertadas
 * de novo) com link direto para cada uma. Nunca bloqueia nada.
 *
 * Quando some: assim que cada questão dessas for acertada pelo menos 30 minutos depois do último
 * erro (INTERVALO_REVER_MS). Acertar antes disso não tira a seção daqui: o aviso diz a partir de
 * que horas um acerto passa a valer. Ele se atualiza sozinho a cada resposta corrigida no quiz.
 * ------------------------------------------------------------------------- */
import { estadoDaAula } from '../lib/estudo.ts';
import type { SecaoEstado } from '../lib/estudo.ts';
import { vistas } from './progresso';
import { lerRegistro } from './registro';
import { acharSecao, linkParaSecao } from './secoes-aula';

let encerrar: AbortController | null = null;

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** O que a pessoa precisa fazer com esta seção, em palavras. */
function situacao(s: SecaoEstado, agora: number): string {
  const vale = s.desde === null || s.desde <= agora ? 'um acerto já vale' : `um acerto passa a valer às ${hora(s.desde)}`;
  return s.motivo === 'cedo'
    ? `Você acertou, mas logo depois do erro; ${vale}.`
    : `Você errou; refaça a questão. Agora ${vale}.`;
}

export function montarAvisoRever() {
  const artigo = document.querySelector<HTMLElement>('[data-conteudo-aula]');
  const aula = artigo?.dataset.aula;
  if (!artigo || !aula) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;
  let volta = 0;

  function desenhar() {
    window.clearTimeout(volta);
    document.querySelector('.aviso-rever')?.remove();
    const agora = Date.now();
    const { rever } = estadoDaAula({ eventos: lerRegistro().eventos, aula: aula!, vista: Boolean(vistas()[aula!]) });
    if (!rever.length) return;

    const aviso = document.createElement('section');
    aviso.className = 'aviso-rever not-prose';
    aviso.setAttribute('aria-labelledby', 'aviso-rever-titulo');

    const cabeca = document.createElement('header');
    cabeca.className = 'aviso-rever__cabeca';
    const icone = document.createElement('span');
    icone.className = 'aviso-rever__icone';
    icone.innerHTML = '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>';
    const textos = document.createElement('div');
    const titulo = document.createElement('h2');
    titulo.id = 'aviso-rever-titulo';
    titulo.className = 'aviso-rever__titulo';
    titulo.textContent = 'Para rever nesta aula';
    const sub = document.createElement('p');
    sub.className = 'aviso-rever__sub';
    sub.textContent = rever.length === 1 ? 'Uma seção com questão para refazer' : `${rever.length} seções com questões para refazer`;
    textos.append(titulo, sub);
    cabeca.append(icone, textos);

    const lista = document.createElement('ul');
    lista.className = 'aviso-rever__lista';
    for (const s of rever) {
      const li = document.createElement('li');
      li.className = 'aviso-rever__item';
      const alvo = s.secao ? acharSecao(artigo!, s.secao) : null;
      if (alvo) li.append(linkParaSecao(alvo, s.rotulo, 'aviso-rever__link'));
      else {
        const nome = document.createElement('span');
        nome.className = 'aviso-rever__link';
        nome.textContent = s.rotulo;
        li.append(nome);
      }
      const estado = document.createElement('span');
      estado.className = 'aviso-rever__estado';
      estado.textContent = situacao(s, agora);
      li.append(estado);
      lista.append(li);
    }

    const regra = document.createElement('p');
    regra.className = 'aviso-rever__regra';
    regra.textContent =
      'Esta caixa some sozinha quando você acertar essas questões de novo, pelo menos 30 minutos depois do erro. Veja o “?” no topo da página.';

    aviso.append(cabeca, lista, regra);
    artigo!.before(aviso);

    // Quando um acerto passar a valer, o texto troca de "às 17:25" para "já vale".
    const proximo = rever.map((s) => s.desde).filter((d): d is number => d !== null && d > agora);
    if (proximo.length) volta = window.setTimeout(desenhar, Math.min(...proximo) - agora + 500);
  }

  desenhar();
  // Cada resposta corrigida no quiz atualiza (ou tira) o aviso na hora.
  document.addEventListener('cdt:registro', desenhar, { signal });
}
