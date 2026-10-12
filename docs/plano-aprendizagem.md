# Plano do ciclo de aprendizagem (versão 2, enxuta)

Substitui o `PLAN.md` do Codex. Mantém a direção dele e corta o que não se paga. Escrito em 11/10/2026.

## 1. Ideia central

O estudante faz este ciclo: **estudar → praticar → errar → revisar → ver a evolução → continuar**.

Tudo o que o plano cria serve a uma volta desse ciclo. O que não serve a ela fica de fora.

### Decisões que mudam em relação ao plano do Codex

| Antes | Agora | Por quê |
|---|---|---|
| 6 fases, com sincronização (Supabase) e sessões editáveis | 6 etapas curtas, sem sincronização | O site tem um estudante só. Sincronizar não resolve nada agora. |
| IndexedDB com camada `LearningStore` | Um módulo pequeno sobre `localStorage`, com versão | O volume é pequeno. Menos código, menos erro. |
| Todas as 124 aulas mapeadas | **Piloto só em Matemática Básica**, depois decidir | O mapeamento de conceitos é o maior trabalho. Provar a utilidade antes de pagar o custo inteiro. |
| Entidade `StudySession` gravada | Sessões **calculadas** a partir dos eventos | Editar ou excluir vira uma correção nos eventos. Não há total para ficar inconsistente. |
| Onboarding antes de ter efeito | Onboarding só quando houver algo que ele altere | Perguntar sem usar a resposta é trabalho em vão. |
| Lógica dentro de `app.ts` | Funções puras em `src/lib/aprendizagem/`, com testes | `app.ts` já tem 59 KB e não dá para testar sem navegador. |

### Regras fixas

- Sem moedas, ranking, XP, streak ou "domínio %". Motivo: eles levam a estudar para manter número, não para aprender.
- Questões do ENEM: só oficiais do INEP. Nunca inventar.
- Toda sugestão ou métrica diz **de onde veio** (um motivo em texto).
- Nunca bloquear aula. Pré-requisito vira aviso, não cadeado.
- Sem metadados, a interface mostra só o progresso da aula. Não inventa compreensão.
- A leitura das aulas continua funcionando sem JavaScript.
- Uma funcionalidade por vez: implementar, testar, validar, atualizar o handoff, só então a próxima.

## 2. Etapa 0 — Limpeza (antes de tudo)

Objetivo: voltar a um ponto limpo, guardando só o que presta.

1. O Max autoriza um commit ou branch de segurança do estado atual (o AGENTS.md proíbe `reset`, `checkout` e `stash`).
2. **Manter**: estados textuais na trilha (`Não iniciada`, `Em estudo`, `Concluída`) em `TrilhaAulas.astro`, e o bloco `Hoje` da home, reduzido (ver etapa 5).
3. **Remover**: `src/lib/learning.ts` (IndexedDB), as chamadas `appendEvent`/`importLegacyProgress` em `app.ts` e `quiz.ts`, e o onboarding de 3 etapas.
4. **Decidir com o Max**: `.claude/skills/`, `.mcp.json` e `.specify/` (não rastreados, sem relação com a funcionalidade).
5. Corrigir a duplicação da conta de estado (concluída / em estudo / não iniciada): uma função só, reutilizada pela trilha e pelo `Hoje`.
6. Registrar no handoff que a retomada do ENEM (`divisibilidade-e-fatoracao`) continua pendente.

**Aceite:** build com 204 páginas, `validar-aula`, `checar-quiz`, contraste e acessibilidade passando; trilha e `Hoje` iguais ao que o Max já viu.

## 3. Etapa 1 — Fundação (dados, conceitos, métricas)

Serve às funcionalidades 4, 5, 8, 9 e 10. Sem interface nova.

**Armazenamento.** Um módulo `src/lib/aprendizagem/armazem.ts` sobre `localStorage`, chave `cdt:v2:*`, com campo de versão e migração dos dados antigos (`cdt:progresso`, `cdt:andamento`, `cdt:ultima`), que continuam intactos. Se o armazenamento estiver bloqueado, a interface cai para o progresso de aula.

**Evento** (registro imutável, só se acrescenta):

```ts
type Evento = {
  id: string;               // estável: tipo + alvo + dia, para não duplicar
  tipo: 'questao_respondida' | 'aula_concluida' | 'cartao_revisado'
      | 'diagnostico_respondido' | 'estudo_externo' | 'correcao';
  quando: string;           // ISO em UTC
  aulaId?: string;
  questaoId?: string;       // obrigatório em questao_respondida
  conceitoIds: string[];
  resultado?: 'acertou' | 'errou' | 'lembrei' | 'dificil' | 'nao_lembrei';
  minutos?: number;         // só estudo_externo
  corrige?: string;         // id do evento que esta correção anula/ajusta
};
```

- "Abrir aula" **não** gera evento (era ruído). Só ação com significado.
- Uma resposta oficial gera **exatamente um** evento por tentativa.
- Excluir ou editar um registro = novo evento `correcao`. Os totais são sempre recalculados dos eventos, nunca guardados.

**Conceitos e metadados** (no `src/content.config.ts`, sem mexer no corpo dos MDX):

```ts
// aula
conceitos: string[]           // ex.: 'mat-basica/mmc'
preRequisitos?: string[]      // ids de aula; só orienta
// questão (nas aulas piloto)
id, correta, porque, conceitos: string[],
revisar?: { aulaId, secaoId },
fonte: { exame, ano, numero }
// recurso complementar
{ id, tipo, titulo, href, conceitos, motivo: 'base'|'correcao'|'aprofundar'|'pratica', descricao }
```

- IDs estáveis. Relação inexistente **quebra o build**.
- Aula sem `conceitos` continua funcionando (fallback por aula).

**Registro de métricas** (`metricas.ts`): cada métrica tem nome, fórmula, entradas, limite e texto "Como calculamos". Nenhuma métrica nova entra sem estar aqui.

**Testes** (executor nativo `node --test`, a confirmar em `package.json`): estado de aprendizagem, migração, recálculo após correção.

**Aceite:** progresso antigo importado sem perda; reimportar não duplica; uma resposta = um evento; validador do build pega ID quebrado.

## 4. Etapa 2 — Piloto de Matemática Básica: praticar e revisar o erro

Serve às funcionalidades **5** e **6**. É o coração do plano.

- Mapear conceitos nas aulas e nas questões oficiais **só de Matemática Básica**.
- Feedback ao errar: por que errou, **qual conceito** rever, **link para a seção exata** da aula (`revisar.secaoId`). Os dois campos já existem em `porque` e `correta`; falta o conceito e o destino.
- Migrar para recursos tipados os conteúdos complementares que existem hoje, começando pelos de Matemática Básica. Cada um mostra o motivo ("recomendado porque você errou X"). Sem seção genérica de "conteúdos recomendados".
- Uma recomendação por vez, com botão "dispensar".

**Formatos de questão (funcionalidade 5).** Decisão: o ENEM continua só em múltipla escolha oficial. O quiz de hoje já cobre isso. Os formatos novos (verdadeiro/falso, associação, ordenação, resposta curta) **entram nos flashcards e em DS/Escolar**, onde não há regra de fonte oficial (etapa 3). Cada formato só existe se avaliar um tipo de compreensão que a múltipla escolha não avalia.

**Aceite:** toda questão do piloto tem fonte oficial e conceito válido; o link de revisão cai na seção certa; recomendação sempre mostra o motivo.

**Parada obrigatória:** usar duas semanas e avaliar antes de expandir para outras matérias.

## 5. Etapa 3 — Flashcards e revisão espaçada

Serve à funcionalidade **7**.

- Cartões **escritos à mão**, ligados a uma aula e a um conceito. Nada é gerado automaticamente dos `Tópicos-Chave`. Pergunta curta, resposta sem ambiguidade.
- Formatos: pergunta e resposta (resposta curta autoavaliada), preencher lacuna, e verdadeiro/falso quando a afirmação for inequívoca.
- Três botões com texto: `Lembrei`, `Com dificuldade`, `Não lembrei`. Sem animação obrigatória de virar. Funciona por teclado e toque, alvos de 44 px.
- Agendamento por caixas, visível ao estudante:

| Resposta | Efeito | Próxima revisão |
|---|---|---|
| Não lembrei | volta à caixa 1 | 1 dia |
| Com dificuldade | fica na caixa | mesmo intervalo |
| Lembrei | sobe uma caixa | 3, 7, 14, 30, 60 dias |

- A fila diária é limitada. O excesso fica guardado, sem culpa.
- Aula sem cartão: o fallback é a seção `Tópicos-Chave` da própria aula.

**Aceite:** a tabela acima é cumprida por testes; recarregar a página não duplica revisão; revisão feita só com teclado e leitor de tela.

## 6. Etapa 4 — Jornada e rotina (`Hoje`)

Serve às funcionalidades **1**, **2** e **3**.

**Jornada (funcionalidade 2).** Evolui a `TrilhaAulas` que já existe, na página da matéria. Sem página global nova.
- Agrupar por unidade (campo `unidade` no mapa do ENEM, só nas matérias do piloto no começo).
- Estados: `Não iniciada`, `Em estudo`, `Concluída`, `Precisa revisar` (erro recente ou cartão vencido).
- `ol` semântico, `aria-current` no item atual, estado em texto.
- Pré-requisito não feito: aviso "Esta aula pressupõe X", nunca cadeado.

**Hoje (funcionalidade 1).** No máximo **três** ações, nesta ordem de regras:
1. Revisão vencida com erro recente.
2. Aula começada antes de aula nova.
3. Aula nova de matéria prioritária, respeitando pré-requisito.
4. No máximo uma ação longa por dia.
5. Cada ação traz o motivo em texto. Botões `Começar` e `Trocar`.
6. Item não feito volta à fila. Nada de reorganizar a semana inteira.
Sem calendário semanal completo. A "semana" é só uma lista do que ficou pendente.

**Questionário inicial (funcionalidade 3).** Só entra agora, porque agora tem efeito:
- Três perguntas e `Pular por enquanto`: objetivo, até três matérias prioritárias, quantos períodos por semana.
- O que o estudante não responde, o sistema aprende pelo comportamento (matérias que abre, erros, frequência).
- Objetivo e períodos precisam **alterar algo visível** (por exemplo, o tamanho da fila diária). Se não alterarem, a pergunta sai.
- Nada de perguntar "estilo de aprendizagem".

**Aceite:** usuário novo chega a uma aula útil em menos de um minuto; quem pula o onboarding continua recebendo sugestão; o plano nunca inclui aula "Em breve"; trilha usável a 320 px, zoom de 200% e só com teclado.

## 7. Etapa 5 — Diagnóstico de aprendizagem

Serve à funcionalidade **4**.

- Um checkpoint por unidade, com no mínimo cinco questões **oficiais** já mapeadas. Poucas questões num conceito = "amostra insuficiente", sem conclusão.
- Resultado por conceito, em estados, nunca nota nem porcentagem: `Firme`, `Parcial`, `Lacuna`, `Dados insuficientes`.
- Cada lacuna aponta uma recomendação (etapa 2) e gera cartões na fila (etapa 3).
- Reaproveita o quiz atual; só muda o agrupamento e o resultado.
- Retido = pelo menos duas recuperações corretas em dias diferentes e sem erro posterior. Erro posterior derruba para `Precisa revisar`.
- Botão "Como chegamos nisso" lista as evidências.

**Aceite:** nenhuma nota global; conceito com poucos dados é identificado como tal; diagnóstico incompleto não conclui nada.

## 8. Etapa 6 — Acompanhamento: histórico, sessões e `Meu aprendizado`

Serve às funcionalidades **8**, **9** e **10**.

**Histórico e sessões (funcionalidade 9).**
- Sessão automática = eventos com intervalo de até 30 minutos entre si, **calculada na hora**, sem tabela.
- Estudo fora da plataforma: formulário curto (matéria, minutos, objetivo) que gera evento `estudo_externo`.
- Editar ou excluir = evento `correcao`. Efeito só no tempo, a menos que o estudante confirme também ignorar a evidência.
- Dia sem registro = "sem dado", não "zero". Sessão interrompida não conclui aula nem diagnóstico.
- O tempo aparece como **tempo estimado**, secundário, nunca como prova de aprendizagem.

**Meu aprendizado (funcionalidade 8).** Uma página só, com quatro blocos:
1. Dias com ação significativa (calendário estilo contribuições, com lista equivalente por texto para leitor de tela e celular). Sem streak.
2. Progresso por matéria: aulas concluídas ÷ aulas publicadas ("Em breve" não conta).
3. Conceitos que precisam de atenção.
4. Revisões feitas e vencidas.

**Transparência (funcionalidade 10).** Todo número tem um `details` "Como calculamos", puxando de `metricas.ts`: o que entra na conta, a fórmula, o que ele não mede e como melhorar.

**Aceite:** editar ou excluir recalcula tudo; calendário e lista mostram os mesmos dados; nenhum indicador usa minutos como sinal de compreensão.

## 9. Mapa das 10 funcionalidades

| # | Funcionalidade | Onde entra | O que fica fora por enquanto |
|---|---|---|---|
| 1 | Rotina | Etapa 4 (`Hoje`) | Planejamento semanal completo, reagendamento automático |
| 2 | Jornada | Etapa 4 (trilha) | Caminhos alternativos |
| 3 | Questionário inicial | Etapa 4 | Perguntas além das três |
| 4 | Diagnóstico | Etapa 5 | Escolha adaptativa de questão |
| 5 | Tipos de questão | Etapas 2 e 3 | Formatos novos no ENEM (regra da fonte oficial) |
| 6 | Recomendações | Etapa 2 | Vídeos externos verificados, telemetria de utilidade |
| 7 | Flashcards | Etapa 3 | Expansão para todo o ENEM antes da avaliação |
| 8 | Dashboard | Etapa 6 | Comparação com meta mensal, filtros |
| 9 | Histórico e sessões | Etapa 6 | Dividir e juntar sessões, importar dados |
| 10 | Transparência | Etapa 1 e todas | Histórico de mudanças das fórmulas |

**Cortado do plano (sem perda real para o aprendizado):** sincronização e conta (Supabase), gamificação, calendário de planejamento, "domínio %".

## 10. Riscos

- **Mapeamento de conceitos** é trabalho editorial grande. O piloto mede o custo real antes de multiplicar por 124 aulas.
- **Dados duplicados** pela navegação do Astro (`ClientRouter`): IDs de evento estáveis e inicialização única por página.
- **`localStorage` bloqueado:** a interface cai para o progresso de aula e avisa.
- **Aviso virar culpa:** linguagem neutra; adiar não tem penalidade.
- **Acerto por sorte tratado como domínio:** exigir evidência em dias diferentes.
- **Crescimento do JavaScript:** funções puras em módulos pequenos, carregados só onde são usados.

## 11. Regras para o agente que implementar

1. Ler `AGENTS.md` e a última entrada de `docs/handoff.md`.
2. Fazer **uma etapa por vez**, na ordem acima. Não começar a etapa N+1 sem o aceite da N.
3. Lógica nova vai em `src/lib/aprendizagem/` como função pura com teste. Não acrescentar lógica em `app.ts`.
4. Depois de cada etapa, rodar:
```bash
node scripts/validar-aula.mjs src/content/enem
MSYS2_ENV_CONV_EXCL=BASE_PATH BASE_PATH=/caderno-de-estudos npx astro build
node scripts/checar-quiz.mjs <aulas afetadas>
node scripts/checar-contraste.mjs
node scripts/checar-acessibilidade.mjs --base /caderno-de-estudos
```
5. Abrir o fluxo novo no navegador a 320 px e com teclado. Dizer o que **não** foi verificado.
6. Atualizar `docs/handoff.md` e `docs/sessoes/` ao fim de cada etapa. Sem commit fora do fim de matéria.
7. Cada etapa só termina quando o Max usar e aprovar.

## 12. Decisões pendentes do Max

1. **Formatos de questão:** aceita que ENEM fique só em múltipla escolha oficial e que os formatos novos vivam nos flashcards e em DS/Escolar?
2. **Armazenamento:** `localStorage` com versão (proposto) ou manter IndexedDB (já escrito, mas sem uso)?
3. **Arquivos soltos** (`.claude/skills/`, `.mcp.json`, `.specify/`): manter fora do git?
4. **Retomada do ENEM:** intercalar esse plano com as aulas de `divisibilidade-e-fatoracao`, ou terminar as etapas 0 a 2 primeiro?
