# Sessão 2026-10-09 · Codex · jornada ENEM

- **Pedido:** seguir a implementação pela jornada da matéria.
- **Decisões:** 09/10/2026: aproveitar a trilha existente e mostrar apenas estados que os dados atuais sustentam: `Não iniciada`, `Em estudo` e `Concluída`. `Precisa revisar` fica para depois do mapeamento de conceitos e das revisões; não será exibido por suposição. A trilha nunca bloqueia uma aula.
- **Arquivos alterados:** `src/components/TrilhaAulas.astro` ganha selo textual e semântico de estado, opcional para não alterar DS e Escolar; `src/pages/enem/[materia]/index.astro` habilita o selo no ENEM; `src/scripts/app.ts` deriva o estado da mesma fonte de progresso e andamento usada pelo anel.
- **Descartado:** agrupamento por unidade e pré-requisitos explícitos dependem de ampliar `enem-mapa.json` e validá-lo, então não foram inventados nesta etapa.
- **Verificado:** `$env:BASE_PATH='/caderno-de-estudos'; npx astro build` passou com 204 páginas. `node scripts/checar-acessibilidade.mjs --base /caderno-de-estudos` verificou 204 páginas com 0 erro e 0 aviso. A página local de Biologia mostrou `Em estudo` em Bioquímica e `Não iniciada` nas demais aulas disponíveis.
- **Próximo passo:** evoluir o contrato de conteúdo em `src/content.config.ts` e os validadores para IDs de conceito e metadados das questões oficiais, antes de criar recomendações ou diagnósticos.
