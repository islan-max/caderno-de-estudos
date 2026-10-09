# Handoff entre agentes

Log compartilhado entre Claude e Codex (e qualquer outro agente) que trabalham neste repo. Cada agente lê a última entrada antes de começar e acrescenta uma entrada no fim ao terminar. Regras completas no `AGENTS.md`. O detalhe de cada sessão fica em `docs/sessoes/` (modelo em `docs/sessoes/modelo.md`).

Formato de cada entrada, curto:

- **Data e agente:**
- **Detalhes:** link para o arquivo da sessão.
- **Estado:** o que está pronto e o que foi verificado (com o comando que rodou).
- **Próximo passo:** exato, com caminho do arquivo.
- **Pendências:** o que depende do Max.

---

## 08/10/2026 · Claude (Claude Code) · preparação do handoff

- **Detalhes:** [docs/sessoes/2026-10-08-preparacao-handoff.md](sessoes/2026-10-08-preparacao-handoff.md)
- **Estado:** `AGENTS.md`, `CLAUDE.md` e este arquivo criados. Nenhum código alterado, build não rodado nesta sessão.
- **Próximo passo:** confirmar com o Max se os 39 arquivos sem commit (naquele momento) vão para um commit de checkpoint.
- **Pendências:** decidir se `docs/aulas/` fica no git (a memória diz que não, o `git ls-files` mostra que sim); o Cowork não vê trabalho sem commit.

## 08/10/2026 · Claude (Claude Code) · transições, mapas, visual DS/Escolar

- **Detalhes:** [docs/sessoes/2026-10-08-transicoes-mapas-visual.md](sessoes/2026-10-08-transicoes-mapas-visual.md)
- **Estado:** pronto segundo a sessão que fez o trabalho: `npm run build` com 204 páginas, checagens de contraste e acessibilidade passando. Não reverificado nesta passagem.
- **Próximo passo:** continuar a Fase 4 do ENEM em `matematica-basica/divisibilidade-e-fatoracao` (primeira linha pendente de `docs/aulas/progresso.md`).
- **Pendências:** reiniciar o `astro dev` da porta 4321, que pode estar com cache velho.
