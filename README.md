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

## Acessibilidade

O site busca conformidade com o WCAG 2.2 nível AA. As decisões, o passo a passo para novos componentes e para quem escreve aulas, e os verificadores (`scripts/checar-acessibilidade.mjs` e `scripts/checar-contraste.mjs`) estão em `docs/acessibilidade.md`. A página pública é a Declaração de Acessibilidade (`/acessibilidade`).

## Publicação

Todo push para a branch `main` executa o build estático e publica o resultado no GitHub Pages. Para este repositório, a publicação usa a base `/caderno-de-estudos/` (`islan-max.github.io/caderno-de-estudos/`).
