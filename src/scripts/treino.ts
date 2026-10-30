/* ---------------------------------------------------------------------------
 * Página /treino/[id]: cronômetro, respostas, chutes e correção das listas de questões (e o texto
 * da redação). A marcação é montada no servidor (src/pages/treino/[id].astro); aqui só se liga o estado,
 * guardado no navegador em `cdt:treino:<id>`, para sobreviver a recarregar a página.
 * ------------------------------------------------------------------------- */
import { ler, gravar } from './util';
import { toast } from './avisos';

interface Estado {
  r: Record<string, string>;
  c: Record<string, boolean>;
  ini: number;
  fim: number;
  /** Milissegundos já pausados e, se está pausado agora, o instante em que a pausa começou. */
  p: number;
  pa: number;
  texto: string;
}

const mmss = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const palavras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export function montarTreino() {
  const raiz = document.querySelector<HTMLElement>('[data-treino]');
  if (!raiz) return;
  const chave = 'cdt:treino:' + raiz.dataset.treino;
  const limite = Number(raiz.dataset.minutos) * 60;
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const estado = ler<Estado>(chave, { r: {}, c: {}, ini: 0, fim: 0, p: 0, pa: 0, texto: '' });
  const salvar = () => gravar(chave, estado);
  const fichas = Array.from(raiz.querySelectorAll<HTMLElement>('.tq'));
  const area = raiz.querySelector<HTMLTextAreaElement>('[data-texto]');

  // Cronômetro: guarda o instante de início, então recarregar a página não zera o tempo.
  const tempo = q('[data-tempo]');
  const btnIniciar = q<HTMLButtonElement>('[data-iniciar]');
  let relogio = 0;
  const decorrido = () => Math.round(((estado.fim || estado.pa || Date.now()) - estado.ini - (estado.p || 0)) / 1000);
  const pintar = () => {
    const sobra = limite - decorrido();
    tempo.textContent = sobra >= 0 ? mmss(sobra) : '+' + mmss(-sobra);
    tempo.toggleAttribute('data-estourou', sobra < 0);
  };
  const btnPausa = q<HTMLButtonElement>('[data-pausar]');
  const andar = () => {
    btnIniciar.hidden = true;
    btnPausa.hidden = !!estado.fim;
    btnPausa.textContent = estado.pa ? 'Continuar' : 'Pausar';
    pintar();
    if (!estado.fim) relogio = window.setInterval(pintar, 1000);
  };
  const comecar = () => {
    if (estado.ini) return;
    estado.ini = Date.now();
    andar();
  };
  if (estado.ini) andar();
  btnPausa.addEventListener('click', () => {
    if (estado.pa) {
      estado.p = (estado.p || 0) + Date.now() - estado.pa;
      estado.pa = 0;
    } else estado.pa = Date.now();
    btnPausa.textContent = estado.pa ? 'Continuar' : 'Pausar';
    salvar();
    pintar();
  });
  btnIniciar.addEventListener('click', () => {
    comecar();
    salvar();
  });

  // Respostas e chutes.
  fichas.forEach((f) => {
    const qid = f.dataset.q!;
    const marcada = f.querySelector<HTMLInputElement>(`input[type=radio][value="${estado.r[qid]}"]`);
    if (marcada) marcada.checked = true;
    f.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked = !!estado.c[qid];
    f.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.type === 'radio') estado.r[qid] = el.value;
      else estado.c[qid] = el.checked;
      comecar();
      salvar();
    });
  });

  // Redação.
  if (area) {
    const contar = () => (q('[data-contagem]').textContent = palavras(area.value) + ' palavras');
    area.value = estado.texto;
    contar();
    area.addEventListener('input', () => {
      estado.texto = area.value;
      comecar();
      salvar();
      contar();
    });
  }

  const resultado = q('[data-resultado]');
  const copia = q<HTMLTextAreaElement>('[data-copia]');

  function finalizar() {
    estado.fim = estado.fim || estado.pa || Date.now();
    btnPausa.hidden = true;
    clearInterval(relogio);
    pintar();
    salvar();
    const minutos = estado.ini ? Math.round(decorrido() / 60) : 0;
    let resumo = '';
    let texto = `${raiz!.dataset.titulo}\nTempo usado: ${minutos} min`;

    if (area) {
      resumo = `${palavras(area.value)} palavras em ${minutos} min.`;
      texto += `\n\n${area.value}`;
    } else {
      let certas = 0;
      let brancas = 0;
      let certasChute = 0;
      const erros: Record<string, number> = {};
      const linhas: string[] = [];
      const chutes: string[] = [];
      for (const f of fichas) {
        const resp = estado.r[f.dataset.q!];
        const gab = f.dataset.gab!;
        const hab = f.dataset.hab!;
        const certa = !gab || resp === gab; // sem gabarito = anulada: vale ponto para todos
        f.toggleAttribute('data-certa', certa);
        f.toggleAttribute('data-errada', !certa);
        f.querySelectorAll('input').forEach((i) => (i.disabled = true));
        const res = f.querySelector<HTMLElement>('[data-res]')!;
        res.hidden = false;
        res.textContent = !gab
          ? 'Questão anulada pelo INEP: vale ponto para todos.'
          : `${certa ? 'Certo' : resp ? 'Errado' : 'Em branco'}. Gabarito: ${gab}${resp && !certa ? ` (você marcou ${resp})` : ''} · ${f.dataset.fonte} · ${hab}`;
        if (certa) certas++;
        else erros[hab] = (erros[hab] || 0) + 1;
        if (!resp) brancas++;
        if (estado.c[f.dataset.q!]) {
          chutes.push(f.dataset.num!);
          if (certa) certasChute++;
        }
        linhas.push(f.dataset.num + (resp || '-'));
      }
      const porHab = Object.entries(erros)
        .sort((a, b) => b[1] - a[1])
        .map(([h, n]) => `${h}: ${n}`)
        .join(', ');
      resumo = `${certas} de ${fichas.length} certas, ${brancas} em branco, ${certasChute} acertos entre ${chutes.length} chutes.` + (porHab ? ` Erros por habilidade: ${porHab}.` : '');
      texto += `\nRespostas: ${linhas.join(' ')}\nChutes: ${chutes.join(', ') || 'nenhum'}`;
    }
    q('[data-resumo]').textContent = resumo;
    copia.value = texto;
    resultado.hidden = false;
    resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  q('[data-finalizar]').addEventListener('click', () => {
    const faltam = fichas.filter((f) => !estado.r[f.dataset.q!]).length;
    if (faltam && !confirm(`${faltam} questão(ões) em branco. Finalizar mesmo assim?`)) return;
    finalizar();
  });
  if (estado.fim) finalizar();

  q('[data-copiar]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copia.value);
      toast('Copiado');
    } catch {
      copia.select();
      toast('Selecione e copie (Ctrl+C)');
    }
  });
  q('[data-refazer]').addEventListener('click', () => {
    if (!confirm('Apagar respostas, texto e cronômetro desta lista?')) return;
    try {
      localStorage.removeItem(chave);
    } catch {}
    location.reload();
  });
}
