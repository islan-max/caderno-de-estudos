# Plano: personalização, revisão e acompanhamento

Escrito em 12/10/2026. É um plano, não uma especificação: cada fase vira uma spec própria (`/speckit-specify`) antes de ter código.

## 0. Resumo

- O caderno é um site estático (Astro, GitHub Pages). Não tem conta, servidor nem banco. Tudo o que é do estudante fica no `localStorage` do navegador dele. O plano mantém isso: **nada de backend, login ou sincronização**.
- A peça que falta é uma só: **o site não lembra o que o estudante acertou e errou**. O quiz corrige e esquece. Quase todas as funcionalidades pedidas dependem dessa memória.
- A unidade de conhecimento já existe e não custa nada: **a seção da Aula Teórica** (`### N. Nome`). 625 das 647 explicações de gabarito já terminam com `Revisar: Aula Teórica › N. Nome`, e o `validar-aula.mjs` já barra o build se a seção não existir. É o mapa de conceitos pronto.
- Os cartões de revisão também já existem: **os `Tópicos-Chave para Revisão`** (139 aulas). Cada tópico é um título e um parágrafo com as palavras-chave em negrito. É um flashcard de recordação livre.
- Por isso o plano cria pouca coisa nova: um registro de estudo, uma página de revisão, um bloco `Hoje` na home, estados na trilha e uma página `Meu estudo`. O resto é ligar o que já existe.

### Histórico que pesa nesta decisão

Este escopo já foi planejado e implementado duas vezes: pelo Codex (`backup/codex-aprendizagem-2026-10-09`) e pelo Claude em 6 etapas (`backup/seis-fases-claude`), e as duas foram desfeitas. A segunda tinha cerca de 40 arquivos, `conceitos.json` escrito à mão, cartões escritos à mão e três páginas novas, tudo num dia só. Não sei o motivo do último desfazer (o commit `628cefe` só diz "a pedido do Max"). Este plano reduz o que imagino ter pesado: **nenhum metadado novo nas aulas, uma fase por vez, cada uma usada antes da próxima**. Ver a pergunta 1 da seção 7.

## 1. O que existe hoje

| Peça | Onde | Serve para |
|---|---|---|
| 3 coleções (ENEM 124 aulas publicadas, Escolar 8, DS 7) | `src/content/`, `src/content.config.ts` | Conteúdo em MDX. Schema único: `gabarito`, `resources`, `ferramentas` |
| Mapas de ordem | `src/data/{enem,ds,escolar}-mapa.json` | Ordem da trilha e "Em breve". É a jornada linear que já existe |
| Trilha da matéria | `src/components/TrilhaAulas.astro` | Lista numerada com anel de andamento |
| Progresso | `src/scripts/progresso.ts` | `cdt:progresso` (aula vista, com a data), `cdt:andamento` (leitura % e questões), `cdt:ultima` |
| Quiz | `src/scripts/quiz.ts` | Transforma as 5 questões em formulário, corrige e mostra o `porque`. **Não guarda acertos nem erros** |
| Tópicos-Chave | `src/scripts/topicos.ts` + `<div className="topico">` | Cada parágrafo já vira um cartão visual na aula |
| Recursos | `src/components/Recursos.astro` | Vídeo, curso, material extra com `motivo`. **Nenhuma aula usa `videoAula` hoje** |
| Home | `src/pages/index.astro` | "Continuar de onde parou", painel de progresso (`painel-progresso.ts`), trilhas |
| Índice | `src/pages/aulas.json.ts`, `src/lib/indice.ts` | Busca e painel de progresso |
| Componentes de interface | `Accordion`, `HelpTip`, `confirmacao.ts`, `avisos.ts` (toast) | Reaproveitar em tudo |
| Verificadores | `scripts/validar-aula.mjs`, `checar-quiz.mjs`, `checar-contraste.mjs`, `checar-acessibilidade.mjs` | Rodam na CI |
| Navegação | `ClientRouter` em `Base.astro` | Scripts reiniciam em `astro:page-load`: risco de registrar duas vezes |

Não existe: autenticação, banco, testes de unidade, registro de respostas.

## 2. Decisões de base (valem para todas as fases)

1. **Um registro só.** Uma lista de eventos em `localStorage` (`cdt:registro`). Todo número da interface é **calculado** dela na hora. Nada de total guardado: apagar um evento corrige tudo sem inconsistência.
2. **Conhecimento = seção da aula.** Questão aponta para seção (já existe). Cartão aponta para aula. Sem `conceitos.json`.
3. **Estados em palavras, nunca porcentagem de domínio.** `Não iniciada`, `Em andamento`, `Concluída`, `Rever`. Sempre com o motivo em texto.
4. **Nada bloqueia.** Pré-requisito vira aviso, nunca cadeado. A trilha continua não linear.
5. **Sem JavaScript, a aula continua inteira.** Tudo o que é novo é camada por cima.
6. **Sem gamificação.** Sem pontos, moedas, ranking, níveis, streak. A única exceção discutida é o calendário de dias (funcionalidade 8), com os riscos ditos lá.
7. **ENEM só com questão oficial do INEP.** Regra que já existe e que limita a funcionalidade 5.
8. **Lógica em funções puras** num arquivo `src/lib/estudo.ts`, sem imports, testável com `node --test` (o Node 24 desta máquina roda `.ts` direto; conferir a versão da CI, que usa Node 22).
9. **Acessibilidade nasce junto** (WCAG 2.2 AA, como o resto do site): HTML semântico, teclado, alvo de 44 px, estado nunca só por cor, `prefers-reduced-motion`, 320 px e zoom de 200%.

## 3. As dez funcionalidades

### 1. Rotina de estudos → bloco `Hoje` na home

- **Problema:** abrir o site e não saber por onde ir. Gastar a energia decidindo em vez de estudando.
- **Proposta:** não criar uma "área de rotina". O card "Continuar de onde parou" da home vira `Hoje`, com **até três ações** calculadas do registro, nesta ordem: (1) cartões no dia de revisão; (2) seção com erro recente ainda não revista; (3) aula em andamento; (4) próxima aula publicada da matéria que o estudante mais usou na semana. Cada ação diz o motivo. Nada é guardado como "plano": a lista é recalculada a cada visita, então **não existe plano atrasado para reorganizar**. Faltar um dia não gera nada.
- **Experiência:** abre a home, vê "Revisar 8 cartões (cerca de 5 min) · 8 tópicos de aulas que você concluiu chegaram ao dia de revisão" e um botão. `Agora não` esconde a ação até amanhã.
- **Integrações:** registro (fase 1), cartões (7), trilha (2), progresso atual.
- **Dados:** nenhum novo além do registro. Só `cdt:hoje-dispensado` (ids dispensados, data do dia).
- **Backend:** não há. No build, o índice `aulas.json` passa a trazer a ordem do mapa (para achar a "próxima aula").
- **Frontend:** `Hoje` substitui `[data-continuar]` em `index.astro`; função `sugestoesDeHoje(registro, progresso, indice, hoje)` em `estudo.ts`.
- **Acessibilidade:** lista `ol` com título; motivo em texto ao lado da ação (não em tooltip); `Agora não` com rótulo que diz o quê.
- **Casos extremos:** estudante novo (sem registro → mostra "Comece por" com a primeira aula de uma área, como hoje); tudo em dia (diz isso, sem inventar tarefa); `localStorage` bloqueado (volta ao card atual); aula "Em breve" nunca sugerida; matéria terminada.
- **Complexidade:** baixa. São regras de prioridade sobre dados que já existem depois da fase 1.
- **Dependências:** registro (fase 1) e cartões (fase 2) para as regras 1 e 2. Sem eles, só as regras 3 e 4.
- **Prioridade:** alto impacto. É o ponto de entrada de tudo.
- **MVP:** as quatro regras, até três ações, motivo em texto, `Agora não`.
- **Evoluções:** meta semanal opcional ("4 dias por semana"), tamanho da fila pelo tempo disponível (ver 3). **Cortado:** calendário semanal, agenda por horário, reorganização automática (não há o que reorganizar).

### 2. Jornada → a trilha da matéria ganha estado

- **Problema:** o estudante não vê o que já firmou, o que está pela metade e o que precisa voltar.
- **Proposta:** evoluir a `TrilhaAulas` que já existe na página da matéria. Sem página nova, sem mapa estilo jogo. Cada aula ganha um estado em texto: `Não iniciada`, `Em andamento`, `Concluída`, `Rever`. `Rever` aparece quando a última resposta de alguma questão da aula foi errada e a seção ainda não foi revista, ou quando há cartões vencidos dela. Ao abrir a aula `Rever`, um aviso no topo lista as seções e leva direto a elas. A próxima aula sugerida ganha `aria-current="step"` e o rótulo "Próxima".
- **Experiência:** entra em Matemática Básica, vê "Frações · Rever: 2. Comparação de frações", clica e cai na seção.
- **Integrações:** registro, quiz (fase 1), cartões, `Hoje`.
- **Dados:** nenhum novo. Unidades (agrupar aulas) ficam para depois: o mapa do ENEM pode ganhar um campo `unidade` opcional quando houver necessidade.
- **Backend:** no build, saber quais seções cada questão aponta (já parseado pelo validador; levar para o índice).
- **Frontend:** `TrilhaAulas.astro` (HTML com estado padrão "Não iniciada"), `progresso.ts` (`refletirProgresso` pinta o estado), aviso no topo da aula.
- **Acessibilidade:** estado em texto e ícone, não só cor do anel; lista `ol` semântica (já é); o anel continua `aria-hidden`.
- **Casos extremos:** aula marcada como vista sem responder questões (fica `Concluída`, sem `Rever`); questão refeita e acertada (sai de `Rever`); aula sem gabarito (sem `Rever`); conteúdo da aula mudou e a questão N agora é outra (aceito: ver riscos).
- **Complexidade:** baixa a média. O cálculo é simples; o cuidado é não duplicar a conta de estado entre trilha, home e `Meu estudo` (uma função só).
- **Dependências:** fase 1.
- **Prioridade:** alto impacto, vem logo depois do registro.
- **MVP:** os quatro estados e o aviso de seções a rever.
- **Evoluções:** unidades no mapa; aviso de pré-requisito ("esta aula pressupõe Frações"); trilha entre matérias para o ENEM.

### 3. Questionário inicial → nenhum no começo; ajustes opcionais depois

- **Problema:** sugestões genéricas para quem tem objetivos diferentes (ENEM em um ano, prova da escola semana que vem).
- **Proposta:** **não fazer onboarding.** Quase tudo da lista se aprende pelo uso: matérias de interesse (o que abre), conhecimento (o que acerta), frequência (dias com registro), dificuldades (onde erra). O que não dá para aprender: o tempo disponível e uma prioridade explícita. Esses dois viram um bloco `Ajustar sugestões` recolhido dentro do `Hoje`, que o estudante abre quando quiser: matérias em foco (até 3) e tamanho da fila de revisão (curta, média, longa). Se a resposta não muda nada visível, a pergunta não existe.
- **Experiência:** nada aparece na primeira visita. O estudante usa; se quiser, abre `Ajustar sugestões`.
- **Integrações:** só o `Hoje` e a fila de cartões.
- **Dados:** `cdt:ajustes = { foco: string[], fila: 'curta'|'media'|'longa' }`.
- **Backend:** não há.
- **Frontend:** formulário pequeno com `fieldset`/`legend`, dentro de um `details`.
- **Acessibilidade:** controles nativos (checkbox, radio), salvar sem botão escondido, aviso de "salvo" num `aria-live`.
- **Casos extremos:** foco numa matéria sem aula publicada; foco em matéria já terminada; nenhum foco (usa o comportamento).
- **Complexidade:** baixa.
- **Dependências:** `Hoje` (fase 3).
- **Prioridade:** evolução. Só depois de usar o `Hoje` e sentir falta.
- **MVP:** os dois campos.
- **Evoluções:** data da prova (ENEM tem data fixa) para priorizar revisão perto dela. **Cortado:** objetivo em texto livre, "estilo de aprendizagem" (não tem base e não muda nada), nível autodeclarado.

### 4. Diagnóstico → estados por seção, calculados das questões das aulas

- **Problema:** terminar uma matéria sem saber o que ficou firme e o que ficou frágil.
- **Proposta:** em vez de uma prova nova, usar as 5 questões oficiais de cada aula, que o estudante já responde. Cada resposta cai numa seção (`Revisar: Aula Teórica › N`). A seção fica: `Sem dados`, `Rever` (última resposta errada), `Acertou uma vez`, `Firme` (acertou em dois dias diferentes, sem erro depois). Isso aparece por aula (aviso de `Rever`) e por matéria (`Meu estudo`). Não há nota.
- **O limite honesto:** todas as questões existentes estão dentro das aulas, então o estudante já as viu. Refazer a mesma questão mede lembrança da resposta, não compreensão. Um diagnóstico de verdade no fim da unidade precisa de **questões que ele não viu**. O banco do INEP local (`.cache/inep`) tem muito mais questões oficiais, mas cada uma precisa de gabarito, `porque` e seção: é trabalho editorial. Fica para a evolução, e só se os estados acima se mostrarem úteis.
- **Experiência:** no fim da aula, depois de corrigir: "Você errou a 2 e a 4. As duas são de 3. Porcentagem sobre porcentagem. Rever agora". Na matéria: lista de seções `Rever`.
- **Integrações:** quiz, registro, trilha, `Hoje`, `Meu estudo`, cartões (ver 7: errar uma seção antecipa o cartão da aula).
- **Dados:** evento `questao` com aula, número e acerto. A seção é derivada do gabarito no build, não gravada.
- **Backend:** no build, gerar `questoes.json` (ou ampliar `aulas.json`) com `aula → [secao da questão 1..5]` e a âncora (`id`) de cada seção.
- **Frontend:** resumo pós-correção no `quiz.ts`; aviso na aula; lista em `Meu estudo`.
- **Acessibilidade:** resumo em `role="status"`; links com o nome da seção.
- **Casos extremos:** questão respondida por chute (por isso `Firme` exige dois dias); várias tentativas no mesmo dia (conta a primeira do dia); `porque` sem "Revisar" (22 casos: questão fica sem seção, cai na aula); aula sem gabarito.
- **Complexidade:** média. O cálculo é pequeno; o risco é a interpretação (ver riscos pedagógicos).
- **Dependências:** fase 1.
- **Prioridade:** os estados entram com a trilha (fase 3). A prova de unidade é evolução.
- **MVP:** estados por seção derivados das questões das aulas, mostrados na aula e na trilha.
- **Evoluções:** "Revisão da unidade" com questões oficiais extras do banco do INEP, ainda não vistas; questões de Escolar/DS em formatos próprios (ver 5).

### 5. Tipos de questão → melhorar o feedback do erro; formatos novos só fora do ENEM

- **Problema:** errar e ler uma explicação não diz onde reaprender.
- **Proposta, em duas partes:**
  1. **Feedback do erro (fazer já).** O `porque` já termina com "Revisar: Aula Teórica › N. Nome". O quiz passa a transformar esse final num link para a seção da própria aula. É o maior ganho do plano por linha de código.
  2. **Formatos novos (não fazer agora).** No ENEM, a regra da questão oficial manda: a prova é só múltipla escolha, então inventar verdadeiro/falso seria praticar um formato que não cai. Recordação livre já entra pelos cartões (7), e escrita já existe na Redação (`Textarea`). Verdadeiro/falso, associação ou ordenação só fazem sentido em Escolar ou DS, e só quando o material da escola tiver esse formato. Avaliar quando houver mais aulas dessas abas.
- **Experiência:** errou, lê o porquê e o link "Rever 3. Porcentagem sobre porcentagem ↓", que rola até a seção e põe o foco no título.
- **Integrações:** quiz, `topicos.ts` (abrir a seção se estiver recolhida), registro.
- **Dados:** nenhum.
- **Backend:** nenhum: os títulos das seções já têm `id` no HTML; o quiz acha o `h3` pelo texto.
- **Frontend:** `quiz.ts` (montar o link), talvez `topicos.ts` (abrir o `details`).
- **Acessibilidade:** link real (`<a href="#id">`), foco movido para o título, funciona com teclado.
- **Casos extremos:** seção recolhida (abrir antes de rolar); nome no `porque` diferente do título (o validador já impede); questão sem "Revisar".
- **Complexidade:** baixa.
- **Dependências:** nenhuma.
- **Prioridade:** fundação. Primeira coisa a fazer.
- **MVP:** o link no feedback.
- **Evoluções:** formatos novos em Escolar/DS, com o mesmo padrão de marcação lido pelo quiz.

### 6. Recomendações → dentro do erro e do `Rever`, nunca uma seção genérica

- **Problema:** conteúdo extra sem contexto vira lista que ninguém abre.
- **Proposta:** a recomendação aparece **só no momento em que tem motivo**, com o motivo escrito: (a) depois de errar, a seção da própria aula (5); (b) com a aula em `Rever`, o recurso da aula marcado como `correcao` ("Ainda com dúvida em Frações? Este vídeo refaz a comparação passo a passo"); (c) com a aula `Firme`, o recurso `aprofundar`. Reaproveitar `resources` e o `Recursos.astro`; o campo `motivo` do vídeo já existe. Uma recomendação por vez.
- **O limite honesto:** hoje nenhuma aula tem `videoAula`. Sem curadoria de conteúdo externo, só a parte (a) funciona. A parte externa depende de alguém escolher e checar vídeos, aula por aula.
- **Experiência:** vê no máximo uma sugestão, com o porquê e `Dispensar`.
- **Integrações:** quiz, trilha (estado), `Recursos.astro`.
- **Dados:** um campo opcional `para: 'correcao' | 'aprofundar'` nos itens de `resources`; `cdt:dispensados`.
- **Backend:** schema em `content.config.ts`.
- **Frontend:** `Recursos.astro` e um ponto de exibição no aviso de `Rever`.
- **Acessibilidade:** link externo avisado ("abre o YouTube"); motivo em texto.
- **Casos extremos:** link quebrado (checar no build, como figuras); vídeo removido; recurso pago.
- **Complexidade:** baixa no código, alta na curadoria.
- **Dependências:** fases 1 e 3.
- **Prioridade:** a parte (a) entra na fase 1. A externa é evolução, puxada pela curadoria, não pelo código.
- **MVP:** só a recomendação interna (link da seção).
- **Evoluções:** recursos externos por aula, começando pelas aulas com mais erros no uso do Max.

### 7. Flashcards → os `Tópicos-Chave` viram cartões com revisão espaçada

- **Problema:** ler e concluir uma aula não garante lembrar dela um mês depois. Recuperar a informação em intervalos crescentes é o que fixa.
- **Proposta:** cada tópico (`#### N. Título` + parágrafo) já é um cartão: frente = título, verso = parágrafo e figura. Entra na fila **quando a aula é concluída**. Revisão em `/revisao`: mostra a frente, o estudante tenta lembrar (pode escrever num campo opcional, que não é corrigido), vira e marca `Lembrei`, `Com dificuldade` ou `Não lembrei`. Caixas de Leitner com intervalos visíveis:

  | Resposta | Efeito | Próxima vez |
  |---|---|---|
  | Não lembrei | volta à caixa 1 | amanhã |
  | Com dificuldade | fica na caixa | mesmo intervalo |
  | Lembrei | sobe uma caixa | 3, 7, 14, 30, 60 dias |

  Errar uma questão de uma aula põe os cartões dela na fila do dia seguinte. Fila diária limitada (20 por padrão); o excesso espera sem aviso de atraso.
- **Quais conhecimentos:** o formato serve para definições, fórmulas, relações e critérios, que é o que os Tópicos-Chave já contêm por regra (seção 6 do formato das aulas: negrito nas palavras-chave, todas as fórmulas). Não serve para interpretação de texto longo e redação: tópicos de Redação e Língua Portuguesa podem ficar fora por marcação (`<div className="topico" data-cartoes="nao">`), decidido na spec depois de olhar os tópicos.
- **Experiência:** do `Hoje`: "Revisar 8 cartões". Uma tela por cartão, três botões grandes, contador "3 de 8", sair a qualquer hora sem perder o que já marcou.
- **Integrações:** registro, `Hoje`, trilha (`Rever`), quiz (erro antecipa).
- **Dados:** evento `cartao` com id do cartão e resposta. A caixa e a data são **calculadas** dos eventos (assim apagar um evento corrige a fila). Id do cartão = `aula#slug-do-título`.
- **Backend:** no build, `cartoes.json` com os tópicos de cada aula (lidos do corpo do MDX, dentro de `<div className="topico">`), com o parágrafo já em HTML.
- **Frontend:** página `src/pages/revisao.astro` + `src/scripts/revisao.ts`; função `fila(registro, concluidas, hoje)` em `estudo.ts`.
- **Acessibilidade:** sem depender da animação de virar (o verso aparece abaixo; com `prefers-reduced-motion` sem animação); botões com texto, não só ícone ou cor; atalhos de teclado opcionais (1, 2, 3) anunciados; foco vai para o verso ao revelar; funciona a 320 px.
- **Casos extremos:** título do tópico mudou (cartão novo, o antigo some sem erro); aula desmarcada como vista (cartões saem da fila); fila vazia (diz quando é a próxima); voltar à aba no meio (sem duplicar); duas revisões do mesmo cartão no mesmo dia (vale a última); fórmula com KaTeX (22 aulas usam: levar o HTML já renderizado).
- **Complexidade:** média: gerar `cartoes.json` com o HTML certo e a página nova.
- **Dependências:** registro (fase 1).
- **Prioridade:** alto impacto. É a funcionalidade que mais melhora retenção.
- **MVP:** cartões de aulas concluídas, três respostas, caixas fixas, fila limitada.
- **Evoluções:** cartão de lacuna a partir dos negritos; revisar só uma matéria; ajustar intervalos pelo histórico real (só com meses de dados).

### 8. Dashboard → página `Meu estudo`, curta

- **Problema:** não perceber a própria evolução desanima; e números soltos não dizem o que fazer.
- **Proposta:** uma página, quatro blocos, cada um terminando numa ação:
  1. **Dias de estudo** (estilo contribuições do GitHub): um quadrado por dia com ação significativa (aula concluída, questões corrigidas, cartões revisados, estudo fora do site). Cor por quantidade de ações, não por minutos. Últimas 12 semanas no celular, 52 no computador. **Sem contador de sequência.**
  2. **Por matéria:** aulas concluídas de aulas publicadas ("Em breve" não conta), seções `Firme` e `Rever`. Link "Rever agora".
  3. **Revisão:** cartões revistos na semana, na fila hoje, quando é a próxima.
  4. **Histórico** (ver 9).
  O painel de progresso da home continua como está, com um link para `Meu estudo`.
- **Sobre o calendário de dias:** incentiva constância (estudar pouco e sempre fixa mais que estudar muito de uma vez). Risco: virar meta em si (abrir o site só para pintar o dia). Por isso conta só ação significativa, não mostra sequência e não tem mensagem de "não quebre".
- **Experiência:** abre pelo menu ou pela home; tudo cabe numa coluna no celular.
- **Integrações:** registro, progresso, cartões, estados de seção.
- **Dados:** nenhum novo.
- **Backend:** não há.
- **Frontend:** `src/pages/meu-estudo.astro` + script; componente do calendário em SVG ou grade CSS.
- **Acessibilidade:** o calendário é `aria-hidden` com uma tabela ou lista equivalente ("Semana de 5/10: 3 dias") visível para leitor de tela e em telas pequenas; cor sempre com número; sem `progressbar` decorativo.
- **Casos extremos:** sem registro (explica o que vai aparecer); dados só de um aparelho (dizer na página que os dados são deste navegador); fuso e virada do dia (usar a data local).
- **Complexidade:** média.
- **Dependências:** fases 1 a 3.
- **Prioridade:** evolução. Útil depois de semanas de registro; antes disso a página fica vazia.
- **MVP:** blocos 1, 2 e 4.
- **Evoluções:** comparação com a meta semanal (se 3 ganhar meta); filtro por matéria. **Cortado:** tempo total como destaque, ranking, comparação com colegas.

### 9. Histórico e sessões → lista de registros editável, sem cronômetro

- **Problema:** dado errado (clique acidental, estudo fora do site) distorce o que o site sugere.
- **Proposta:** **não criar "sessão" como entidade.** O histórico é a própria lista de eventos, agrupada por dia, em `Meu estudo`. O estudante pode: **apagar** um registro (com confirmação, que já existe em `confirmacao.ts`) e **registrar estudo fora do site** (matéria, o que fez, duração opcional). Como tudo é recalculado do registro, apagar não deixa total errado. Editar = apagar e registrar de novo; não vale a complexidade de um editor.
- **Sobre tempo:** o site não mede tempo de estudo (aba aberta não é estudo). O único tempo exibido é o que o estudante declara no estudo fora do site, sempre rotulado "informado por você", nunca somado como sinal de aprendizado.
- **Casos pedidos:** sessão interrompida = não existe, cada ação vale sozinha (cartão marcado conta, aula pela metade fica `Em andamento`); dia sem registro = "sem registro", nunca "zero" nem falha; estudo fora = evento `externo`, entra no calendário mas não muda estado de seção; dado incompleto = campos opcionais, só a matéria é obrigatória.
- **Integrações:** `Meu estudo`, todas as contas.
- **Dados:** evento `externo { materia, texto, minutos? }`; apagar = remover o evento da lista (o estudante pediu, não há auditoria a manter).
- **Backend:** não há.
- **Frontend:** lista por dia, botão `Apagar` por linha, formulário curto.
- **Acessibilidade:** botões `Apagar` com o nome do registro no rótulo; confirmação no diálogo existente; foco volta à lista.
- **Casos extremos:** apagar uma resposta errada tira a seção de `Rever` (é o esperado); apagar evento de cartão recalcula a caixa; muitos eventos (paginar por mês).
- **Complexidade:** baixa, porque não há sessão nem total guardado.
- **Dependências:** fase 1.
- **Prioridade:** junto com 8.
- **MVP:** listar por dia, apagar, registrar estudo fora.
- **Evoluções:** **exportar e importar** os dados num arquivo (é a única forma de levar o histórico do celular para o computador sem conta, e protege contra limpar o navegador).

### 10. Transparência → regra, não tela

- **Problema:** "Domínio: 74%" não diz nada nem orienta.
- **Proposta:** toda métrica e todo estado é definido num lugar só (`estudo.ts`), ao lado da função que o calcula, com quatro textos: o que entra, como é calculado, o que não mede, como melhorar. A interface mostra isso num `details` "Como calculamos" ao lado do número. Nenhuma métrica entra no site sem os quatro textos.
- **Exemplo:** *Firme* · Entra: suas respostas às questões desta seção. Cálculo: acertou em dois dias diferentes e não errou depois. Não mede: se você sabe resolver uma questão nova. Como melhorar: revise os cartões e refaça as questões daqui a alguns dias.
- **Integrações:** todas.
- **Dados:** textos no código.
- **Frontend:** um componente `ComoCalculamos.astro` (ou o `HelpTip` existente, se couber o texto).
- **Acessibilidade:** `details` nativo; texto curto, sem jargão.
- **Casos extremos:** pouca evidência = dizer "poucos dados", não mostrar estado.
- **Complexidade:** baixa.
- **Dependências:** nenhuma; acompanha cada fase.
- **Prioridade:** fundação, aplicada em todas as fases.
- **MVP:** os textos dos estados `Rever` e `Firme` e do calendário.
- **Evoluções:** nenhuma prevista.

## 4. Visão geral

### Arquitetura

```
Build (Astro)                              Navegador (localStorage)
─────────────                              ─────────────────────────
MDX + gabarito ──► aulas.json (ordem do mapa, seção de cada questão, âncoras)
Tópicos-Chave ───► cartoes.json            cdt:registro  ◄── quiz, revisão, estudo fora
Mapas ───────────► trilha                  cdt:progresso, cdt:andamento (como hoje)
                                           cdt:ajustes, cdt:dispensados
                                                   │
                                     src/lib/estudo.ts (funções puras, testadas)
                                     estadoDaSecao · estadoDaAula · fila · sugestoesDeHoje · diasDeEstudo
                                                   │
                       ┌─────────────┬─────────────┼─────────────┬──────────────┐
                     Quiz          Trilha         Hoje        /revisao       /meu-estudo
                 (link da seção) (estados)    (até 3 ações)  (cartões)  (dias, matérias, histórico)
```

### Ciclo que o estudante percorre

`Hoje` diz o que fazer → **estuda** a aula → **pratica** nas questões → o erro aponta a **seção** → a aula fica `Rever` → **revisa** a seção e os cartões → o estado vira `Firme` → `Meu estudo` mostra a **evolução** → `Hoje` sugere a **próxima aula**.

### Combinações propostas

- **1 + 3:** questionário vira `Ajustar sugestões` dentro do `Hoje`.
- **2 + 4:** diagnóstico é o estado das seções, mostrado na trilha e na aula.
- **5 + 6:** a recomendação mais útil é o link da seção no feedback do erro.
- **8 + 9:** histórico é um bloco de `Meu estudo`.
- **10:** vira regra de todas as outras.

Resultado: de dez funcionalidades, ficam **duas páginas novas** (`/revisao`, `/meu-estudo`), **um bloco** na home e mudanças em três peças existentes (quiz, trilha, recursos).

### Simplificações

- Sem entidade "sessão" e sem cronômetro.
- Sem plano guardado: rotina recalculada, nada para reorganizar.
- Sem mapa de conceitos: a seção da aula já é o conceito.
- Sem cartões escritos à mão: os Tópicos-Chave já são escritos para isso.
- Sem onboarding.

### O que talvez não valha (ou não agora)

- Formatos novos de questão no ENEM (conflita com a regra da questão oficial).
- Prova diagnóstica separada (sem questões novas, mede memória da resposta).
- Recomendação de conteúdo externo (o código é pequeno, a curadoria não).
- Planejamento semanal em calendário, metas por hora.
- Sincronização, conta, login (exigiria servidor e mudaria a política de privacidade, que hoje diz que nada sai do navegador).
- Qualquer gamificação além do calendário de dias.

### Dados compartilhados

```ts
// cdt:registro — versão no topo para migrar depois
type Registro = { v: 1; eventos: Evento[] };
type Evento =
  | { t: number; tipo: 'questao'; aula: string; n: number; ok: boolean }
  | { t: number; tipo: 'cartao'; cartao: string; r: 0 | 1 | 2 }   // não lembrei, dificuldade, lembrei
  | { t: number; tipo: 'externo'; materia: string; texto?: string; min?: number };
// "aula concluída" continua em cdt:progresso, que já guarda a data: não duplicar.
// O id do evento é o próprio t (ms) + tipo; apagar = filtrar.
```

Tamanho: cerca de 80 bytes por evento. Mil eventos por mês dão menos de 1 MB por ano, abaixo do limite de cerca de 5 MB. Se passar, compactar respostas antigas (guardar só a última por questão).

### Dependências entre fases

Fase 1 (registro + link do erro) → Fase 2 (cartões) → Fase 3 (trilha + `Hoje`) → Fase 4 (`Meu estudo`) → Fase 5 (evoluções, por demanda).

### Riscos técnicos

- **Dados só neste navegador.** Celular e computador têm históricos separados; limpar o site apaga tudo. Mitigação: dizer isso na página e oferecer exportar/importar (fase 4).
- **Registro em dobro com o `ClientRouter`.** Os scripts reiniciam em `astro:page-load`. Mitigação: o quiz grava no clique de corrigir, não na montagem; teste com navegação ida e volta.
- **Aula reescrita muda a questão N.** O histórico aponta a questão errada. Aceito: as aulas do ENEM estão sendo refeitas, então ao refazer uma aula seus eventos de questão devem ser ignorados se a aula mudou (guardar no índice um hash curto das questões e descartar eventos com hash diferente). Decidir na spec da fase 1.
- **`cartoes.json` com HTML de figura e KaTeX.** Ler o corpo cru do MDX pode perder figuras e fórmulas. Alternativa: na página de revisão, buscar o HTML da aula e extrair os tópicos. Decidir na spec da fase 2 com um teste nas 22 aulas com fórmula.
- **Peso do JavaScript.** Carregar `estudo.ts` só nas páginas que usam.

### Riscos de UX

- Home cheia: `Hoje` substitui o card de continuar, não soma.
- Fila de revisão virar culpa: limite diário, sem "atrasado", sem vermelho.
- Estados demais: só quatro na trilha; `Firme` só aparece em `Meu estudo`.
- Página vazia no começo: `Meu estudo` só entra depois de haver dados para mostrar.

### Riscos pedagógicos

- **Refazer a mesma questão infla o acerto.** Por isso `Firme` exige dias diferentes e o texto "Não mede" é explícito.
- **Autoavaliação nos cartões depende de honestidade.** Mitigação: campo opcional para escrever antes de virar.
- **Título do tópico como pergunta pode ser vago** ("3. Porcentagem"): é recordação livre, que funciona, mas alguns tópicos podem render pouco. Avaliar no uso; a evolução de cartão de lacuna resolve.
- **Concluir aula ≠ aprender.** A trilha não chama `Concluída` de domínio.
- **Tempo ≠ aprendizado.** O site não mede tempo.

## 5. Classificação

| Grupo | O que entra | Por quê |
|---|---|---|
| Fundação | Registro de estudo; link da seção no erro (5); regra de transparência (10) | Tudo depende da memória das respostas; o link é o maior ganho pelo menor custo |
| Alto impacto | Cartões com revisão espaçada (7); estados na trilha + diagnóstico por seção (2, 4); `Hoje` (1) | Retenção, saber onde está, saber o que fazer agora |
| Evolução | `Meu estudo` + histórico (8, 9); ajustes (3); exportar/importar; recursos externos (6) | Úteis depois de semanas de dados ou com curadoria |
| Opcional | Prova de unidade com questões do banco do INEP; formatos novos em Escolar/DS; unidades no mapa; meta semanal | Custo editorial alto ou valor ainda incerto |
| Fora | Formatos não oficiais no ENEM, sessão cronometrada, calendário de planejamento, conta e sincronização, pontos, ranking, streak | Não melhoram o aprendizado o bastante para o que custam |

## 6. Roadmap

Cada fase: spec (`/speckit-specify`) → plano → tarefas → implementar → verificadores + navegador a 320 px e só teclado → **o Max usa por alguns dias** → só então a próxima.

**Fase 1 — Errou, reveja** (fundação, pequena)
- Link "Rever N. Seção" no feedback do quiz, rolando e focando a seção (abre se recolhida).
- `cdt:registro` e `src/lib/estudo.ts` com testes; o quiz grava cada correção.
- Resumo pós-correção: "As erradas são de: 3. Porcentagem sobre porcentagem".
- A página `/privacidade` lista os dados guardados no navegador: acrescentar cada chave nova (`cdt:registro` aqui, as outras nas fases seguintes), e o "Zerar progresso" passa a apagá-las também.
- Aceite: uma correção = um evento por questão, mesmo navegando ida e volta; link cai na seção certa em todas as aulas com "Revisar"; `localStorage` bloqueado não quebra o quiz.

**Fase 2 — Revisão espaçada**
- `cartoes.json` dos Tópicos-Chave; página `/revisao`; fila por caixas; erro antecipa cartões.
- Aceite: a tabela de caixas é coberta por teste; recarregar não duplica; revisão inteira só com teclado e com leitor de tela; 320 px.

**Fase 3 — Saber onde está e o que fazer**
- Estados na trilha (`Rever` com as seções); aviso no topo da aula; `Hoje` na home no lugar do "Continuar".
- Aceite: uma função só calcula o estado (trilha, aula e home iguais); `Hoje` nunca sugere "Em breve"; estudante novo chega a uma aula em um clique.

**Fase 4 — Perceber a evolução**
- `/meu-estudo`: dias de estudo com equivalente em texto, por matéria, histórico com apagar, estudo fora do site, exportar e importar.
- Textos "Como calculamos" em todo número.
- Aceite: apagar um evento muda tudo o que depende dele; calendário e lista mostram os mesmos dados; nenhum número usa minutos como sinal de aprendizado.

**Fase 5 — Evoluções, só com motivo do uso**
- `Ajustar sugestões` (foco e tamanho da fila); recursos externos com motivo; unidades no mapa; prova de unidade com questões oficiais extras; formatos novos em Escolar/DS.

## 7. Decisões que dependem do Max

1. **Por que as duas versões anteriores foram desfeitas?** Se foi o volume de código, este plano já responde. Se foi a ideia (o site deve continuar só biblioteca de aulas), talvez só a fase 1 e a 2 valham.
2. **Tópicos-Chave como cartões** (proposto) ou cartões escritos à parte?
3. **ENEM só em múltipla escolha oficial** e formatos novos só em Escolar/DS: de acordo?
4. **Intercalar com a reconstrução do ENEM** (`divisibilidade-e-fatoracao` está pendente no mapa) ou fazer a fase 1 primeiro?
5. **Arquivos soltos** (`.claude/skills/`, `.mcp.json`, `.specify/`): versionar? A constituição em `.specify/memory/constitution.md` ainda é o modelo vazio; as regras da seção 2 podem virar a constituição, se o Max quiser usar o spec-kit nas fases.
