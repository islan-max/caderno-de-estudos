# Caderno de Estudos

Uma biblioteca estática de aulas organizada em três frentes: ENEM, Escolar e Desenvolvimento de Sistemas (DS).

O conteúdo é publicado como arquivos MDX versionados em `src/content/`. Não há login, perfil, comentários, banco de dados, APIs ou serviços de servidor.

## Executar localmente

```bash
npm ci
npm run dev
```

## Adicionar uma aula

Crie um arquivo `.mdx` na categoria adequada dentro de `src/content/`, mantendo o padrão de caminhos:

- `enem/<materia>/<tema>.mdx`
- `escolar/<materia>/<bimestre>/<semana>.mdx`
- `ds/<materia>/<bimestre>/<semana>.mdx`

Cada aula usa o frontmatter com `title`, `subject`, `relevance`, `quickSummary` (opcional), `order`, `gabarito` (opcional) e `resources` (opcional).

A posição de cada aula na trilha vem dos mapas em `src/data/` (`enem-mapa.json`, `ds-mapa.json`, `escolar-mapa.json`): aula do mapa sem `.mdx` aparece como "Em breve", sem link. No ENEM, ao criar o `.mdx` coloque o tema no mapa; o build avisa se faltar.

As aulas do ENEM seguem o padrão descrito em `PROMPT_AULA_ENEM.mdx`: estrutura, imagens, marcação do Teste de Fogo e validação. Para gerar uma aula nova, cole esse arquivo numa conversa com uma IA e informe a matéria e o tema.

## Revisão, Hoje e Meu estudo

O que o estudante responde fica só no navegador dele (`cdt:registro`, ver `/privacidade`). As regras (estado de cada aula, fila de revisão, sugestões do dia) são funções puras em `src/lib/estudo.ts`, com testes (`npm test`).

- Ao errar uma questão, o feedback leva à seção da aula citada em `Revisar: Aula Teórica › N. Seção` (o `checar-quiz.mjs` exige o link).
- Cada tópico de `Tópicos-Chave para Revisão` vira um cartão da página `/revisao`, depois de a aula ser concluída. Você escreve o que lembra e o caderno corrige. Há duas correções, escolhidas na primeira vez: a **inteligente**, que roda no aparelho com um modelo de linguagem pequeno (`src/scripts/ia.ts`: transformers.js 4.2.0 via jsDelivr + `Xenova/paraphrase-multilingual-MiniLM-L12-v2` quantizado, 118 MB, baixado só com o aceite da pessoa) e compara o sentido da resposta com cada ideia do tópico; e a por **palavras-chave** (`src/lib/correcao.ts`). Nenhuma vê se a conclusão está certa, só se as ideias foram cobertas. Quando a correção diz "errado", ela marca a aula como "Rever". Os limiares da correção por sentido foram calibrados com respostas reais; se trocar o modelo, recalibre `LIMIAR_PONTO` e `LIMIAR_FORTE`. Para uma aula não gerar cartões: `<div className="topico" data-cartoes="nao">`.
- A home mostra `Hoje` (retrátil; até três ações, cada uma com o motivo; "Agora não" esconde por 1 hora; matérias em foco e tamanho da revisão ficam na página `/ajustes`, que também mostra uma prévia e as sugestões escondidas) e `/meu-estudo` mostra revisão, dias de estudo (de 1 semana a 1 ano), matérias, histórico editável e dados. As duas têm aba própria e um botão "?" no topo com as explicações (`AjudaDaPagina.astro`).
- Uma seção sai de "Rever" quando a questão é acertada pelo menos 30 minutos depois do último erro (`INTERVALO_REVER_MS`); acertar antes disso não tira, e o aviso da aula diz a partir de que horas vale.

## Acessibilidade

O site busca conformidade com o WCAG 2.2 nível AA. As decisões, o passo a passo para novos componentes e para quem escreve aulas, e os verificadores (`scripts/checar-acessibilidade.mjs` e `scripts/checar-contraste.mjs`) estão em `docs/acessibilidade.md`. A página pública é a Declaração de Acessibilidade (`/acessibilidade`).

## Publicação

Todo push para a branch `main` executa o build estático e publica o resultado no GitHub Pages. Para este repositório, a publicação usa a base `/caderno-de-estudos/` (`islan-max.github.io/caderno-de-estudos/`).
