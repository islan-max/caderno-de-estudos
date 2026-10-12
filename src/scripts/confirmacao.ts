/* ---------------------------------------------------------------------------
 * Janela de confirmação para ações sem volta (WCAG 3.3.4).
 * ------------------------------------------------------------------------- */

interface PedidoConfirmacao {
  titulo: string;
  texto: string;
  confirmar: string;
  /** Opção extra, com caixa de marcar (desmarcada por padrão). */
  extra?: string;
}

/** Janela de confirmação da própria página (o confirm() nativo é bloqueado em alguns
 *  navegadores e devolve "não" sem mostrar nada). Cancelar, Esc e clique fora devolvem false. */
export function confirmarAcao(p: PedidoConfirmacao): Promise<{ ok: boolean; extra: boolean }> {
  const dlg = document.getElementById('confirmar');
  if (!(dlg instanceof HTMLDialogElement)) return Promise.resolve({ ok: false, extra: false });

  dlg.querySelector('[data-confirmar-titulo]')!.textContent = p.titulo;
  dlg.querySelector('[data-confirmar-texto]')!.textContent = p.texto;
  dlg.querySelector('[data-confirmar-ok]')!.textContent = p.confirmar;
  const extra = dlg.querySelector<HTMLElement>('[data-confirmar-extra]')!;
  const caixa = dlg.querySelector<HTMLInputElement>('[data-confirmar-extra-caixa]')!;
  extra.hidden = !p.extra;
  caixa.checked = false;
  dlg.querySelector('[data-confirmar-extra-texto]')!.textContent = p.extra ?? '';

  return new Promise((resolver) => {
    let respondido = false;
    const responder = (ok: boolean) => {
      if (respondido) return;
      respondido = true;
      const marcado = ok && Boolean(p.extra) && caixa.checked;
      if (dlg.open) dlg.close();
      resolver({ ok, extra: marcado });
    };
    dlg.querySelector('[data-confirmar-ok]')!.addEventListener('click', () => responder(true), { once: true });
    dlg.addEventListener('close', () => responder(false), { once: true });
    dlg.showModal();
  });
}

// Outros scripts da página (folha de redação) usam a mesma janela.
(window as unknown as { cdtConfirmar?: typeof confirmarAcao }).cdtConfirmar = confirmarAcao;
