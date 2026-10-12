# Sessão 2026-10-09 · Codex · fundação do ciclo de aprendizagem

- **Pedido:** iniciar a implementação do plano de aprendizagem personalizada.
- **Decisões:** 09/10/2026: manter o conteúdo estático e começar por eventos locais no IndexedDB; o progresso legado continua intacto no `localStorage` e é importado uma vez.
- **Arquivos alterados:** `src/lib/learning.ts` cria o armazenamento local versionado e a migração; `src/scripts/app.ts` registra abertura e conclusão de aula e consome eventos do quiz; `src/scripts/quiz.ts` emite o resultado de cada questão corrigida.
- **Descartado:** sincronização, diagnóstico, flashcards e nova interface ainda não entram nesta fundação; dependem do modelo de conceitos e de curadoria editorial.
- **Verificado:** `$env:BASE_PATH='/caderno-de-estudos'; npx astro build`, `node scripts/checar-quiz.mjs src/content/enem/matematica-basica/fracoes.mdx` e `node scripts/checar-acessibilidade.mjs --base /caderno-de-estudos` passaram; build com 204 páginas e 0 erro/aviso.
- **Próximo passo:** criar o perfil opcional e o bloco `Hoje` em `src/pages/index.astro`, consumindo a camada de `src/lib/learning.ts`.
