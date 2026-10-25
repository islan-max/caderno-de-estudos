# Relatório de verificação: plataforma de estudo (metas, recomendações, resumo de vídeo)

Modelo: checklist de publicação e relatório de verificação do guia de desenvolvimento. Escopo **só do que foi acrescentado nesta etapa**: metas semanais, recomendador de aulas, resumo de vídeo e a atualização de dependências. O restante do caderno (aulas, revisão, Hoje) tem a sua documentação própria (`docs/acessibilidade.md`) e não é reavaliado aqui.

## Identificação

- Projeto: `islan-max/caderno-de-estudos`, site estático no GitHub Pages
- Versão: `main` depois do PR #28 (mais o PR deste relatório)
- Ambiente testado: Windows (Node 24) e GitHub Actions (Ubuntu, Node 24); **publicado** em `https://islan-max.github.io/caderno-de-estudos/`, conferido depois do deploy
- Data/executor: 25/10/2026, agente de IA com a conta do responsável. Escopo: código, 80 testes, build, verificadores de contraste e acessibilidade, navegador do app e o site publicado

## Evidências por controle

`T:` teste automatizado. `CI:` GitHub Actions. `B:` navegador do app (local ou no site publicado).

| ID | Criticidade | Esperado | Observado | Estado | Evidência |
|---|---|---|---|---|---|
| S01-01 | Bloqueador | Sem segredos no código nem no histórico | Não há chaves, tokens nem servidores neste repositório; **nenhuma varredura (gitleaks) foi executada** | NÃO VERIFICADO | pendente: varredura no CI |
| S02-01 | Bloqueador | Autenticação e permissões | Não há login nem servidor; dados só no navegador de quem usa | N/A | `docs/plano-aprendizagem.md`, README |
| S03-01 | Bloqueador | Banco e isolamento | Não há banco | N/A | — |
| S04-01 | Bloqueador | Entrada validada | `cdt:metas` e `cdt:recomendacao` são normalizados ao ler, gravar e importar (matéria e id por expressão fixa, 1 a 7 dias, 1 ou -1, limites de 12 metas, 12 interesses e 500 avaliações; `__proto__` e lixo descartados). A transcrição tem limites (1 MB, 60 mil palavras, 3 h) e o endereço aceita só hosts do YouTube | APROVADO | T: `estudo.test.ts`, `recomendacao.test.ts`, `resumo.test.ts` |
| S04-02 | Bloqueador | Texto de fora nunca vira HTML ativo | A página escapa título, motivo e frases da transcrição antes de montar o HTML (`escapar`); links do vídeo são montados só a partir do código de 11 caracteres validado. **Não há teste automatizado desse caminho no DOM**; conferido só lendo o código e no navegador com texto normal | APROVADO (parcial) | B, revisão do código |
| S05-01 | Bloqueador | Upload | O `.vtt/.srt/.txt` é lido no navegador (`File.text()`), não sobe a lugar nenhum; tamanho limitado a 1 MB | APROVADO | B |
| S06-01 | Bloqueador | Dados e respostas | Nada do resumo é guardado; metas e recomendações ficam no `localStorage`; exportação gera arquivo local | APROVADO | B, `privacidade.astro` |
| S07-01 | Bloqueador | HTTPS e cabeçalhos | HTTPS e HSTS vêm do GitHub Pages. **Cabeçalhos próprios (CSP, nosniff) não são controlados em Pages** e não há `<meta>` de CSP | NÃO VERIFICADO | limitação da hospedagem |
| S08-01 | Recomendado | Limites | Sem servidor não há o que limitar além do tamanho do arquivo e da transcrição | N/A | — |
| S09-01 | Bloqueador | Dependências sem vulnerabilidades conhecidas | `npm audit --omit=dev` tinha 14 achados (1 crítico em `astro`); depois do PR #28 restam **2 moderados** em `postcss-selector-parser` via `@tailwindcss/typography` (CPU ao analisar seletores, só no build). O conserto automático propõe rebaixar o plugin e não foi aplicado | FALHOU (2 moderados) | CI: não roda `npm audit`; rodado à mão |
| Q01-01 | Bloqueador | Funcionamento | Metas: definir, rejeitar valor inválido, remover; Recomendações: marcar matéria, dar 👍, desfazer; Resumo: erros de campo vazio e de endereço fora do YouTube, 3 trechos, link do minuto, desmarcar reduz o texto exportado. Conferido local e, para o resumo, também no site publicado | APROVADO | B |
| Q01-02 | Bloqueador | Celular | Layout usa as mesmas regras responsivas do caderno, **não foi aberto em celular nem em largura estreita** | NÃO VERIFICADO | pendente |
| Q01-03 | Recomendado | Outros navegadores | Só o navegador do app (Chromium) | NÃO VERIFICADO | pendente |
| A11Y-01 | Bloqueador | Verificadores do repositório | `checar-contraste.mjs` (todos os pares passam, 4 temas) e `checar-acessibilidade.mjs` (234 páginas, 0 erros, 0 avisos) | APROVADO | CI |
| A11Y-02 | Recomendado | Leitor de tela e teclado | Rótulos (`label`, `aria-describedby`, texto só para leitor nos quadrados da semana e nos links), avisos por `role="status"/"alert"` e foco devolvido ao título da lista; **não foi usado leitor de tela real** | NÃO VERIFICADO | pendente |
| F-01 | Bloqueador | Regras de metas, recomendação e resumo corretas | 80 testes: semana de segunda a domingo e horário de verão, situação da meta, histórico; nota e motivo do recomendador, exclusão de concluídas/avaliadas, desempate; formatos VTT/SRT/texto copiado, legenda rolante, limites, avisos, exportação | APROVADO | T, CI |
| F-02 | Recomendado | Avaliação do recomendador | Offline com pessoas sintéticas (`docs/recomendacao.md`): a medida informativa é chegar à matéria só curtida (77,6% contra 0% sem 👍); a precisão de 100% é circular. **Não foi avaliado com pessoas reais** | APROVADO (parcial) | `scripts/avaliar-recomendacao.ts` |
| F-03 | Recomendado | Qualidade do resumo | Testado com legendas sintéticas e um exemplo de 7 frases em que o resumo deixou de fora as definições principais (`docs/resumo-de-video.md`). **Nenhuma transcrição real de vídeo foi usada** | NÃO VERIFICADO | pendente |
| I01-01 | Bloqueador | Build e publicação | `npm ci`, build (234 páginas) e deploy do Pages verdes depois da atualização; CI e publicação passaram para Node 24 porque o Astro 7.4 exige Node 22.23.4 ou mais novo | APROVADO | CI, `gh run list` |
| D01-01 | Bloqueador | Privacidade | Nenhum rastreador, nenhum envio; a página de privacidade lista `cdt:metas` e `cdt:recomendacao` e diz que o resumo não guarda nada | APROVADO | `privacidade.astro` |
| V01–V03 | — | SEO, descoberta, identidade | Fora do escopo desta etapa | N/A | — |

## Pendências

| Controle | Impacto | O que falta |
|---|---|---|
| S01-01 | Bloqueia "publicado e verificado" | Rodar gitleaks no histórico (e pôr no CI) |
| S09-01 | Moderado, só no build | Esperar versão de `@tailwindcss/typography` que não dependa do `postcss-selector-parser` vulnerável; pôr `npm audit` no CI |
| Q01-02, Q01-03, A11Y-02 | Recomendados | Testar em celular, em Firefox/Safari e com leitor de tela |
| F-03 | Recomendado | Testar o resumo com transcrições reais (dois ou três vídeos) e anotar o que falha |
| S07-01 | Limite da hospedagem | Se importar, publicar atrás de um serviço que permita CSP |

## Parecer

- Estado: **PRONTO PARA PUBLICAÇÃO CONTROLADA** (já está publicado, mas não "publicado e verificado no escopo": há bloqueadores sem evidência, S01-01 e S07-01, e dois achados moderados de dependência).
- Justificativa: regras testadas, verificadores de contraste e acessibilidade verdes, fluxos conferidos no navegador e no site publicado; o que falta é de segurança do repositório e de teste em dispositivos reais.
- Limitações: verificação feita pelo próprio autor do código, num só navegador; este relatório não afirma acessibilidade nem segurança absolutas.
