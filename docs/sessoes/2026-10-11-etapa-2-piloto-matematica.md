# Sessão 2026-10-11 · Claude (Claude Code) · etapa 2: piloto de Matemática Básica

- **Pedido:** executar a etapa 2 de `docs/plano-aprendizagem.md` e seguir as demais etapas até o fim, commitando e fazendo merge.
- **Decisões:** (11/10) um conceito por seção numerada da Aula Teórica; cada questão herda o conceito da seção que o próprio "Revisar:" dela já indicava. Assim o mapeamento é mecânico e conferível, sem invenção. Recomendação só onde a aula diz "revise a aula de X" em "Antes de Começar" (7 casos). Dispensar uma recomendação vale para a aula recomendada, em todas as questões.
- **Arquivos alterados:**
  - `src/data/conceitos.json`: 34 conceitos de Matemática Básica.
  - 6 aulas em `src/content/enem/matematica-basica/`: `conceitos` na aula e em cada questão; `recomendar` (aula, título, motivo em texto) em 7 questões.
  - `src/content.config.ts`: campo `recomendar` no gabarito.
  - `scripts/validar-aula.mjs`: confere que a aula recomendada existe e que o título bate.
  - `src/scripts/quiz.ts`: a explicação vira texto + link para a seção a rever (vale para as 124 aulas, pois lê o "Revisar:" que já existia) + recomendação com botão Dispensar quando o estudante erra.
  - `src/lib/aprendizagem/armazem.ts`: dispensar recomendação. `src/styles/global.css`: estilo do link e da recomendação.
- **Descartado:** ids de questão novos e campo `revisar` separado (o "Revisar:" do `porque` já faz o trabalho); migrar agora as outras 54 recomendações `conteudoComplementar` (só depois da avaliação do piloto, como o plano pede).
- **Verificado:** `npm test` (12 de 12); build com 204 páginas; `validar-aula` sem aviso nas 124; `checar-quiz` nas 124 aulas; contraste e acessibilidade sem problema; título errado em `recomendar` foi barrado pelo validador (e desfeito); no navegador, errar a questão 1 de Porcentagem mostra o link da seção (o destino existe) e a recomendação "Frações", e Dispensar a remove e grava `cdt:v2:dispensadas`. Não verificado: leitor de tela, 320 px, aparência (só conferi a estrutura).
- **Limites conhecidos:** `conteudoComplementar` das 6 aulas segue como estava (bloco "Conteúdo complementar"). O conceito ainda não aparece por nome ao estudante; ele alimenta o estado do conceito, usado nas etapas seguintes.
- **Próximo passo:** etapa 3: flashcards em `src/content` e fila de revisão.
