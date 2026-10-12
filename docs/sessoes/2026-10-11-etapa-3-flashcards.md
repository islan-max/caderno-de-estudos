# Sessão 2026-10-11 · Claude (Claude Code) · etapa 3: flashcards e revisão espaçada

- **Pedido:** seguir o plano até o fim; esta é a etapa 3.
- **Decisões:** (11/10) 26 cartões escritos à mão nas 6 aulas de Matemática Básica, a partir dos "Tópicos-Chave"; formatos `pergunta`, `lacuna` e `verdadeiro-falso`. O estado do cartão (caixa e vencimento) é calculado reproduzindo as revisões gravadas como eventos, sem guardar total. Cartão nunca visto é "novo", não "vencido". Sessão com no máximo 10 cartões; vencidos primeiro (o mais atrasado antes), depois novos. "Com dificuldade" não conta como acerto nem erro no estado do conceito; "lembrei" conta como acerto e "não lembrei" como erro.
- **Arquivos alterados:**
  - `src/lib/aprendizagem/revisao.ts`: caixas, vencimento e fila (puro, testado). `eventos.ts`, `estados.ts`, `metricas.ts`, `armazem.ts`: evento `cartao_revisado`.
  - `src/content.config.ts`: `cartoes` no frontmatter (id único na aula, tipo, conceito validado). `scripts/validar-aula.mjs`: aceita `cartoes`.
  - 6 aulas de `src/content/enem/matematica-basica/`: os 26 cartões.
  - `src/pages/cartoes.json.ts`: arquivo estático com os cartões. `src/pages/revisao.astro` e `src/scripts/revisao.ts`: a página `/revisao/`, com "Como calculamos". `src/scripts/app.ts`: liga a página.
- **Descartado:** gerar cartões dos parágrafos; animação de virar; link para `/revisao/` fora desta etapa (entra no `Hoje`, etapa 4).
- **Verificado:** `npm test` (19 de 19, incluindo a tabela das caixas); build com 205 páginas; `validar-aula` e `checar-quiz` nas 124 aulas; contraste e acessibilidade sem problema; no navegador, a fila de 10 cartões gerou 10 eventos, mostrou o fim com contagem, voltar à página no mesmo dia trouxe outros 10 cartões, e o foco foi para a resposta ao revelar. Não verificado: leitor de tela, 320 px, só teclado de ponta a ponta, mudança de fuso.
- **Limites conhecidos:** a página só tem cartões do ENEM e só de Matemática Básica. Ainda não há link para `/revisao/` em nenhuma tela. Os intervalos usam o dia local do navegador.
- **Próximo passo:** etapa 4: trilha com estado "Precisa revisar", `Hoje` com revisão vencida e link para `/revisao/`, e questionário só com efeito visível.
