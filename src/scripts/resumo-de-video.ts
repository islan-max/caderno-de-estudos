/* ---------------------------------------------------------------------------
 * Página /resumo-de-video: lê a transcrição enviada, mostra os pontos por trecho e exporta o que
 * a pessoa marcou. As regras estão em src/lib/resumo.ts. Nada é enviado e nada é guardado.
 * ------------------------------------------------------------------------- */
import { LIMITES, formatarTempo, lerEnderecoDoVideo, lerTranscricao, linkDoMomento, paraMarkdown, resumir } from '../lib/resumo';
import type { Resumo } from '../lib/resumo';
import { toast } from './avisos';
import { escapar } from './util';

let encerrar: AbortController | null = null;

export function montarResumoDeVideo() {
  const raiz = document.querySelector<HTMLElement>('[data-resumo]');
  if (!raiz) return;
  encerrar?.abort();
  encerrar = new AbortController();
  const { signal } = encerrar;

  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const form = q<HTMLFormElement>('[data-resumo-form]');
  const erro = q('[data-resumo-erro]');
  const status = q('[data-resumo-status]');
  const saida = q('[data-resumo-saida]');
  const md = q<HTMLTextAreaElement>('[data-resumo-md]');
  const titulo = q<HTMLInputElement>('[data-resumo-titulo]');

  let resumo: Resumo | null = null;
  let videoId: string | null = null;
  const incluidos = new Set<string>();

  const falhar = (texto: string) => {
    erro.hidden = false;
    erro.textContent = texto;
  };

  function atualizarTexto() {
    md.value = resumo ? paraMarkdown({ resumo, incluidos, videoId, titulo: titulo.value }) : '';
  }

  function desenhar() {
    if (!resumo) return;
    q('[data-resumo-avisos]').innerHTML = resumo.avisos.map((a) => `<li>${escapar(a)}</li>`).join('');
    q('[data-resumo-trechos]').innerHTML = resumo.trechos
      .map((tr, i) => {
        const intervalo = tr.inicio === null ? '' : ` · ${formatarTempo(tr.inicio)}${tr.fim !== null && tr.fim !== tr.inicio ? ` a ${formatarTempo(tr.fim)}` : ''}`;
        const pontos = tr.pontos.length
          ? tr.pontos
              .map((p, j) => {
                const idp = `${i}.${j}`;
                const marca =
                  p.inicio === null
                    ? ''
                    : videoId
                      ? `<a href="${escapar(linkDoMomento(videoId, p.inicio))}" target="_blank" rel="noopener noreferrer">${formatarTempo(p.inicio)}<span class="apenas-leitor"> (abre o vídeo nesse momento, em outra aba)</span></a> `
                      : `<span class="resumo__tempo">${formatarTempo(p.inicio)}</span> `;
                return `<li class="resumo__ponto"><label><input type="checkbox" data-ponto="${idp}"${incluidos.has(idp) ? ' checked' : ''} /> <span>${marca}${escapar(p.texto)}</span></label></li>`;
              })
              .join('')
          : '<li class="resumo__ponto">Sem ponto: o trecho só tem frases muito curtas.</li>';
        return `
          <section class="resumo__trecho" aria-labelledby="resumo-tr-${i}">
            <h3 id="resumo-tr-${i}" class="resumo__trecho-titulo">Trecho ${i + 1}${escapar(intervalo)}${tr.pouco ? ' <span class="resumo__fraco">(pouco texto)</span>' : ''}</h3>
            <ul class="resumo__pontos">${pontos}</ul>
          </section>`;
      })
      .join('');
  }

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      erro.hidden = true;
      erro.textContent = '';
      const endereco = q<HTMLInputElement>('#resumo-url').value.trim();
      videoId = null;
      if (endereco) {
        const r = lerEnderecoDoVideo(endereco);
        if (!r.ok) return falhar(r.motivo);
        videoId = r.id;
      }
      const arquivo = q<HTMLInputElement>('#resumo-arquivo').files?.[0];
      if (arquivo && arquivo.size > LIMITES.caracteres) return falhar('Esse arquivo é grande demais (mais de 1 MB). Envie um trecho menor.');
      const texto = arquivo ? await arquivo.text() : q<HTMLTextAreaElement>('#resumo-texto').value;
      const lida = lerTranscricao(texto);
      if (!lida.ok) return falhar(lida.erro);

      resumo = resumir(lida.transcricao);
      incluidos.clear();
      resumo.trechos.forEach((tr, i) => tr.pontos.forEach((_, j) => incluidos.add(`${i}.${j}`)));
      desenhar();
      atualizarTexto();
      saida.hidden = false;
      const total = resumo.trechos.reduce((n, tr) => n + tr.pontos.length, 0);
      const mensagem = `Resumo pronto: ${total} pontos em ${resumo.trechos.length} trechos.`;
      status.textContent = '';
      window.setTimeout(() => (status.textContent = mensagem), 30);
      q('#resumo-pontos').focus();
    },
    { signal },
  );

  form.addEventListener(
    'reset',
    () => {
      resumo = null;
      videoId = null;
      incluidos.clear();
      saida.hidden = true;
      erro.hidden = true;
      md.value = '';
    },
    { signal },
  );

  q('[data-resumo-trechos]').addEventListener(
    'change',
    (e) => {
      const caixa = e.target as HTMLInputElement;
      if (!caixa.dataset.ponto) return;
      if (caixa.checked) incluidos.add(caixa.dataset.ponto);
      else incluidos.delete(caixa.dataset.ponto);
      atualizarTexto();
    },
    { signal },
  );
  titulo.addEventListener('input', atualizarTexto, { signal });

  q('[data-resumo-baixar]').addEventListener(
    'click',
    () => {
      const url = URL.createObjectURL(new Blob([md.value], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resumo-de-video.md';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Arquivo gerado: confira a pasta de downloads.');
    },
    { signal },
  );

  q('[data-resumo-copiar]').addEventListener(
    'click',
    async () => {
      try {
        await navigator.clipboard.writeText(md.value);
        toast('Texto copiado.');
      } catch {
        md.select();
        toast('Não consegui copiar sozinho: o texto está selecionado, use Ctrl+C.');
      }
    },
    { signal },
  );
}
