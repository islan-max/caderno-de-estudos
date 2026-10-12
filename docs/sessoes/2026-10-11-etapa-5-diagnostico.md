# Sessão 2026-10-11 · Claude (Claude Code) · etapa 5: diagnóstico

- **Pedido:** seguir o plano até o fim; esta é a etapa 5.
- **Decisões:** (11/10) o diagnóstico é calculado das respostas que o estudante já deu nas questões oficiais das aulas e nos cartões. **Não criei uma tela de prova nova.** Motivo: as questões existem como texto dentro de cada aula, e um segundo renderizador de questões seria um trabalho à parte; as 5 questões de cada aula, já mapeadas a conceitos, são o checkpoint. Ele aparece na trilha, por unidade, como "Ver o que ficou". Estados: firme, parcial, lacuna e dados insuficientes (menos de 2 respostas, nunca uma conclusão com uma resposta só). Sem nota, sem porcentagem. Lacuna aponta a aula e os cartões; "Como chegamos nisso" lista as evidências. Unidade sem nenhum conceito com dados diz que ainda não dá para concluir.
- **Arquivos alterados:**
  - `src/lib/aprendizagem/diagnostico.ts` (novo, testado) e `metricas.ts` (definição "O que ficou").
  - `src/lib/aulas.ts`: conceitos da aula, com nome, na trilha. `src/components/TrilhaAulas.astro`: bloco "Ver o que ficou" por unidade, com "Como calculamos". `src/scripts/app.ts`: `montarFicou`.
- **Descartado:** checkpoint como tela separada de questões; nota ou percentual por unidade.
- **Verificado:** `npm test` (33 de 33); build com 205 páginas; `validar-aula` e `checar-quiz` nas 124 aulas; contraste e acessibilidade sem problema; no navegador, sem respostas as 3 unidades de Matemática Básica dizem "ainda não há respostas suficientes"; com eventos de teste, uma resposta única ficou "dados insuficientes", erro depois de acerto virou "lacuna" e erro seguido de acertos em dias diferentes virou "firme", com a lista de evidências. Não verificado: leitor de tela e 320 px.
- **Limites conhecidos:** só Matemática Básica tem conceitos mapeados. "Parcial" ainda não aparece sozinho na tela (precisa de dados reais de uso). A unidade "Números e operações" não inclui Divisibilidade (ainda sem aula).
- **Próximo passo:** etapa 6: sessões calculadas, estudo externo, edição e exclusão, e a página "Meu aprendizado".
