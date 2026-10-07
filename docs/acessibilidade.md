# Acessibilidade: guia de manutenção

Meta: WCAG 2.2 nível AA e Lei Brasileira de Inclusão (Lei 13.146/2015). A página pública que
conta isso ao usuário é `src/pages/acessibilidade.astro` (Declaração de Acessibilidade). **Se
algo mudar aqui, atualize a declaração e a data dela.**

## Verificar antes de publicar

```bash
npm run build
node scripts/checar-acessibilidade.mjs   # HTML gerado: títulos, nomes, imagens, aria, ids
node scripts/checar-contraste.mjs        # contraste dos tokens de cor nos 4 modos
```

Os dois também rodam no CI (`.github/workflows/ci.yml`) e reprovam o PR se houver erro. Eles
**não substituem** o teste manual: navegue pelo teclado (`Tab`, `Shift+Tab`, setas, `Enter`,
`Espaço`, `Esc`), amplie o texto a 200% e use um leitor de tela (NVDA no Windows, VoiceOver no
Mac/iOS, TalkBack no Android) nas telas que você mexeu.

## Decisões que não devem ser desfeitas sem motivo

| Decisão | Onde | Por quê |
| --- | --- | --- |
| Quiz com `<fieldset>`, `<legend>` e `<input type="radio">` nativos | `src/scripts/quiz.ts` | Setas, leitor de tela e navegação por formulário vêm de graça. Depois de corrigir, o foco vai para o placar (o botão "Corrigir" some). |
| Painéis são `<dialog>` com `showModal()` | `Paineis.astro`, `HelpTip.astro` | Foco preso, `Esc` e retorno do foco ao botão que abriu, nativos. Todo `<dialog>` precisa de nome (`aria-label` ou `aria-labelledby`). |
| Busca é um *combobox*: o foco fica no campo e `aria-activedescendant` aponta o resultado | `Paineis.astro`, `app.ts` | Leitor de tela acompanha o destaque sem mover o foco. |
| Atalhos de uma tecla (`/`, `←`, `→`) podem ser desligados e não disparam com diálogo aberto ou com a página rolando na horizontal | `app.ts` (`ligarAtalhos`) | WCAG 2.1.4. Com zoom alto, as setas servem para rolar. `Ctrl+K` não precisa de interruptor. |
| Correção imediata do quiz é o padrão, mas só corrige na hora quando a marcação veio de mouse ou toque (`pointerdown`). Por teclado ou leitor de tela aparece "Confirmar resposta" (ou `Enter`) | `quiz.ts`, preferência `correcao` em `app.ts` | As setas de um grupo de rádio mudam a seleção: corrigir a cada seta travaria a alternativa errada. O resultado vai para uma região viva (ponteiro) ou recebe o foco (teclado). |
| Brilho do tema claro é um `filter: brightness()` no `<html>`, só fora do tema escuro | `global.css`, `app.ts` (`aplicarBrilho`), script inline de `Base.astro` | No elemento raiz o filtro não vira bloco de contenção, então `position: fixed` segue funcionando. Mínimo de 75%: abaixo de 80% alguns textos coloridos ficam abaixo de 4,5:1, então o padrão é 100% e o ajuste é opt-in. |
| Seções `##` da aula viram `<details>` no navegador ("Antes de Começar" com o visual do Accordion, recolhido) | `topicos.ts`, `global.css` | Teclado e leitor de tela vêm do `<details>`. Precisa rodar depois de `montarQuiz()`, que lê os filhos diretos do artigo. |
| Corpo do Accordion tem altura máxima e rola por dentro (`role="region"` com `tabindex="0"` e nome) | `Accordion.astro` | Glossário longo não cobre a página; a região rolável precisa ser alcançável pelo teclado (2.1.1). |
| Painéis rolantes têm cabeçalho `sticky` com ícone, título e botão de fechar | `Paineis.astro` | Quem rola não perde o nome do painel nem o jeito de fechar. |
| `--color-controle` é a borda de campos e controles; `--color-line` é só divisória | `global.css` | WCAG 1.4.11: borda de controle precisa de 3:1. |
| `--color-enem`, `--color-ds` e `--color-ok` foram escurecidos um pouco | `global.css` | Passam de 4,5:1 como texto sobre a folha e sobre o papel. |
| Nada de `opacity` em texto | vários | `opacity` derruba o contraste sem aparecer no `checar-contraste`. Use `--color-ink-soft`. |
| Plugin `niveis-de-titulo` rebaixa `####` sob `##` para `h3` (guarda `data-visual="h4"` para o CSS manter o visual) | `src/lib/niveis-de-titulo.mjs`, `astro.config.mjs` | O formato das aulas usa `####` nos Tópicos-Chave; sem isso há salto de título (1.3.1) em ~130 aulas. |
| Plugin `tabelas-rolaveis` embrulha tabela num contêiner `role="region"` com `tabindex="0"` | mesmo arquivo | Tabela larga não alarga a página (1.4.10) e continua rolável pelo teclado. |
| Barra de rolagem própria (o "corretivo de fita") só desenha a posição: fica `aria-hidden`, sem foco, e a rolagem segue sendo a do navegador (teclado, roda, toque). Clicar no trilho rola uma página, então arrastar não é o único caminho (2.5.7). Sem JS e em Cores Forçadas a barra nativa continua | `barra-rolagem.ts`, `barra-rolagem.css` | Rolagem nova nasce com `data-rolagem` no contêiner e `data-rolagem-area` na área que rola. Tabelas e blocos de código ficam com a barra nativa fina nas cores do caderno. |
| `main` tem `overflow-wrap: anywhere` | `global.css` | Texto a 200% não pode empurrar a página para o lado. |
| Estado nunca só por cor: quiz diz "Você acertou/errou", trilha tem texto "Aula já vista", redação tem aviso em texto | `quiz.ts`, `TrilhaAulas.astro`, `Textarea.astro` | WCAG 1.4.1. |
| Link `target="_blank"` leva `<span class="apenas-leitor"> (abre em nova aba)</span>` | `Rodape`, `Recursos`, `Documento`, páginas legais | O ícone de "link externo" é decorativo (`aria-hidden`). |

## Ao criar um componente

1. **HTML nativo primeiro.** `<button>` para ação, `<a>` para navegação, `<details>` para
   recolher, `<dialog>` para modal. ARIA só quando o HTML não diz o que o controle é.
2. **Todo controle tem nome.** Ícone sozinho precisa de `aria-label`; o texto visível deve estar
   dentro do nome (2.5.3). Ícone decorativo usa `<Icone>` sem `label` (já vem `aria-hidden`).
3. **Foco visível.** O padrão (`:focus-visible` em `global.css`) já serve. Se escrever
   `outline: none`, ponha outro anel no lugar.
4. **Cor.** Cores novas entram em `checar-contraste.mjs` (lista `pares()`), com o fundo real onde
   serão usadas. Texto 4,5:1; ícone e borda de controle 3:1.
5. **Estado.** Mostre também em texto ou ícone, e diga ao leitor de tela (`aria-pressed`,
   `aria-checked`, `aria-current`, ou texto `apenas-leitor`).
6. **Aviso curto** ("copiado", "salvo"): use `toast()` de `app.ts`; ele passa pela região viva
   `#toasts`. Não crie outra região viva por componente.
7. **Largura.** Teste a 320px e com `html { font-size: 200% }`. Item flex/grid com texto precisa
   poder quebrar linha (`flex-wrap` ou `min-width: 0`).
8. **Animação.** Respeite `prefers-reduced-motion` (já global) e nada pisca mais de 3 vezes por
   segundo. Nada de autoplay.

## Ao escrever uma aula (MDX)

- **Imagem**: `![descrição](./img/...)`. O texto alternativo diz **o que a figura mostra e o que
  importa para a questão**, sem "imagem de". Foto puramente decorativa: `![](...)`.
- **Diagrama SVG**: `role="img"` com `<title>` e `<desc>` (`aria-labelledby`), como nas aulas
  existentes. O `<figcaption>` não substitui a descrição.
- **Títulos**: `##` seções, `###` subseções, `####` só nos Tópicos-Chave (o formato atual). Nunca
  escolha o nível pelo tamanho da letra.
- **Link**: texto que faz sentido sozinho ("Resolução do INEP, prova de 2022"), nunca "clique
  aqui". Link para fora em nova aba só em `Recursos` (o componente já avisa).
- **Trecho em outro idioma**: marque com `<span lang="en">…</span>` (ou `lang="es"`). Hoje as
  aulas de Língua Estrangeira ainda **não** fazem isso (limitação conhecida).
- **Tabela**: primeira linha é cabeçalho. Evite tabela só para alinhar texto.
- **Sigla e termo difícil**: explique na primeira vez (o glossário "Palavras e siglas desta
  aula" faz isso).
- **Cor**: nunca "o item vermelho"; descreva também pelo texto ou posição.

## Pendências conhecidas (ver a Declaração de Acessibilidade)

- Marcar `lang` nos trechos em inglês das 6 aulas de Língua Estrangeira.
- Fórmulas em texto/Unicode, sem MathML.
- Nenhum teste sistemático com leitor de tela nem com usuários com deficiência: planejar rodada
  de testes (NVDA + Firefox/Chrome, VoiceOver + Safari, TalkBack) e registrar os achados aqui.
- Navegação pelo `ClientRouter` mantém o foco no `body` após trocar de página.
- Revisar `data-surgir` (entrada animada de blocos) se alguém relatar desconforto: já é
  desligada por `prefers-reduced-motion` e por "Reduzir animações".
