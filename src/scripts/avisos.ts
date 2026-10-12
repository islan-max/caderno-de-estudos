/* ---------------------------------------------------------------------------
 * Avisos rápidos na tela (toasts).
 * ------------------------------------------------------------------------- */

let toastTimer = 0;

export function toast(mensagem: string, icone = 'circle-check') {
  const pilha = document.getElementById('toasts');
  if (!pilha) return;

  // Uma mensagem por vez: o feedback é curto, empilhar só polui a tela.
  pilha.querySelectorAll('.toast').forEach((t) => sairToast(t as HTMLElement));

  const el = document.createElement('div');
  el.className = 'toast';
  // Sem role próprio: quem anuncia é a região viva #toasts (Base.astro).
  el.innerHTML = `<i class="fa-solid fa-${icone}" aria-hidden="true"></i><span></span>`;
  el.querySelector('span')!.textContent = mensagem;
  pilha.appendChild(el);

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => sairToast(el), 2200);
}

function sairToast(el: HTMLElement) {
  if (el.dataset.saindo === 'true') return;
  el.dataset.saindo = 'true';
  el.addEventListener('animationend', () => el.remove(), { once: true });
  window.setTimeout(() => el.remove(), 400);
}
