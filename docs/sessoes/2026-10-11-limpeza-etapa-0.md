# Sessão 2026-10-11 · Claude (Claude Code) · limpeza da etapa 0

- **Pedido:** analisar o plano e o código do Codex e executar a etapa 0 do novo plano (`docs/plano-aprendizagem.md`).
- **Decisões:** (11/10) o Max aceitou as 4 sugestões do plano: formatos novos só em flashcards e DS/Escolar; `localStorage` em vez de IndexedDB; `.claude/skills/`, `.mcp.json` e `.specify/` fora do git; ordem das etapas 0 a 2 antes de intercalar com aulas do ENEM. Motivo: o código do Codex gravava eventos que ninguém lia e o onboarding não alterava nada.
- **Arquivos alterados:**
  - `src/lib/learning.ts`: removido (IndexedDB, eventos, perfil).
  - `src/scripts/app.ts`: `montarHoje` reduzido a uma ação (retomar aula começada ou próxima do ENEM) com o motivo; saíram os eventos e o onboarding. Mantido o estado textual da trilha em `refletirProgresso`.
  - `src/scripts/quiz.ts`: voltou ao estado anterior (sem o evento `cdt:questao-corrigida`).
  - `src/pages/index.astro`: saíram o diálogo de onboarding, o botão "Personalizar" e o CSS deles.
  - `.gitignore`: ferramentas locais de agentes.
  - `src/components/TrilhaAulas.astro` e `src/pages/enem/[materia]/index.astro`: mantidos (estado textual).
- **Descartado:** perfil, onboarding de 3 etapas e IndexedDB. Voltam só se alterarem algo visível (etapa 4 do plano).
- **Verificado:** `astro build` com 204 páginas; `validar-aula` sem erro; `checar-quiz matematica-basica/equacoes-de-primeiro-e-segundo-grau` ok; contraste e acessibilidade sem problema; no `astro dev`, a home mostra o `Hoje` com motivo, sem diálogo de onboarding, e a trilha de Matemática Básica mostra "Não iniciada". Não testado: leitor de tela, 320 px, Firefox/Safari.
- **Próximo passo:** etapa 1 do plano (fundação: módulo `src/lib/aprendizagem/`, eventos com `questaoId`, schema de conceitos em `src/content.config.ts`).
