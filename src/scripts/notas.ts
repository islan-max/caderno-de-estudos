/* ---------------------------------------------------------------------------
 * Notinha solta que aparece ao passar o mouse.
 * ------------------------------------------------------------------------- */

/** Troca o balão nativo (atributo title) por uma etiqueta no estilo do caderno.
 *  O texto vai para data-nota; o title sai para o navegador não mostrar o balão dele, e o
 *  nome acessível é preservado (aria-label em botão só de ícone, aria-description no resto). */
export function ligarNotasSoltas() {
  if ((window as any).__cdtNotas) return;
  (window as any).__cdtNotas = true;

  let alvo: HTMLElement | null = null;
  let espera = 0;

  const migrar = (el: HTMLElement): string => {
    const t = el.getAttribute('title');
    if (t) {
      el.dataset.nota = t;
      el.removeAttribute('title');
      const rotulo = el.getAttribute('aria-label');
      const visivel = el.textContent?.trim();
      if (!rotulo && !visivel) el.setAttribute('aria-label', t);
      else if (rotulo !== t && visivel !== t && !rotulo?.includes(t)) el.setAttribute('aria-description', t);
    }
    return el.dataset.nota ?? '';
  };

  const folha = (): HTMLElement => {
    let n = document.getElementById('nota-solta');
    if (!n) {
      n = document.createElement('div');
      n.id = 'nota-solta';
      n.className = 'nota-solta';
      n.setAttribute('role', 'tooltip');
      n.hidden = true;
      document.body.appendChild(n);
    }
    return n;
  };

  const esconder = () => {
    window.clearTimeout(espera);
    alvo = null;
    const n = document.getElementById('nota-solta');
    if (n) {
      n.dataset.visivel = 'false';
      n.hidden = true;
    }
  };

  const mostrar = (el: HTMLElement) => {
    const texto = migrar(el);
    if (!texto) return;
    alvo = el;
    const n = folha();
    n.textContent = texto;
    n.hidden = false;
    n.dataset.visivel = 'false';

    const r = el.getBoundingClientRect();
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    const margem = 8;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(margem, Math.min(x, window.innerWidth - w - margem));
    let y = r.bottom + 12;
    let lado = 'baixo';
    if (y + h > window.innerHeight - margem) {
      y = Math.max(margem, r.top - h - 12);
      lado = 'cima';
    }
    n.dataset.lado = lado;
    // A setinha aponta para o centro do elemento, mesmo quando a dica foi empurrada para dentro da tela.
    const seta = Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x));
    n.style.setProperty('--seta', `${Math.round(seta)}px`);
    n.style.left = `${Math.round(x)}px`;
    n.style.top = `${Math.round(y)}px`;
    requestAnimationFrame(() => {
      if (alvo === el) n.dataset.visivel = 'true';
    });
  };

  const dono = (e: Event): HTMLElement | null =>
    e.target instanceof Element ? e.target.closest<HTMLElement>('[title], [data-nota]') : null;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = dono(e);
    if (!el) return;
    migrar(el); // tira o title já, antes de o navegador mostrar o balão dele
    if (el === alvo) return;
    window.clearTimeout(espera);
    espera = window.setTimeout(() => mostrar(el), 280);
  });
  document.addEventListener('pointerout', (e) => {
    if (!alvo && !espera) return;
    const para = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    const el = dono(e);
    if (el && para && el.contains(para)) return;
    esconder();
  });
  document.addEventListener('focusin', (e) => {
    const el = dono(e);
    if (el && el.matches(':focus-visible')) mostrar(el);
  });
  document.addEventListener('focusout', esconder);
  document.addEventListener('pointerdown', esconder);
  document.addEventListener('scroll', esconder, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') esconder();
  });
  document.addEventListener('astro:before-swap', esconder);
}
