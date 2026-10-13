/* ---------------------------------------------------------------------------
 * Painel de ajuda da página: copia o conteúdo do <template data-ajuda> (AjudaDaPagina.astro)
 * para o diálogo #ajuda (Paineis.astro) na hora de abrir.
 * ------------------------------------------------------------------------- */
export function montarAjuda() {
  const modelo = document.querySelector<HTMLTemplateElement>('template[data-ajuda]');
  const corpo = document.querySelector<HTMLElement>('[data-ajuda-corpo]');
  const titulo = document.querySelector<HTMLElement>('[data-ajuda-titulo]');
  if (!modelo || !corpo || !titulo) return;
  titulo.textContent = modelo.dataset.titulo ?? 'Ajuda';
  corpo.replaceChildren(modelo.content.cloneNode(true));
}
