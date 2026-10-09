# Handoff entre agentes

Log compartilhado entre Claude e Codex (e qualquer outro agente) que trabalham neste repo. Cada agente lê a última entrada antes de começar e acrescenta uma entrada no fim ao terminar. Regras completas no `AGENTS.md`.

Formato de cada entrada:

- **Data e agente:**
- **Arquivos tocados:**
- **Estado:** o que está pronto, o que está pela metade e o que foi verificado (com o comando que rodou).
- **Próximo passo:** exato, com caminho do arquivo.
- **Pendências:** o que depende do Max.

---

## 08/10/2026 · Claude (Claude Code) · montagem do handoff

- **Arquivos tocados:** `AGENTS.md`, `CLAUDE.md` (importa o AGENTS.md), `docs/handoff.md`. Nenhuma aula foi alterada.
- **Estado do repo:** último commit `453d690`. Há 39 arquivos modificados e sem commit, todos do trabalho recente de DS, Escolar e ENEM (`src/pages`, `src/components`, `src/lib`, `src/data`, `docs/aulas`, `scripts`). Esse trabalho está só no disco.
- **Build:** não rodado nesta passagem. Antes de publicar qualquer coisa, rodar o build (ver AGENTS.md).
- **ENEM:** próxima aula é `matematica-basica/divisibilidade-e-fatoracao` (linha 161 de `docs/aulas/progresso.md`, pendente).
- **DS:** último bloco de estado em `docs/ds/estado.md`, seção "Aulas de 08/10/2026" (Front-End semana 22, Versionamento semana 21, Língua Portuguesa aula 2 do Escolar).
- **Próximo passo:** confirmar com o Max se os 39 arquivos vão para um commit de checkpoint antes de qualquer outra mudança.
- **Pendências:**
  1. A memória do Claude diz que `docs/aulas/` fica fora do git. O `git ls-files` mostra os três arquivos e o `progresso.md` versionados. Confirmar qual é a decisão atual.
  2. O spec (`docs/aulas/formato-das-aulas-mdx.md`, §9) cita um ambiente "Cowork" que clona o repo do GitHub. Esse ambiente não vê trabalho local sem commit.

## 08/10/2026 · Claude (Claude Code) · transições, tema, mapas, visual DS/Escolar, anel de progresso

- **Arquivos tocados:** `src/layouts/Base.astro`, `src/scripts/app.ts`, `src/styles/global.css` (transições entre abas e troca de tema); `src/data/enem-mapa.json`, `src/data/escolar-mapa.json`, `scripts/mapear-escolar.mjs`, `src/lib/{aulas,dsMapa,escolar,indice,materiasSecoes}.ts` (mapas); `src/components/{AreaMaterias,TrilhaAulas,TopoSecao,TopoMateria,BimestresMateria,Paineis}.astro` e as páginas de `src/pages/{index,ds,escolar,enem}` (visual e home); `package.json` (`js-circle-progress`); docs (`README.md`, `PROMPT_AULA_ENEM.mdx`, `docs/ds/estado.md`, `docs/aulas/progresso.md`). Removida a aula `escolar/matematica/4-bimestre/aula-1-material-indisponivel.mdx`.
- **Estado:** pronto e verificado. `npm run build` (204 páginas), `node scripts/checar-contraste.mjs` e `node scripts/checar-acessibilidade.mjs` passam. Troca de tema medida no Chrome headless (CPU ×4) contra o commit anterior: mais quadros e menos estilo recalculado.
- **Regra nova para o ENEM:** a ordem das aulas vem de `src/data/enem-mapa.json`, não do `order`. Ao concluir uma aula da Fase 4, troque a entrada do mapa (`slug` + `titulo` + `resumo`) por `{ "slug" }`. O build falha se um `.mdx` do ENEM não estiver no mapa.
- **Próximo passo:** continuar a Fase 4 em `matematica-basica/divisibilidade-e-fatoracao` (primeira linha pendente de `docs/aulas/progresso.md`).
- **Pendências:** o servidor `astro dev` da porta 4321 pode estar com cache velho do conteúdo (Front-End e Versionamento de DS aparecem "em breve" nele, mas prontas no build): reiniciar. Commits e PRs só em nome do Max, sem `Co-Authored-By`.
