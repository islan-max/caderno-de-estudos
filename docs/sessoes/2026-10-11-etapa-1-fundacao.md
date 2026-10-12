# Sessão 2026-10-11 · Claude (Claude Code) · etapa 1: fundação

- **Pedido:** executar a etapa 1 de `docs/plano-aprendizagem.md`.
- **Decisões:** (11/10) `localStorage` com versão (`cdt:v2:eventos`), sem IndexedDB. Só três tipos de evento por ora (`aula_concluida`, `questao_respondida`, `correcao`); os outros entram com as etapas que os usam. Abrir aula não gera evento. Id da questão = `<aulaId>#q<n>` (posição no gabarito). Desmarcar uma aula grava uma `correcao` que anula a conclusão; nada é apagado.
- **Arquivos alterados:**
  - `src/lib/aprendizagem/`: `eventos.ts` (tipos, vigentes), `armazem.ts` (leitura/gravação e importação do `cdt:progresso`), `estados.ts` (estado do conceito), `conceitos.ts` (validação de ids), `metricas.ts` (definições e fórmulas), `aprendizagem.test.ts` (11 testes).
  - `src/data/conceitos.json`: registro de conceitos, vazio até a etapa 2.
  - `src/content.config.ts`: campo `conceitos` na aula e em cada item do `gabarito`; id fora do registro quebra o build.
  - `scripts/validar-aula.mjs`: aceita `conceitos` no frontmatter.
  - `src/scripts/quiz.ts`: avisa `cdt:questao-corrigida` (só quando há resposta marcada).
  - `src/scripts/app.ts`: `marcar` grava conclusão ou correção; `ligarAulaAtual` grava a resposta; `iniciar` importa o progresso antigo.
  - `package.json` e `.github/workflows/ci.yml`: `npm test` na CI.
- **Descartado:** evento ao abrir aula; métricas guardadas como totais; validar conceitos também em `validar-aula.mjs` (o schema do Astro já quebra o build).
- **Verificado:** `npm test` (11 de 11); build com 204 páginas; um conceito inexistente numa aula quebrou o build e foi desfeito; `validar-aula` sem aviso; `checar-quiz` em `porcentagem` e `fracoes`; contraste e acessibilidade sem problema; no navegador, o progresso antigo virou 1 evento, uma resposta gerou exatamente 1 evento com `questaoId`, e marcar/desmarcar gerou `aula_concluida` e `correcao`. Não verificado: `checar-quiz` nas 124 aulas, `astro check` (tipos), outros navegadores.
- **Limites conhecidos:** `aula_concluida` ainda não carrega os conceitos da aula (entram com o mapeamento da etapa 2). "Revisão em dia" não conta no estado do conceito (etapa 3). O id da questão muda se a ordem das questões na aula mudar.
- **Próximo passo:** etapa 2 do plano, piloto de Matemática Básica: cadastrar conceitos em `src/data/conceitos.json`, mapear `conceitos` nas 6 aulas e nas 30 questões de `src/content/enem/matematica-basica/`, e mostrar conceito e link da seção após um erro.
