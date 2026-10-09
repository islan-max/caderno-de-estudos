# Caderno de estudos: instruções para qualquer agente (Codex ou Claude)

Site Astro com três abas: ENEM, DS (curso técnico) e Escolar. Este arquivo substitui a memória local do Claude, que fica fora do repo. Quem trabalha aqui é o Max, que estuda sozinho e lê tudo em português do Brasil.

## Antes de começar
1. Ler a última entrada de `docs/handoff.md`: o que o outro agente fez e qual é o próximo passo exato.
2. Rodar `git status`. Há trabalho não commitado de sessões anteriores. Nunca usar `git checkout`, `git reset` ou `git stash` para limpar o que não é seu.

## Convivência entre agentes
- Só um agente escreve no repo por vez. Se a última entrada do handoff estiver marcada como "em andamento", não começar sem falar com o Max.
- Atualizar `docs/handoff.md` a cada aula concluída, e não só no fim da sessão: o limite de uso pode cortar a sessão no meio, e aí não há como escrever. Cada entrada: data, agente, arquivos tocados, estado, próximo passo e pendências.
- A conversa entre os agentes acontece só por esse arquivo. Não há comunicação direta.
- O detalhe de cada sessão vai para `docs/sessoes/AAAA-MM-DD-tema.md`, seguindo `docs/sessoes/modelo.md`. A entrada do handoff fica curta e aponta para esse arquivo.

## Preferências do Max
- Texto curto, português do Brasil, uma ideia por frase. Toda sigla e termo técnico explicado na primeira vez.
- Cobertura completa. Quando faltar algo, resolver em vez de só registrar.
- Ritmo: terminou uma aula, começa a próxima sem pedir confirmação. Ao fim de cada matéria, push na `main` (liberado pelo Max).
- Visual: página limpa. Seções parecidas viram uma seção retrátil. Sem legenda "Figura N", sem rótulos genéricos como "Teste de Fogo".
- Antes de baixar arquivo grande, procurar o conteúdo em texto puro na internet. Só baixar o bruto se não existir.

## ENEM (aulas)
- Padrão: `docs/aulas/formato-das-aulas-mdx.md` (spec) e `docs/aulas/instrucoes-do-tutor.md`. Ler os dois antes de cada aula.
- Retomada: a primeira linha de `docs/aulas/progresso.md` que não esteja `concluída`. Em 08/10/2026 é `matematica-basica/divisibilidade-e-fatoracao`.
- Questões: só do banco oficial do INEP, em `.cache/inep/` (fora do git, mas no disco). Ferramenta: `scripts/banco_inep.py`, com o venv em `.cache/venv`. Nunca inventar questão nem "simular" uma.
- Revisão independente de cada aula: reler a aula em uma passada separada, conferindo cada questão com o PDF oficial e a checklist do spec (§10). Depois registrar em `progresso.md` (ex.: "revisor: PASS na 2ª leitura" ou o que foi corrigido).
- Decisões de método vão no topo de `progresso.md`, com data.

## Aba DS e Aba Escolar
- DS: uma mega aula por semana, a partir de `C:\Users\MAX\Desktop\Desenvolvimento de sistemas`. Estado, formato e correções em `docs/ds/estado.md`.
- Escolar: material em `C:\Users\MAX\Desktop\Escolar\<Matéria>\Aula N.pdf`. Sem seção de questões ("aula pura").
- Textos protegidos (poema, conto, letra de música) não são reproduzidos. Entram resumo, análise e link da fonte.

## Mapas das abas
- A ordem e o "Em breve" de cada aba vêm de um mapa em `src/data/`: `enem-mapa.json` (escrito à mão, ordem de aprendizado), `ds-mapa.json` (gerado por `scripts/mapear-ds.mjs`) e `escolar-mapa.json` (gerado por `scripts/mapear-escolar.mjs`, com `PDFTOTEXT=/mingw64/bin/pdftotext.exe`).
- O `order` do frontmatter do ENEM não manda mais na ordem.
- Aula do mapa sem `.mdx` aparece como "Em breve" ou "Sem material", sem link e fora do progresso.
- Um `.mdx` do ENEM que não esteja no mapa quebra o build.
- Ao concluir uma aula da Fase 4 do ENEM, trocar a entrada do mapa por `{ "slug" }`.
- Se uma aula nova não aparecer no `astro dev`, o cache pode estar velho: dar `touch` no arquivo ou reiniciar o servidor.

## Validar antes de dizer que está pronto
- Aula: `node scripts/validar-aula.mjs <aula>`
- Build no PowerShell: `$env:BASE_PATH='/caderno-de-estudos'; npx astro build`
- Build no Git Bash: `MSYS2_ENV_CONV_EXCL=BASE_PATH BASE_PATH=/caderno-de-estudos npx astro build` (sem a variável, o Git Bash reescreve o caminho e o build quebra)
- Quiz: `node scripts/checar-quiz.mjs <materia>/<tema>`, depois do build
- Figuras SVG: `scripts/checar-figuras-no-navegador.js`
- Nunca afirmar que algo funciona sem ter rodado a checagem correspondente. Se não deu para rodar, dizer isso.

## Git
- Push na `main` só ao fim de cada matéria. No meio de uma matéria, não publicar.
- Não commitar fora desse caso sem pedido do Max.
- Commits e PRs saem só em nome do Max. Não incluir `Co-Authored-By` nem a linha "Generated with Claude Code", mesmo que a ferramenta sugira.
- Se um commit saiu com essas linhas, reescrever só o que ainda não foi publicado. Nunca reescrever a `main`.
