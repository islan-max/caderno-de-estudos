# Aba DS — estrutura e estado

## Como a aba está organizada

- **Matéria → bimestre → aula.** Não existe seção de semanas: todas as aulas de uma semana do material viram **uma aula só** (uma "mega aula").
- Rotas: `/ds` → `/ds/<materia>` → `/ds/<materia>/<N>-bimestre` → `/ds/<materia>/<N>-bimestre/aula-<pos>-<titulo>`.
- Arquivo da aula: `src/content/ds/<materia>/<N>-bimestre/aula-<pos>-<titulo>.mdx`. `<pos>` é a posição da aula **dentro do bimestre** (1 a 7); `order` no frontmatter é o mesmo número.
- **Mapa:** `src/data/ds-mapa.json` lista todas as aulas do curso (191, 7 matérias), com os tópicos de cada uma. Aula sem arquivo `.mdx` aparece como "Em breve", sem link. Para recriar o mapa: `PDFTOTEXT="<caminho do pdftotext.exe>" node scripts/mapear-ds.mjs` (a pasta do material é `C:\Users\MAX\Desktop\Desenvolvimento de sistemas`; o `pdftotext` só restaura os acentos dos títulos).
- Código: `src/lib/dsMapa.ts` (junta mapa + aulas prontas), páginas em `src/pages/ds/`, trilha em `src/components/TrilhaAulas.astro` (opção `pronta: false`).
- Seção ligada em `src/lib/secoes.ts` (`visivel: true`).

## Formato da mega aula

Mesmo padrão visual do ENEM (frontmatter com `relevance`, `quickSummary` e `gabarito`), com estas seções `##`, nesta ordem:

1. Glossário recolhido (`<Accordion titulo="Palavras e siglas desta aula" …>`), no topo.
2. `Antes de Começar`
3. `A Aula`, com `###` por parte (uma por aula original da semana, na ordem do material) e `####` para os subtítulos numerados (1.1, 1.2…). O gabarito aponta para eles ("Revisar: A Aula › 1.3 …").
4. `Tópicos-Chave para Revisão` (`<div className="topico">`)
5. `Pause e Responda`: só as perguntas do material, no formato do quiz do ENEM (`**Questão N**`, linha de fonte em itálico, alternativas `A)` a `E)` terminadas em `\`, gabarito no frontmatter).

**Ferramentas da aula.** O frontmatter aceita `ferramentas:` (lista de `nome`, `uso`, `custo`, `link`, `opcional`). Vira o bloco recolhido "Ferramentas para esta aula", entre o Raio-X e o glossário. Só entra o que a aula realmente usa (programas, contas, material); o que não é imprescindível leva `opcional: true`. Confira os links antes de publicar.

O quiz exige **5 alternativas**; o Pause e Responda original tem 4, então cada pergunta ganhou uma 5ª alternativa (E) escrita para a aula. As 4 originais e a ordem delas foram mantidas.

O material é ponto de partida, não verdade: erros, premissas fracas e itens desatualizados são corrigidos ou complementados dentro da aula (e avisados no texto).

## Aulas prontas

| Matéria | Bimestre | Aula | Origem |
|---|---|---|---|
| Back-End | 4º | 1 · Utilização de Frameworks e Serviços Externos | Semana 22 |
| Inteligência Artificial | 4º | 1 · Ferramentas e Orquestração Multiagente | Semana 21 |
| Projeto Multidisciplinar | 4º | 1 · Avaliação Final do Público-Alvo | Semana 22 |
| Programação Mobile | 4º | 1 · Configurações Iniciais para Publicação nas Stores | Semana 22 |
| Banco de Dados | 4º | 1 · Introdução aos Bancos de Dados NoSQL | Semana 22 |

## Correções e complementos feitos no material

**Back-End, semana 22**
- O material diz que o Express.js usa middlewares para chamar APIs de câmbio; middleware trata o que **chega** ao servidor. Para **chamar** API de fora usa-se cliente HTTP (Axios, `fetch`).
- OAuth 2.0 é autorização (não autenticação); JWT é assinado, não criptografado; "criptografia" dos tokens é, no caso, o HTTPS.
- Tratamento de respostas ampliado: famílias de status, 429, backoff, timeout e idempotência em operações de dinheiro.
- Resumo final da Aula 3 fala de Kubernetes, mas a aula trata de AWS, Azure e Google Cloud: os dois assuntos foram juntados. Equivalências entre nuvens conferidas na tabela oficial do Google Cloud; exemplo do AWS SDK conferido na documentação oficial (v3).

**IA, semana 21**
- AutoGen está em modo de manutenção; a Microsoft indica o Microsoft Agent Framework como sucessor (conferido no repositório oficial).
- Estrutura de tool use conferida na documentação da Claude API (`input_schema`, `tool_use`, `tool_result`) e da OpenAI (`parameters`, `call_id`).
- A resposta oficial da pergunta 2 do Pause e Responda ("Agente → ferramentas → LLM → resposta final") é a versão simplificada; a aula explica que, na prática, o LLM também decide qual ferramenta usar e o ciclo repete.
- Atividades de SupportFlow e DevPipeline: o material só traz os passos (os roteiros não estavam na pasta), então a resolução foi escrita para a aula.

## Pendências

- 186 aulas ainda "em breve".
- `scripts/checar-quiz.mjs` e `scripts/validar-aula.mjs` são só do ENEM; nas aulas de DS o quiz foi conferido no navegador (3 questões × 5 alternativas, gabarito 3 de 3).
- Aba "Escolar" continua oculta (não foi mexida).

## Correções feitas nas aulas de 06/10/2026

**Programação Mobile (semana 22)**
- Nome do app no Google Play: o material diz 50 caracteres; a ajuda do Google diz 30. Palavras-chave da Apple: limite é em bytes (100), não caracteres.
- Regra nova não citada: contas pessoais do Google Play criadas depois de 13/11/2023 precisam de teste fechado (12 testadores, 14 dias) antes de publicar. Target API: Android 16 (API 36) desde 31/08/2026.
- O exemplo de `jarsigner` usava APK; ele serve para AAB (APK usa `apksigner`). Play App Signing: upload key (sua) e app signing key (do Google).
- Firebase Test Lab está descontinuado (desligamento em 30/09/2027, segundo a documentação do Firebase).
- As respostas oficiais do Pause e Responda (ícone, screenshots, vídeo) foram confirmadas: Google Play usa link do YouTube; App Store, app preview enviado direto (15 a 30 s).

**Banco de Dados (semana 22)**
- NoSQL = "Not Only SQL". Bancos de colunas: o material mistura colunar analítico (BigQuery, Redshift) com colunas largas (Cassandra, HBase).
- `db.collection.insert()` está obsoleto no mongosh (insertOne e insertMany). MongoDB tem transações ACID com vários documentos desde 4.0 (réplicas) e 4.2 (sharding).
- A distribuição melhora latência e disponibilidade; não melhora a consistência nem elimina falhas de hardware.

**Projeto Multidisciplinar (semana 22)**
- O material só descreve atividades; a aula acrescenta método (jornada do cliente, SBI, NPS, matriz impacto × esforço) e o cuidado de que colegas não são sempre o público real.

**Pause e Responda:** os três materiais tinham 4 alternativas; foi acrescentada a 5ª (E). O gabarito não vinha no material e foi marcado pelo conteúdo.

## Aba Escolar (desde 05/10/2026)

- Mesma estrutura de DS, mas sem seção de questões ("aula pura"; as questões ficam na apostila).
- Aulas de revisão dadas pelo professor antes do material do bimestre: arquivo `revisao-<n>-<tema>.mdx`, `order` negativo (-100 + n) e rótulo R<n> na trilha.
- Prontas: Matemática 4º bim (R1 Conjuntos e Venn; Aula 1 sem material; Aula 2 Grandezas, parte 1) e Língua Portuguesa 4º bim (Aula 1, Moçambique, parte 1).
- Textos protegidos (poema, conto, letra de música) não são reproduzidos: ficam resumo, análise e link da fonte.
