# Sessão 08/10/2026 · Claude (Claude Code) · preparação do handoff

- **Pedido:** levar o projeto para o Codex sem perder o contexto de trabalho.
- **Decisões:**
  - As regras ficam em `AGENTS.md`, que o Codex lê sozinho. `CLAUDE.md` só importa esse arquivo, para os dois usarem a mesma fonte.
  - O "diálogo" entre os agentes acontece por `docs/handoff.md`, porque não há comunicação direta entre eles.
  - Não rodar os dois agentes ao mesmo tempo na mesma pasta, porque escrevem nos mesmos arquivos.
- **Arquivos alterados:** `AGENTS.md` (novo), `CLAUDE.md` (novo, importa o AGENTS.md), `docs/handoff.md` (novo). Nenhuma aula foi alterada.
- **Descartado:** o histórico bruto da conversa como entrada para o Codex. Ele tem muito ruído e não ajuda a continuar.
- **Estado do repo no momento desta sessão:** último commit `453d690`. Havia 39 arquivos modificados e sem commit, do trabalho recente de DS, Escolar e ENEM (`src/pages`, `src/components`, `src/lib`, `src/data`, `docs/aulas`, `scripts`). Esse trabalho estava só no disco.
- **Verificado:** nada de código foi alterado, então o build não foi rodado nesta sessão.
- **Pendências:**
  1. A memória do Claude diz que `docs/aulas/` fica fora do git. O `git ls-files` mostra os três arquivos e o `progresso.md` versionados. Confirmar qual é a decisão atual.
  2. O spec (`docs/aulas/formato-das-aulas-mdx.md`, §9) cita um ambiente "Cowork" que clona o repo do GitHub. Esse ambiente não vê trabalho local sem commit.
- **Próximo passo:** confirmar com o Max se os 39 arquivos vão para um commit de checkpoint antes de qualquer outra mudança.
