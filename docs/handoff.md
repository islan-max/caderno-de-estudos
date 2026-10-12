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

## 09/10/2026 · Codex · validação do acervo ENEM e CI

- **Detalhes:** [docs/sessoes/2026-10-09-validacao-acervo-ci.md](sessoes/2026-10-09-validacao-acervo-ci.md)
- **Estado:** concluído. `node scripts/validar-aula.mjs src/content/enem` passou nas 124 aulas sem erro. Build, 124 quizzes, contraste e acessibilidade passaram. A CI agora valida as aulas e os quizzes com o `BASE_PATH` correto.
- **Próximo passo:** criar `matematica-basica/divisibilidade-e-fatoracao`, primeira linha não concluída de `docs/aulas/progresso.md`.
- **Pendências:** 28 avisos editoriais de termos no glossário exigem revisão manual. A verificação geométrica das figuras SVG no navegador continua manual.

## 09/10/2026 · Codex · revisão dos glossários ENEM

- **Detalhes:** [docs/sessoes/2026-10-09-validacao-acervo-ci.md](sessoes/2026-10-09-validacao-acervo-ci.md#revisão-dos-glossários)
- **Estado:** concluído. As 28 aulas com aviso foram revisadas. `node scripts/validar-aula.mjs src/content/enem` terminou com 124 aulas, 0 erro e 0 aviso. Build com 204 páginas e os 124 quizzes passaram.
- **Próximo passo:** criar `matematica-basica/divisibilidade-e-fatoracao`, primeira linha não concluída de `docs/aulas/progresso.md`.
- **Pendências:** a verificação geométrica das figuras SVG no navegador continua manual.

## 09/10/2026 · Codex · fundação da aprendizagem personalizada

- **Detalhes:** [docs/sessoes/2026-10-09-fundacao-aprendizagem.md](sessoes/2026-10-09-fundacao-aprendizagem.md)
- **Estado:** concluído. Eventos locais no IndexedDB e importação idempotente do progresso legado; abertura, conclusão e correção de questão já são registradas. Build com 204 páginas, quiz e acessibilidade passaram.
- **Próximo passo:** criar perfil opcional e bloco `Hoje` em `src/pages/index.astro` usando `src/lib/learning.ts`.
- **Pendências:** conceitos, recomendações, flashcards, sessões, diagnóstico e sincronização ainda não foram implementados.

## 09/10/2026 · Codex · orientação inicial: Hoje e perfil

- **Detalhes:** [docs/sessoes/2026-10-09-hoje-e-perfil.md](sessoes/2026-10-09-hoje-e-perfil.md)
- **Estado:** concluído. A home sugere uma aula por vez, explica o motivo e aceita perfil opcional salvo localmente. Build com 204 páginas, contraste e acessibilidade passaram; o fluxo foi aberto no navegador local.
- **Próximo passo:** evoluir `src/components/TrilhaAulas.astro` e o mapa ENEM para mostrar estados textuais de jornada, sem bloquear aulas.
- **Pendências:** não há grafo de pré-requisitos, conceitos ou revisões ainda; portanto `Hoje` só combina aula em andamento, prioridades e ordem curricular.

## 09/10/2026 · Codex · jornada ENEM com estados explícitos

- **Detalhes:** [docs/sessoes/2026-10-09-jornada-enem.md](sessoes/2026-10-09-jornada-enem.md)
- **Estado:** concluído. A trilha de cada matéria ENEM mostra `Não iniciada`, `Em estudo` ou `Concluída`, calculado do mesmo progresso local do anel. Build e acessibilidade passaram; fluxo conferido no navegador local.
- **Próximo passo:** expandir `src/content.config.ts` e os validadores para conceitos e metadados das questões oficiais antes de recomendações ou diagnóstico.
- **Pendências:** unidades, pré-requisitos e `Precisa revisar` exigem mapeamento editorial e ainda não existem no acervo.

## 09/10/2026 · Codex · correção do onboarding inicial

- **Detalhes:** [docs/sessoes/2026-10-09-onboarding-corrigido.md](sessoes/2026-10-09-onboarding-corrigido.md)
- **Estado:** concluído. O formulário grande saiu da home. O onboarding tem três etapas, `Pular por enquanto`, foco controlado, diálogo nativo e seletores personalizados mantendo o controle HTML acessível; a home mostra só a sugestão `Hoje`. Build, contraste, acessibilidade e fluxo no navegador passaram.
- **Próximo passo:** expandir `src/content.config.ts` e os validadores para conceitos e metadados das questões oficiais, antes de recomendações ou diagnóstico.
- **Pendências:** objetivo e disponibilidade são coletados conforme o contrato, mas ainda não podem alterar a priorização enquanto a rotina ENEM não tiver metas, revisão e planejamento semanal implementados; a única escolha usada hoje é a prioridade de matérias.

## 11/10/2026 · Claude (Claude Code) · limpeza da etapa 0 do novo plano

- **Detalhes:** [docs/sessoes/2026-10-11-limpeza-etapa-0.md](sessoes/2026-10-11-limpeza-etapa-0.md)
- **Estado:** concluído, **sem commit**, no branch `etapa-0-limpeza`. O estado anterior do Codex está no branch `backup/codex-aprendizagem-2026-10-09`. Removidos IndexedDB, eventos e onboarding; mantidos o estado textual da trilha e o `Hoje` com uma ação. Build com 204 páginas e checagens passaram.
- **Próximo passo:** etapa 1 de `docs/plano-aprendizagem.md` (fundação sobre `localStorage`). As 4 decisões pendentes do plano foram aceitas pelo Max.
- **Pendências:** decidir se commita e faz merge do branch; a retomada do ENEM (`matematica-basica/divisibilidade-e-fatoracao`) segue pendente.

## 11/10/2026 · Claude (Claude Code) · etapa 1: fundação da aprendizagem

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-1-fundacao.md](sessoes/2026-10-11-etapa-1-fundacao.md)
- **Estado:** concluído no branch `etapa-1-fundacao`, com commit; sem merge nem push. `npm test` com 11 testes, build com 204 páginas e checagens passando.
- **Próximo passo:** etapa 2 de `docs/plano-aprendizagem.md` (piloto de Matemática Básica), começando por `src/data/conceitos.json`.
- **Pendências:** o Max decide o merge na `main` e o push.

## 11/10/2026 · Claude (Claude Code) · etapa 2: piloto de Matemática Básica

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-2-piloto-matematica.md](sessoes/2026-10-11-etapa-2-piloto-matematica.md)
- **Estado:** concluído, commitado e mesclado na `main` local (sem push). 34 conceitos, questões ligadas a conceito, link para a seção a rever e recomendação com motivo.
- **Próximo passo:** etapa 3 (flashcards).
- **Pendências:** avaliar o piloto antes de expandir os conceitos para as outras matérias.

## 11/10/2026 · Claude (Claude Code) · etapa 3: flashcards e revisão espaçada

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-3-flashcards.md](sessoes/2026-10-11-etapa-3-flashcards.md)
- **Estado:** concluído, commitado e mesclado na `main` local (sem push). 26 cartões, página `/revisao/`, fila diária e caixas testadas.
- **Próximo passo:** etapa 4 do plano.
- **Pendências:** nenhum link para `/revisao/` ainda; vem com o `Hoje`.

## 11/10/2026 · Claude (Claude Code) · etapa 4: jornada, Hoje e personalização

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-4-hoje-e-jornada.md](sessoes/2026-10-11-etapa-4-hoje-e-jornada.md)
- **Estado:** concluído, commitado e mesclado na `main` local (sem push). `Hoje` com até 3 ações e motivo, trilha com unidades, "Precisa revisar" e aviso de pré-requisito, personalização com efeito visível.
- **Próximo passo:** etapa 5 (diagnóstico).
- **Pendências:** nenhuma.

## 11/10/2026 · Claude (Claude Code) · etapa 5: diagnóstico

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-5-diagnostico.md](sessoes/2026-10-11-etapa-5-diagnostico.md)
- **Estado:** concluído, commitado e mesclado na `main` local (sem push). "Ver o que ficou" por unidade, sem nota. Diferença do plano: não há tela de prova separada (explicado na sessão).
- **Próximo passo:** etapa 6 (acompanhamento).
- **Pendências:** o Max decide se quer, no futuro, uma tela de checkpoint própria com questões.

## 11/10/2026 · Claude (Claude Code) · etapa 6: acompanhamento (fim do plano)

- **Detalhes:** [docs/sessoes/2026-10-11-etapa-6-acompanhamento.md](sessoes/2026-10-11-etapa-6-acompanhamento.md)
- **Estado:** etapas 0 a 6 de `docs/plano-aprendizagem.md` concluídas, commitadas e mescladas na `main` local. **Sem push.** Páginas novas: `/revisao/` e `/meu-aprendizado/`. 41 testes (`npm test`), build com 206 páginas.
- **Próximo passo:** o Max usa por uma ou duas semanas (parada obrigatória do plano) e decide se expande conceitos e cartões para outras matérias. Depois, voltar às aulas do ENEM: `matematica-basica/divisibilidade-e-fatoracao`.
- **Pendências:** push na `main` quando o Max pedir; avaliar leitor de tela e 320 px, que não foram testados.
