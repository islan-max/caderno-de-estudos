/* ---------------------------------------------------------------------------
 * Achar uma seção da Aula Teórica pelo nome e levar a pessoa até ela.
 * O gabarito diz "Revisar: Aula Teórica › 3. Nome da seção"; o build já garante que o nome existe.
 * ------------------------------------------------------------------------- */

/** O markdown troca aspas retas por curvas nos títulos; o gabarito traz as retas. */
function semAspasCurvas(texto: string): string {
  return texto.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/** O título (h3) da seção da aula teórica. Os Tópicos-Chave repetem os nomes, por isso ficam de fora. */
export function acharSecao(artigo: ParentNode, nome: string): HTMLElement | null {
  const procurado = semAspasCurvas(nome);
  for (const h of artigo.querySelectorAll<HTMLElement>('h3')) {
    if (h.closest('.topico')) continue;
    if (semAspasCurvas(h.textContent ?? '') === procurado) return h;
  }
  return null;
}

/** Abre o tópico recolhido que guarda a seção, rola até ela e põe o foco no título. */
export function irParaSecao(titulo: HTMLElement) {
  const dono = titulo.closest<HTMLDetailsElement>('details');
  if (dono && !dono.open) dono.open = true;
  titulo.tabIndex = -1;
  titulo.scrollIntoView({ block: 'start' });
  titulo.focus({ preventScroll: true });
}

/** Link para a seção: funciona como âncora comum e, com JS, abre o tópico e move o foco. */
export function linkParaSecao(titulo: HTMLElement, texto: string, classe = ''): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = `#${titulo.id}`;
  a.textContent = texto;
  if (classe) a.className = classe;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    irParaSecao(titulo);
  });
  return a;
}
