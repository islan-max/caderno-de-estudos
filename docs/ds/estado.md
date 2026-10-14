# Aba DS — estrutura e estado

## Como a aba está organizada

- **Matéria → bimestre → aula.** Não existe seção de semanas: todas as aulas de uma semana do material viram **uma aula só** (uma "mega aula").
- Rotas: `/ds` → `/ds/<materia>` (todos os bimestres numa página só, cada um com a sua trilha, âncora `#<N>-bimestre`) → `/ds/<materia>/<N>-bimestre/aula-<pos>-<titulo>`. A rota `/ds/<materia>/<N>-bimestre` ficou só como aviso que redireciona para a âncora (links antigos).
- Arquivo da aula: `src/content/ds/<materia>/<N>-bimestre/aula-<pos>-<titulo>.mdx`. `<pos>` é a posição da aula **dentro do bimestre** (1 a 7); `order` no frontmatter é o mesmo número.
- **Mapa:** `src/data/ds-mapa.json` lista todas as aulas do curso (191, 7 matérias), com os tópicos de cada uma. Aula sem arquivo `.mdx` aparece como "Em breve", sem link. Para recriar o mapa: `PDFTOTEXT="<caminho do pdftotext.exe>" node scripts/mapear-ds.mjs` (a pasta do material é `C:\Users\MAX\Desktop\Desenvolvimento de sistemas`; o `pdftotext` só restaura os acentos dos títulos).
- Código: `src/lib/dsMapa.ts` (junta mapa + aulas prontas), páginas em `src/pages/ds/`, trilha em `src/components/TrilhaAulas.astro` (`pronta: false`: sem link, selo "Em breve" ou o `aviso` do item). Visual igual ao do ENEM: `TopoSecao`, `AreaMaterias` (um grupo com as matérias), `TopoMateria` e `BimestresMateria`. Cor por matéria: `--color-<slug>` em `global.css`; ícones em `src/lib/materiasSecoes.ts`.
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
| Front-End | 4º | 1 · Avançando na Integração com Serviços Externos | Semana 22 |
| Versionamento de Código | 4º | 1 · Git Workflows Avançados | Semana 21 |
| Front-End | 4º | 2 · Técnicas de Esteiras de Entrega Contínua | Semana 23 |
| Versionamento de Código | 4º | 2 · Pull Request e Code Review Eficaz | Semana 22 |
| Programação Mobile | 4º | 2 · Preparativos Finais para Publicação | Semana 23 |
| Projeto Multidisciplinar | 4º | 2 · Ajustes Finais do Projeto | Semana 23 |
| Banco de Dados | 4º | 2 · Ferramentas e Tecnologias NoSQL | Semana 23 |

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

- 184 aulas ainda "em breve".
- `scripts/checar-quiz.mjs` e `scripts/validar-aula.mjs` são só do ENEM; nas aulas de DS o quiz foi conferido no navegador (3 questões × 5 alternativas, gabarito 3 de 3).
- Aba "Escolar" está visível e usa as mesmas rotas e o mesmo visual da aba DS.

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

- **Mapa:** `src/data/escolar-mapa.json`, gerado por `PDFTOTEXT=<caminho do pdftotext> node scripts/mapear-escolar.mjs` a partir de `C:\Users\MAX\Desktop\Escolar\<Matéria>\Aula N.pdf` (título, bimestre e tópicos vêm da capa; o script confere se os slugs das aulas já escritas batem). Os números sem PDF (Matemática 1, 4, 12, 18 e 20) ficam no mapa com `material: false` e aparecem como "Sem material", sem link; a página "material indisponível" deixou de existir. Mesmas rotas e mesmo visual do DS (`src/lib/escolar.ts`).

- Mesma estrutura de DS, mas sem seção de questões ("aula pura"; as questões ficam na apostila).
- Aulas de revisão dadas pelo professor antes do material do bimestre: arquivo `revisao-<n>-<tema>.mdx`, `order` negativo (-100 + n) e rótulo R<n> na trilha.
- Prontas: Matemática 4º bim (R1 Conjuntos e Venn; Aula 1 sem material; Aula 2 Grandezas, parte 1) e Língua Portuguesa 4º bim (Aulas 1 a 4: Moçambique partes 1 e 2, Angola e Cabo Verde); Matemática também tem as Aulas 3 (Grandezas, parte 2) e 5 (Regra de três simples).
- Textos protegidos (poema, conto, letra de música) não são reproduzidos: ficam resumo, análise e link da fonte.

## Aulas de 08/10/2026

**Front-End (semana 22)**
- O `fetch` só rejeita por erro de rede (404 e 500 não viram erro): a aula ensina a conferir `resposta.ok`. Exemplos REST (ViaCEP) e GraphQL (Rick and Morty) foram executados de verdade.
- O exemplo do "envio de SMS" só é seguro se a chave ficar no servidor; chave de API no navegador é pública.
- Guardar tokens: evitar `localStorage`; BFF com cookie HttpOnly; código com PKCE (o fluxo implícito está desaprovado). Login com Google conferido na documentação do Google Identity (ID de cliente, origens JavaScript, verificação de `aud`, `iss`, `exp` e uso do `sub`).
- No GraphQL, erros vêm em `errors`, e o status pode ser 200 ou 400.

**Versionamento de Código (semana 21)**
- O ciclo do GitFlow foi executado numa pasta de teste (feature, release, hotfix, tags). Nota do autor (2020): para aplicações web com entrega contínua, um fluxo mais simples é preferível.
- Feature flags: dívida de flags e teste dos dois estados (trunkbaseddevelopment.com).

**Língua Portuguesa, Aula 2 (Escolar)**
- Sem as atividades do livro. O conto "Mutola" não é reproduzido (resumo e análise). A parte de concordância usa exemplos próprios.
- Chiziane: primeira mulher moçambicana a publicar um romance (1990) e primeira mulher africana a ganhar o Prêmio Camões (2021).

**Figuras:** todas passaram no verificador `scripts/checar-figuras-no-navegador.js` (nós opacos com a classe `no`, retas terminando na borda do nó).

## Aulas de 13/10/2026

**IA, semana 22 (Projeto Prático: Concepção e Planejamento)**
- Resolve o projeto da EstudaMais: problema, requisitos funcionais e não funcionais, critérios mensuráveis, papéis dos agentes, arquitetura e fluxo de dados. O material só trazia os roteiros; as respostas modelo foram escritas para a aula.
- Complemento: IA generativa pode ser combinada com função comum (o LLM interpreta, o código calcula); RAG para texto e ferramenta para dado exato; LGPD na memória de longo prazo.

**Back-End, semana 23 (Avanços com Frameworks Back-End)**
- Express 5.3.0 testado de verdade (rotas, middlewares, tratador de erros, `node --test`); Django 6.1.2 testado (CheckConstraint, PROTECT, autoescape). O Jenkinsfile Node não foi executado (exige Jenkins) e está marcado como tal.
- Correções ao material: Jenkinsfile é Pipeline as Code (não IaC); Selenium faz teste de ponta a ponta (não de integração); entrega contínua x deploy contínuo; rollback de banco de dados não é automático; cobertura de testes não prova qualidade.

**Escolar, Matemática 4º bim:** Aulas 6 (regra de três composta) e 7 (resolução de problemas). A Aula 7 do livro só traz questões de vestibular (ficam na apostila): a aula ensina o método com exemplos próprios, incluindo divisão proporcional.

**Programação Mobile, semana 23 (Preparativos Finais para Publicação)**
- Quatro aulas em uma: performance, segurança, usabilidade e build/release. O Pause e Responda original misturava os temas (todas rotuladas "Aula 3"); foi mantido, com o rótulo do material.
- Correções ao material: ProGuard virou R8 (lê as mesmas regras; configuração conferida na documentação do Android); bcrypt é hash para senhas (não criptografia) e leva sal; MFA por SMS é o método mais fraco; rate limiting também ajuda contra força bruta, e não só contra DoS; ZAP e Burp são proxies web (para mobile é preciso configurar o proxy no aparelho). Fastlane e OWASP MASVS conferidos na documentação oficial. O Fastfile e o Gradle são ilustrativos e não foram executados.

**Projeto Multidisciplinar, semana 23 (Ajustes Finais do Projeto)**
- Monitoramento de indicadores (KPI, metas SMART), relatório com mapa mental e retrospectiva. As respostas das questões do material (indicador bem definido, análise contínua, conversão abaixo da meta) foram mantidas; as alternativas erradas foram escritas para a aula.

**Banco de Dados, semana 23 (Ferramentas e Tecnologias NoSQL)**
- MongoDB, Cassandra, Redis e Neo4j em uma aula. **Nenhum comando foi executado** (nenhum desses bancos está instalado nesta máquina); tudo foi conferido na documentação oficial.
- Correções ao material: `mongo` é o shell antigo (hoje `mongosh`); Cassandra no Windows nativo não é o caminho oficial (WSL ou Docker) e `SimpleStrategy` só serve para teste (produção usa `NetworkTopologyStrategy`); o port do Redis para Windows citado é antigo (usar Docker/WSL). Porta 7474 e credenciais do Neo4j estão marcadas como conhecimento geral, a confirmar.

**Língua Portuguesa, Aula 5 (Escolar): Saramago**
- Sem as atividades do livro e sem reproduzir trechos de "Ensaio sobre a cegueira" (obra protegida): resumo e análise, com exemplos inventados. Só a epígrafe curta é citada.
- Correção ao material: as falas sem travessão de Saramago são discurso direto integrado ao parágrafo, e não discurso indireto livre; a aula ensina a diferença.

**Figuras:** passaram no verificador `scripts/checar-figuras-no-navegador.js`.

## Situações e roteiros práticos (14/10/2026)

Todas as 12 aulas de DS ganharam a seção "Situações e Roteiros Práticos" (antes dos Tópicos-Chave), com os roteiros e as situações das atividades práticas do material da escola e as respostas ligadas às seções da aula.

- Testado de verdade: o servidor GraphQL de eventos (Front-End S22; Express 5.3.0, express-graphql 0.12.0, graphql 15.10.3) e o GitFlow do Versionamento S21.
- Correções ao roteiro: no GitFlow faltava um commit inicial (a `develop` nunca existia) e o `echo` usa aspas tipográficas; no Front-End S22 o código de login tem vários desencontros (tipo de token, nome do campo, porta, importação, segredo no código); `mongo` virou `mongosh`; Redis no Windows por Docker/WSL.
- Não executados (sem ambiente): comandos de MongoDB, Redis, Cassandra e Neo4j, Fastlane e o trecho React de feedback de login.
- As perguntas escritas nas casas do tabuleiro da "Trilha da retrospectiva" estão em imagem no material e não foram extraídas.

## Aulas de 14/10/2026

**Front-End, semana 23 (Técnicas de Esteiras de Entrega Contínua)**
- Executado: Jest 30.5.2 (testes do `sum.js` e cobertura). YAML do GitHub Actions e do Kubernetes conferido só quanto à sintaxe. Cypress, Docker e Kubernetes não foram executados (não estão instalados aqui).
- Correções ao roteiro: `actions/checkout` e `setup-node` na v7 (o material usa v3), Node `lts/*` (o material usa 16), `npm ci`, `ssh-keyscan` trocado por `known_hosts` em segredo, chave ed25519, `if` de push e `environment` no deploy, `npm ci --omit=dev` e `pm2 restart <app>` no script; `jest --coverage` não se instala (já vem no Jest). Os Pause e Responda do material ficam rotulados "Aula 3" mas tratam de Jest e Cypress.

**Versionamento de Código, semana 22 (Pull Request e Code Review Eficaz)**
- Executado: limiar de cobertura do Jest (`coverageThreshold` 80%): com os testes passando e 66,66% de cobertura, o comando sai com código 1 (é isso que bloqueia o merge). Modelo de PR e regras de proteção de branch conferidos na documentação, sem repositório real.
- O material não traz respostas modelo; elas foram escritas para a aula. Seção "Situações e Roteiros Práticos" já incluída.

**Língua Portuguesa:** Revisão R1 (Inferência Textual), mini aula pedida pelo Max, feita pelo tema, sem material do professor (exemplos inventados). Aula 6 (Saramago, parte 2 e colocação pronominal): sem as atividades do livro e sem reproduzir os trechos; os exemplos de colocação são frases inventadas.

