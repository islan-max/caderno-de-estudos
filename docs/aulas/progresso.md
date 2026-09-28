# Progresso da reconstrução das aulas do ENEM

Estado de trabalho. Retomar na primeira linha que não esteja `concluída`. Padrão: `docs/aulas/formato-das-aulas-mdx.md`. Ferramentas: `scripts/` (banco em `.cache/inep/`, fora do git).

Status: `pendente`, `em andamento`, `concluída`, `bloqueada`. Questões: ids do banco (`banco_inep.py mostrar <id>`).

## Decisões registradas

- 25/09/2026 · Plano aprovado. Redação virou matéria (`redacao`), com as 2 aulas que estavam em Língua Portuguesa (caminho mudou: aprovado, opção b). Espanhol entra em `lingua-estrangeira` com slug `espanhol-<tema>`; as aulas atuais da matéria são de inglês.
- 25/09/2026 · Divisão: parte 1 mantém o caminho; partes seguintes `<tema>-parte-N`; `order` renumerado só na matéria dividida.
- 25/09/2026 · Aula nova: `order` = maior da matéria + 1 (spec §1). Na Redação, as novas seguem a ordem do arquivo de categorias (1 a 8).
- 25/09/2026 · Banco: aplicações regulares 2009-2024 via índice de texto (enem.dev 2009-2023, Maritaca 2022-2024) + `localizar`, que baixa o PDF oficial do ano e confere; PPL, digital, reaplicação, 2ª/3ª aplicação, Belém e 2025 extraídos dos PDFs. Resposta oficial sempre do PDF de gabarito do INEP (página ou zip dos microdados); microdados só confirmam e dão b/habilidade quando as respostas coincidem ≥ 90%.
- 25/09/2026 · Lacunas do banco: PPL 2010 sem gabarito legível (só prova com respostas marcadas) → fora; PPL 2021 e 3ª aplicação 2014 com texto embaralhado (busca não acha; imagens servem); PPL 2011-2013, 2016, 2017, Belém 2025 e 2ª aplicação 2016 (D1) sem parâmetro b.
- 25/09/2026 · Bug corrigido: o gabarito de 2009 traz as 4 cores numa tabela e o leitor pegava a coluna do amarelo (os microdados "confirmavam" porque ligavam ao código do amarelo). Agora lê a faixa da cor e, sem cabeçalho de cor, recusa tabela misturada. Conferência extra `banco_inep.py conferir-gabaritos` (INEP × enem.dev/Maritaca, casando pelo texto): 876/878 iguais; as 2 diferenças (2022 Q143 e 2009 Q120) foram conferidas na imagem do gabarito do INEP: o banco está certo, o terceiro errou.
- 25/09/2026 · "Difícil" = parâmetro b no terço superior da mesma área e ano; questão sem b não conta como difícil.
- 25/09/2026 · Nome da aplicação na linha de fonte: conferir a capa do caderno (ex.: o caderno 9 branco de 2016 listado como PPL é a "3ª aplicação").
- 25/09/2026 · Direito autoral: reproduzir só texto do INEP, obra em domínio público (autor morto há mais de 70 anos, Lei 9.610/98, art. 41) e trecho curto de prosa com crédito; o resto remete à página do PDF oficial ou a questão é trocada.
- 26/09/2026 · Padrão v2, depois do piloto (pedido do Max): resumo e relevância juntos no "Raio-X do tema" (retrátil); cor fixa por matéria, com o negrito na cor da matéria; temas cobrados em lista; glossário dentro de `<Accordion>`, só siglas e termos não óbvios; sem tabela de símbolos; "Aula Teórica" e "Questões do ENEM"; sem legenda "Figura N"; sem "Como o ENEM cobra isso"; siglas por extenso também na Aula Teórica; recortes aparados e centrados. Os 3 pilotos foram convertidos e revisados de novo.
- 26/09/2026 · Redação: "## Questões e escrita" com 5 questões autorais sobre a competência da aula + `**Agora escreva.**` + `<Textarea />` (folha pautada; a correção fica para depois, só visual por enquanto).
- 26/09/2026 · Push só no fim de cada matéria (confirmado pelo Max depois do piloto).

## Fase 3: aulas existentes (ordem de trabalho)

| aula | order | status | questões | commit | notas |
|---|---|---|---|---|---|
| matematica-basica/fracoes | 1 | concluída | 2020-digital-D2-azul-Q159, 2019-regular-D2-azul-Q151, 2019-ppl-D2-azul-Q165, 2022-ppl-D2-azul-Q148, 2009-regular-D2-azul-Q144 | 53a79d2 | revisor: PASS na 2ª leitura; sem divisão; 3 bugs de extração corrigidos em banco_inep.py |
| matematica-basica/potencias-e-raizes | 2 | concluída | 2019-regular-D2-azul-Q140, 2025-reaplicacao-D2-azul-Q139, 2019-ppl-D2-azul-Q145, 2009-regular-D2-azul-Q170, 2019-regular-D2-azul-Q141 | 0f4567e | revisor: PASS na 2ª leitura (rodada 1: exemplo ecoava número/posição da Q3, exemplo ecoava cenário da Q4, fonte da Q3 dizia "2ª aplicação" em vez de PPL); só 2 questões "difícil" pelo b — banco não tinha uma 3ª sem invadir razão/proporção ou funções; corrigido bug de extração de expoente em notação científica (10^N virava "10N" grudado) |
| matematica-basica/razao-e-proporcao | 3 | concluída | 2017-regular-D2-azul-Q164, 2024-ppl-D2-azul-Q177, 2021-digital-D2-azul-Q159, 2020-digital-D2-azul-Q161, 2023-ppl-D2-azul-Q171 | e99bc5a | revisor: PASS na 1ª leitura; todas as 5 são "difícil" pelo b — banco sem uma fácil limpa; 2 figuras próprias substituem decoração/fórmula-imagem do PDF |
| matematica-basica/regra-de-tres | 4 | concluída | 2024-ppl-D2-azul-Q147, 2025-reaplicacao-D2-azul-Q163, 2021-digital-D2-azul-Q158, 2021-digital-D2-azul-Q167, 2025-reaplicacao-D2-azul-Q144 | 5d89151 | revisor: PASS na 2ª leitura; 3 difíceis pelo b |
| matematica-basica/porcentagem | 5 | concluída | 2016-segunda-aplicacao-D2-azul-Q143, 2020-digital-D2-azul-Q137, 2019-regular-D2-azul-Q153, 2025-regular-D2-azul-Q162, 2025-reaplicacao-D2-azul-Q179 | 97041ad | revisor: PASS na 2ª leitura; 4 difíceis pelo b |
| matematica-basica/equacoes-de-primeiro-e-segundo-grau | 6 | concluída | 2018-ppl-D2-azul-Q158, 2009-regular-D2-azul-Q155, 2020-digital-D2-azul-Q172, 2020-digital-D2-azul-Q168, 2023-ppl-D2-azul-Q160 | e2f4ece | revisor: PASS na 2ª leitura (rodada 1: erro de sinal numa conta do gabarito, referência de seção errada, notação inconsistente); banco quase não tem questão de "resolver equação" pura, todas as 5 são problemas aplicados (ponto de equilíbrio, trajetória parabólica, produto de binômios, vértice); sem divisão |
| funcoes/funcao-afim | 1 | concluída | 2019-regular-D2-azul-Q168, 2024-ppl-D2-azul-Q170, 2017-ppl-D2-azul-Q141, 2014-ppl-D2-cinza-Q159, 2020-ppl-D2-azul-Q171 | 6f09335 | revisor: PASS na 2ª leitura (rodada 1: rótulo "PPL" em vez de "2ª aplicação" em 2 fontes, IBGE fora do glossário, cartão de fórmula da seção 1 incompleto); 3 difíceis pelo b; 2 gráficos redesenhados em SVG; sem divisão |
| funcoes/funcoes-quadraticas | 2 | concluída | 2019-ppl-D2-azul-Q143, 2025-reaplicacao-D2-azul-Q172, 2022-ppl-D2-azul-Q171, 2025-reaplicacao-D2-azul-Q147, 2022-regular-D2-azul-Q150 | 793e7d8 | revisor: PASS na 2ª leitura (rodada 1: faltava ensinar coeficiente em fração, vértice abaixo do eixo e desconto em %; exemplo com número igual ao da Q2); 3 difíceis pelo b; 2 figuras em SVG e tabela da Q1 em markdown; 2015-ppl-D2-cinza-Q172 (van) descartada: a conta dá E, os microdados dizem C — conferir o PDF de gabarito antes de usar; sem divisão |
| funcoes/funcoes-exponenciais | 3 | concluída | 2020-ppl-D2-azul-Q169, 2009-regular-D2-azul-Q138, 2024-ppl-D2-azul-Q168, 2024-ppl-D2-azul-Q167, 2016-segunda-aplicacao-D2-azul-Q176 | 2c57c08 | revisor: PASS na 3ª leitura (rodada 1: base e e log₂ só no glossário, caso (n − 1) sem exemplo, 2 exemplos espelhando cenário das questões; rodada 2: ^ usado antes de explicado, ano 2030 repetido); 3 difíceis pelo b; gráfico da Q5 em SVG; corrigido no banco: alternativa E de questão em duas colunas engolia a coluna vizinha; sem divisão |
| funcoes/funcoes-logaritmicas | 4 | concluída | 2019-regular-D2-azul-Q154, 2019-regular-D2-azul-Q137, 2018-ppl-D2-azul-Q163, 2019-ppl-D2-azul-Q144, 2019-ppl-D2-azul-Q169 | 00141a2 | revisor: PASS na 3ª leitura (rodada 1: frases de estratégia que descreviam as questões, símbolos sem explicação, percentual → fator faltando; rodada 2: números dos prazos repetiam a Q5); 4 difíceis pelo b; banco tem poucas questões de log (lista no mapa); criado scripts/correcoes_banco.json (Q3 tinha o expoente 9/7 embaralhado); sem divisão |
| geometria/geometria-plana | 1 | concluída | 2017-ppl-D2-azul-Q150, 2019-regular-D2-azul-Q142, 2018-ppl-D2-azul-Q171, 2017-ppl-D2-azul-Q143, 2018-ppl-D2-azul-Q159 | 3ea8d22 | revisor: PASS na 3ª leitura (rodada 1: exemplos repetindo cenário e números das Q2/Q3/Q4, faltava o caminho inverso da Q5 e deduzir medida não escrita da Q1; rodada 2: anel da coroa pintado inteiro, números 3/7/14 repetidos); 3 difíceis pelo b; 3 figuras de questão e 6 de teoria em SVG; sem divisão |
| geometria/semelhanca-de-triangulos | 2 | concluída | 2009-regular-D2-azul-Q154, 2025-regular-D2-azul-Q156, 2022-ppl-D2-azul-Q159, 2014-ppl-D2-cinza-Q154, 2023-ppl-D2-azul-Q179 | 629c3c0 | revisor: PASS na 3ª leitura (rodada 1: exemplo da tenda espelhava o túnel da Q3, pontos médios repetiam a Q4, k = 1,5 e 2,25 eram distratores da Q2, escala sem cartão, figuras fora de proporção; rodada 2: ponto médio e paralela sem definição); 2 difíceis pelo b (banco tem pouca semelhança); 3 questões com campos corrigidos à mão no banco; sem divisão |
| geometria/teorema-de-pitagoras | 3 | concluída | 2017-regular-D2-azul-Q153, 2019-ppl-D2-azul-Q153, 2022-ppl-D2-azul-Q168, 2016-segunda-aplicacao-D2-azul-Q169, 2018-ppl-D2-azul-Q168 | fd3182f | revisor: PASS na 3ª leitura (rodada 1: exemplos espelhavam as questões, faltavam razão das áreas de círculos, círculos empilhados e figuras; rodada 2: 20² = 400 repetia a Q2, figura da escada fora da seção, lacuna R − r da Q4); 2 difíceis pelo b; foto da Q1 com crédito de terceiro não reproduzida (link para o PDF); Q3 e Q4 corrigidas à mão no banco; sem divisão |
| geometria/trigonometria-basica | 4 | concluída | 2017-regular-D2-azul-Q138, 2013-regular-D2-azul-Q136, 2020-ppl-D2-azul-Q154, 2020-regular-D2-azul-Q173, 2018-regular-D2-azul-Q180 | 63bc7c0 | revisor: PASS na 3ª leitura (rodada 1: exemplos espelhavam Q2–Q5, sen 30° entregava a Q1, faltavam prisma oblíquo com avanço = lado, ângulo marcado por fora, sol a pino, × √3/3 e notação h(x); rodada 2: estante tombada não é prisma oblíquo, trocada por bloco de recados); 4 difíceis pelo b; foto da Q2 com crédito (flickr) não reproduzida, esquema SVG + link; Q3 e Q5 com recorte do PDF; Q1, Q3 e Q5 corrigidas à mão no banco; funções seno/cosseno ficam para ciclo-trigonometrico; sem divisão |
| geometria/geometria-solida-volume | 5 | concluída | 2024-ppl-D2-azul-Q171, 2022-ppl-D2-azul-Q150, 2022-regular-D2-azul-Q153, 2023-ppl-D2-azul-Q159, 2009-regular-D2-azul-Q173 | eb0bb1d | piloto; revisor: PASS na 3ª leitura (rodada 1: números que entregavam Q1-Q4, cartões de h = V ÷ Ab, tronco e massa); sem divisão |
| estatistica-e-probabilidade/analise-de-graficos-e-tabelas | 1 | concluída | 2017-ppl-D2-azul-Q178, 2017-regular-D2-azul-Q169, 2014-ppl-D2-cinza-Q161, 2017-regular-D2-azul-Q165, 2019-regular-D2-azul-Q174 | c2a16a1 | revisor: PASS na 2ª leitura, condicionado a 1 ajuste já aplicado (rodada 1: razão, simplificação, respectivamente, legenda e eixo não definidos; conversão GB/MB espelhava a Q1; alturas 30/10 do eixo cortado repetiam a Q4; rodada 2: 12/18 = 2/3 repetia a Q5); 3 difíceis pelo b; todas as figuras em SVG (setores e barras gerados em escala), Q1 em tabela; Q4 corrigida à mão no banco; sem divisão |
| estatistica-e-probabilidade/medidas-de-tendencia-central | 2 | concluída | 2022-ppl-D2-azul-Q167, 2017-regular-D2-azul-Q151, 2014-ppl-D2-cinza-Q164, 2020-regular-D2-azul-Q165, 2019-regular-D2-azul-Q167 | f5f1f45 | revisor: PASS na 2ª leitura (rodada 1: faltavam desigualdade dupla e junção de faixas, média mínima = falta ÷ k e grupo com uma pessoa a mais → mediana no grupo maior; exemplos com 24º/25º, estatura e nota mínima espelhavam Q2–Q4; números 6,0, 7,5, 60 e 48 repetiam dados das questões); 3 difíceis pelo b; quadros das questões como tabelas; sem divisão |
| estatistica-e-probabilidade/desvio-padrao | 3 | concluída | 2014-ppl-D2-cinza-Q136, 2021-digital-D2-azul-Q146, 2019-ppl-D2-azul-Q149, 2012-regular-D2-azul-Q176, 2023-ppl-D2-azul-Q149 | 6256877 | revisor: PASS na 2ª leitura (rodada 1: &lt; no porque aparecia literal no quiz — validador ganhou regra; exemplo de conversão por hectare espelhava a Q4; faltava a desigualdade do CV e a divisão por decimal); 3 difíceis pelo b; quadros como tabelas + diagrama de pontos na teoria; Q1, Q2 e Q5 corrigidas no banco; sem divisão |
| estatistica-e-probabilidade/analise-combinatoria | 4 | concluída | 2013-regular-D2-azul-Q138, 2020-regular-D2-azul-Q163, 2018-regular-D2-azul-Q165, 2019-regular-D2-azul-Q156, 2025-regular-D2-azul-Q175 | 18278f4 | revisor: PASS na 2ª leitura, condicionado a 1 ajuste já aplicado (rodada 1: 15 e 10 dos exemplos repetiam intermediários das Q4 e Q5; exemplo dos irmãos espelhava a Q5 e não tinha a 2ª pessoa escolhendo; faltava produto de fatoriais lado a lado; rodada 2: '!' usado antes de definido); 3 difíceis pelo b; sem figuras nas questões; Q1–Q3 corrigidas no banco; sem divisão |
| estatistica-e-probabilidade/probabilidade-simples | 5 | concluída | 2020-regular-D2-azul-Q142, 2012-regular-D2-azul-Q178, 2017-regular-D2-azul-Q179, 2019-regular-D2-azul-Q173, 2013-regular-D2-azul-Q150 | 1f1adc8 | revisor: PASS na 2ª leitura (rodada 1: exemplo da seção 1 pedia uma probabilidade certa; somas 10/11, árvore 0,3/0,7/0,2/0,8 e 6,25% repetiam distratores e dados das Q2–Q4; faltavam complemento e leitura de P(…)); 3 difíceis pelo b; Q1 tabela; teoria com grade 6 × 6 e árvore; Q1 e Q5 corrigidas no banco; sem divisão |
| matematica-financeira/juros-simples | 1 | concluída | 2018-ppl-D2-azul-Q145, 2020-digital-D2-azul-Q169, 2011-regular-D2-azul-Q157, 2009-regular-D2-azul-Q178, 2020-digital-D2-azul-Q175 | 6f6ff45 | revisor: PASS na 2ª leitura, condicionado a 1 ajuste já aplicado (rodada 1: arredondamento da Q3, centavos e alternativa mais próxima, desconto em parcelas e taxa para o prazo todo não ensinados; exemplos clonavam Q2 e Q4; 12%, 300 e 10% repetiam dados; rodada 2: frase 'sobre o total emprestado' repetia a Q4); só 2 difíceis pelo b (juros simples difícil é raro no banco); Q5 gráfico em SVG; sem divisão |
| matematica-financeira/juros-compostos | 2 | concluída | 2019-regular-D2-azul-Q150, 2013-ppl-D2-cinza-Q171, 2011-regular-D2-azul-Q160, 2019-ppl-D2-azul-Q169, 2020-ppl-D2-azul-Q142 | 7e96e44 | revisor: PASS na 2ª leitura, condicionado a 2 ajustes já aplicados (rodada 1: exemplos com 1 000 a 10% e fatura de cartão espelhavam a Q2; duas parcelas trazidas a hoje espelhavam a Q1; faltavam leitura de datas/regra na data, arredondar n para cima e escolher prazo; rodada 2: erro comum de juros simples com conta errada, fator 1,05 da Q4 no glossário); 3 difíceis pelo b; Q5 corrigida no banco; sem divisão |
| matematica-financeira/inflacao | 3 | concluída | 2011-ppl-D2-cinza-Q170, 2020-digital-D2-azul-Q151, 2011-ppl-D2-cinza-Q155, 2017-ppl-D2-azul-Q164, 2024-ppl-D2-azul-Q168 | 841cb04 | revisor: PASS na 2ª leitura, condicionado a 1 ajuste já aplicado (rodada 1: exemplo de 2 anos de salário espelhava a Q3 e não mostrava a diferença; faltavam voltar do fator para %, posições da mediana, média × mediana, V(n), ·, milhar com uma casa; rodada 2: 18 valores/9º e 10º repetia a Q4); só 2 difíceis pelo b (2 questões PPL 2011 sem b; banco tem poucas de inflação); Q4 gráfico em SVG com rótulos posicionados automaticamente; sem divisão |
| matematica-financeira/sistemas-de-amortizacao | 4 | concluída | 2015-regular-D2-azul-Q156, 2018-regular-D2-azul-Q175, 2017-regular-D2-azul-Q136, 2018-regular-D2-azul-Q137, 2017-regular-D2-azul-Q137 | ab9e8d7 | revisor: PASS na 3ª leitura, condicionado a 2 ajustes já aplicados com os números sugeridos (rodada 1: exemplo de quitação espelhava a Q3; faltavam ≥/≤, álgebra de desigualdade com log e com fator positivo, distributiva, notação V = P·(1+i)ⁿ; rodada 2: 24, 400 e 12ª repetiam números das questões, centavo de arredondamento); 5 difíceis pelo b; 2023-regular-Q161 descartada (anulada pelo INEP) e trocada pela 2018-Q175; Q3 e Q4 corrigidas no banco; sem divisão |
| fisica/cinematica | 1 | concluída | 2017-regular-D2-azul-Q131, 2020-digital-D2-azul-Q105, 2020-regular-D2-azul-Q099, 2023-ppl-D2-azul-Q106, 2011-regular-D1-azul-Q077 | adc596d | revisor: PASS na 2ª leitura, condicionado a 2 ajustes já aplicados (rodada 1: exemplos de arrancada e de motorista distraído espelhavam Q1 e Q3; faltavam unidade com expoente −1, ida e volta com letras, reação acelerando, direção × sentido, energia mecânica, área do gráfico; rodada 2: sinal 'a X m de' e 10 s ainda lembravam a Q3); 4 difíceis pelo b; Q3 em SVG; Q4 corrigida no banco; sem divisão |
| fisica/leis-de-newton | 2 | concluída | 2012-ppl-D1-branco-Q077, 2018-ppl-D2-azul-Q114, 2013-regular-D1-azul-Q087, 2025-regular-D2-azul-Q108, 2018-ppl-D2-azul-Q128 | 7a4150d | revisor: 2ª leitura com 2 ajustes pequenos, aplicados (rodada 1: exemplos espelhavam cenários das questões; faltavam leitura de gráfico, pares ação-reação só como nomes, roda com tração, normal na rampa; rodada 2: valor inicial da resultante na queda e exemplo do caminhão trocado pelo guindaste, que contradizia a tração); 4 difíceis pelo b (Q1 sem b); Q3 e Q4 com alternativas em gráfico redesenhadas em SVG; Q3 corrigida no banco; sem divisão |
| fisica/trabalho-e-energia | 3 | concluída | 2015-regular-D1-azul-Q064, 2018-regular-D2-azul-Q131, 2017-regular-D2-azul-Q108, 2015-ppl-D1-branco-Q085, 2015-regular-D1-azul-Q049 | 449c1aa | revisor: PASS na 2ª leitura, com 3 opcionais aplicados (rodada 1: exemplos repetiam números das questões — 6 500, 108 km/h, 900 W, 4 s, 1 800 s; faltavam potências de 10, largada = repouso, isolar m em Ep, leitura do eixo com alturas negativas, N e g definidos); 4 difíceis pelo b; Q2 e Q3 em SVG; Q3 corrigida no banco; foto de terceiros da Q5 só com remissão ao PDF; sem divisão |
| fisica/impulso-e-quantidade-de-movimento | 4 | concluída | 2017-regular-D2-azul-Q099, 2022-regular-D2-azul-Q105, 2021-ppl-D2-azul-Q120, 2014-regular-D1-azul-Q064, 2024-ppl-D2-azul-Q126 | 12d6bf5 | revisor: 2ª leitura com 1 ajuste pequeno, aplicado (rodada 1: 'parar = perda máxima' contradizia o pêndulo; exemplo da parede espelhava a Q2; faltavam energia mecânica, volta da regra dos 45°, massas em proporção, regra do pêndulo pela ponta oposta, J e m/s²; rodada 2: exemplo de 6 bolas dava o desenho da Q4, trocado por 7 bolas); 3 difíceis pelo b; Q1 recortada do PDF; Q3 e Q4 em SVG; Q1, Q3, Q4 e Q5 corrigidas no banco; sem divisão |
| fisica/hidrostatica | 5 | concluída | 2025-regular-D2-azul-Q118, 2013-regular-D1-azul-Q061, 2011-regular-D1-azul-Q073, 2015-ppl-D1-branco-Q054, 2018-regular-D2-azul-Q134 | d399016 | revisor: PASS na 2ª leitura, com 1 ajuste de uma linha aplicado (rodada 1: faltavam êmbolo, isolar d no empuxo, lado da bomba em Pascal; 'a parte emersa some' impreciso; relevance usava os cenários das questões; rodada 2: 'a seringa puxa o remédio' contradizia a aula); 4 difíceis pelo b; Q3 em SVG; sem correções no banco; sem divisão |
| fisica/termologia | 6 | concluída | 2025-reaplicacao-D2-azul-Q115, 2020-regular-D2-azul-Q109, 2019-regular-D2-azul-Q102, 2018-ppl-D2-azul-Q126, 2025-reaplicacao-D2-azul-Q106 | 4736324 | revisor: 2ª leitura com 1 ajuste pequeno, aplicado (rodada 1: faltavam notação científica, energia dissipada, dados elétricos que sobram, dilatação e vedação, fundir, cadeia k × A da Q3, radiação sem sol, dissipador de calor, unidades da condução; rodada 2: exemplo das janelas refeito para ensinar a isolar a razão com áreas ≠ 1); 5 difíceis pelo b; Q1 com tabela em markdown; sem correções no banco; sem divisão |
| fisica/optica | 7 | concluída | 2014-regular-D1-azul-Q050, 2024-regular-D2-azul-Q100, 2022-ppl-D2-azul-Q107, 2022-ppl-D2-azul-Q115, 2015-ppl-D1-branco-Q058 | abe2415 | revisor: PASS na 2ª leitura, com 4 opcionais aplicados (rodada 1: painéis B, D e E da Q3 não batiam com as inclinações medidas no PDF; exemplos de filtro de câmera e de dois espelhos espelhavam Q1 e Q2; faltavam eixo, ângulo de refração, oblíquo, normal em face vertical, sinais > e <); 5 difíceis pelo b; Q2 a Q5 com figuras em SVG; ilustração 3D da Q2 só por remissão; Q3, Q4 e Q5 corrigidas no banco; sem divisão |
| fisica/eletrostatica | 8 | concluída | 2020-regular-D2-azul-Q091, 2022-ppl-D2-azul-Q135, 2025-regular-D2-azul-Q113, 2020-regular-D2-azul-Q133, 2020-digital-D2-azul-Q117 | 9a01d97 | revisor: PASS na 2ª leitura, com 4 ajustes finos aplicados (rodada 1: número da Q5 nos pré-requisitos; exemplo do campo espelhava a Q3; faltavam repulsão como consequência, antena/fio terra, íons, cartão da energia do capacitor); 3 difíceis pelo b; tirinha de terceiros da Q1 só por remissão com descrição; Q2 e Q3 em SVG; sem correções no banco; sem divisão |
| fisica/eletrodinamica | 9 | concluída | 2018-ppl-D2-azul-Q091, 2021-digital-D2-azul-Q128, 2020-ppl-D2-azul-Q128, 2022-ppl-D2-azul-Q111, 2022-digital-D2-azul-Q116 | 708b130 | revisor: PASS na 2ª leitura (rodada 1: exemplos davam 4 400 W e 4 200 W, números das questões; faltavam chave seletora e potência máxima, 'comprimento total' sem dobrar, divisão de potências de 10, cartão da potência de aquecimento, J e termos dos enunciados); 3 difíceis pelo b; Q3 e Q5 com quadros em tabela; Q2, Q4 e Q5 corrigidas no banco; sem divisão |
| fisica/circuitos-eletricos | 10 | concluída | 2020-ppl-D2-azul-Q095, 2015-ppl-D1-branco-Q049, 2022-ppl-D2-azul-Q118, 2022-ppl-D2-azul-Q105, 2018-ppl-D2-azul-Q135 | 12527e4 | revisor: 2ª leitura com 3 ajustes pequenos, aplicados (rodada 1: 1 + 1/2, 1/10 e 3,6 V dos exemplos coincidiam com as questões; faltavam arranjo inverso de baterias, Lei de Ohm, razão, teste do curto, mAh por extenso; rodada 2: alt da foto, lâmpadas iguais no exemplo, mAh na primeira aparição); 5 difíceis pelo b; Q2 e Q3 em SVG; Q4 recortada do PDF; Q2 e Q3 corrigidas no banco; sem divisão |
| quimica/estrutura-atomica | 1 | concluída | 2019-regular-D2-azul-Q128, 2019-regular-D2-azul-Q105, 2018-regular-D2-azul-Q105, 2018-ppl-D2-azul-Q110, 2017-regular-D2-azul-Q104 | cbae9e6 | revisor: PASS na 2ª leitura, com retoques aplicados (rodada 1: notação com _, leitura de 3d⁶, nível mais externo, família, termos da Q2 e da Q4, quadro de partículas, exemplo alfa espelhava a Q4, unidade /(min g), quantização); 3 difíceis pelo b; sem figuras nas questões; Q4 corrigida no banco; sem divisão |
| quimica/ligacoes-quimicas | 2 | concluída | 2021-ppl-D2-azul-Q128, 2019-regular-D2-azul-Q108, 2023-regular-D2-azul-Q129, 2019-regular-D2-azul-Q112, 2013-regular-D1-azul-Q086 | 85b5558 | revisor: PASS na 2ª leitura, com retoques aplicados (rodada 1: faltavam somar expoentes e número de ligações, pares ligante/não ligante com figura de Lewis, descarte de energia de ionização/polarizabilidade, ramificação/densidade/solubilidade, dipolo induzido; exemplos da vitamina e do carboxilato espelhavam Q3 e Q5); 3 difíceis pelo b; Q3 e Q5 recortadas do PDF; Q4 em tabela; Q1, Q3, Q4 e Q5 corrigidas no banco; sem divisão |
| quimica/funcoes-inorganicas | 3 | concluída | 2025-regular-D2-azul-Q121, 2018-ppl-D2-azul-Q104, 2015-regular-D1-azul-Q052, 2022-ppl-D2-azul-Q106, 2019-ppl-D2-azul-Q116 | cd2e54e | revisor: PASS na 2ª leitura (rodada 1: metal/ametal e → sem definição, coeficiente 2 HCl pulado, faltavam óleo e "mesmo caráter" para os distratores da Q1, exemplo com NH₄Cl espelhava o NH₄Br da Q4; opcionais: par saliva × estômago generalizado, MgO/P₂O₅ tirados da tabela de óxidos); 3 difíceis pelo b; Q2 com escala de cores em SVG; Q2, Q4 e Q5 corrigidas no banco; sem divisão |
| quimica/estequiometria | 4 | concluída | 2012-regular-D1-azul-Q059, 2023-ppl-D2-azul-Q095, 2015-regular-D1-azul-Q076, 2017-regular-D2-azul-Q122, 2025-regular-D2-azul-Q131 | c754a0a | revisor: PASS na 2ª leitura (rodada 1: exemplo de minério de ferro dava 100 kg, dado da Q3, e repetia 70 com três sentidos; ≈ e caieira sem definição; opcionais: exemplo de cápsulas em mg espelhava a Q4, "% em massa", massas molares que sobram); 3 difíceis pelo b; Q4 recortada do PDF; teoria com 2 esquemas em SVG; as 5 corrigidas no banco; sem divisão |
| quimica/solucoes | 5 | concluída | 2014-regular-D1-azul-Q056, 2013-regular-D1-azul-Q071, 2024-regular-D2-azul-Q097, 2022-regular-D2-azul-Q108, 2015-regular-D1-azul-Q055 | e05ddb9 | revisor: PASS na 2ª leitura (rodada 1: M com dois sentidos, frase errada sobre desprezar 1,5 L em 20 L, exemplo de bebida isotônica em porções espelhava a Q3, C = M × massa molar sem cartão, letras no quickSummary; opcionais: Al₂(SO₄)₃ no lugar do nitrato da Q5, OH de álcool não reage, fórmula estrutural); 3 difíceis pelo b; Q4 recortada do PDF; Q1, Q4 e Q5 corrigidas no banco; sem divisão |
| quimica/termoquimica | 6 | concluída | 2015-regular-D1-azul-Q084, 2019-ppl-D2-azul-Q131, 2017-regular-D2-azul-Q124, 2011-regular-D1-azul-Q050, 2009-regular-D1-azul-Q043 | fa00892 | revisor: PASS na 2ª leitura (rodada 1: frase citava metano/glicose/etanol e entregava Q4 e Q5; "por 6" e "2 ligações H−O" davam passos da Q3 e da Q2; faltavam contagem completa de ligações com ÷ coeficiente, Hess com inversão e 3 equações, figura de níveis, (g)/(ℓ)/(s), unidades nos cartões, fórmula inversa nos tópicos, nomes de fórmulas); 3 difíceis pelo b; Q1 recortada do PDF; Q2, Q4, Q5 com quadros em tabela; as 5 corrigidas no banco; sem divisão |
| quimica/quimica-organica | 7 | concluída | 2012-regular-D1-azul-Q049, 2014-regular-D1-azul-Q077, 2015-regular-D1-azul-Q077, 2025-reaplicacao-D2-azul-Q119, 2019-ppl-D2-azul-Q097 | b7b29a3 | revisor: PASS na 2ª leitura (rodada 1: CH(OH) parecia ramificação, frase de física errada, isomerização e estratégia de funções descreviam Q4 e Q1, exemplo repetia o fragmento CH₃−(CH)₂ da Q2, tópicos sem lactona/esquema/D-L); 4 difíceis pelo b; Q1 recortada do PDF; Q3 (Kolbe) e Q4 (retinal) redesenhadas em SVG porque as figuras trazem crédito de periódico; Q1, Q2, Q3 e Q5 corrigidas no banco; sem divisão |
| quimica/polimeros | 8 | concluída | 2015-ppl-D1-branco-Q069, 2019-regular-D2-azul-Q124, 2017-ppl-D2-azul-Q120, 2020-regular-D2-azul-Q100, 2024-ppl-D2-azul-Q097 | de3c0a0 | revisor: PASS na 2ª leitura (rodada 1: exemplo de transesterificação com −COOCH₃ entregava a Q2; exemplo com polietileno era distrator da Q3; faltavam fórmula de esqueleto, amida mais resistente que éster, CO não ácido, anel benzênico, PP/PS/pH no glossário); só 2 difíceis pelo b (banco quase não tem polímeros difíceis; 2013 Q046 e 2025 Q133 dependem de figuras de terceiros); todas as figuras recortadas do PDF; Q5 com alternativas em imagem; as 5 corrigidas no banco; sem divisão |
| quimica/quimica-ambiental | 9 | concluída | 2009-regular-D1-azul-Q026, 2014-regular-D1-azul-Q088, 2014-regular-D1-azul-Q048, 2022-regular-D2-azul-Q126, 2020-ppl-D2-azul-Q101 | b07000e | revisor: PASS na 3ª leitura (rodada 1: regra de força errada no Raio-X, erro comum entregava a Q1, exemplos espelhavam Q2, Q3 e Q5, faltavam cartão m = n × M × R, clivagem/monóxido de cloro, sulfeto × sulfato, metil × etil × acetato, recorte da Q3 descentrado; rodada 2: exemplo com Na₂S era distrator da Q5); 4 difíceis pelo b; Q3 recortada do PDF; 2011 Q062 descartada (dado decisivo em figura com crédito de livro); Q1, Q2, Q3 e Q5 corrigidas no banco; sem divisão |
| biologia/bioquimica | 1 | concluída | 2014-regular-D1-azul-Q047, 2012-regular-D1-azul-Q079, 2022-regular-D2-azul-Q120, 2025-reaplicacao-D2-azul-Q105, 2019-regular-D2-azul-Q117 | 84caa61 | revisor: PASS na 2ª leitura (rodada 1: pré-requisito usava 10 g/70 kcal da Q5; exemplos de dieta sem carne, amido pré-cortado com levedura e castanha queimada espelhavam Q1, Q4 e Q5; faltavam distratores ácidos graxos saturados, vitaminas A/E, viscosidade/densidade/lúpulo, leitura do zigue-zague, pH e aproveitamento); só 2 difíceis pelo b (banco tem poucas de bioquímica difíceis); Q2 recortada do PDF; Q3 e Q5 com quadros em tabela; Q2, Q3 e Q5 corrigidas no banco; sem divisão |
| biologia/citologia | 2 | concluída | 2012-regular-D1-azul-Q086, 2025-regular-D2-azul-Q103, 2017-regular-D2-azul-Q116, 2022-regular-D2-azul-Q121, 2022-ppl-D2-azul-Q101 | 609f103 | revisor: PASS na 2ª leitura (rodada 1: pré-requisito repetia 0,20/0,15 mol/L da Q1, faltavam pressão osmótica, íon, cromatina/cromátides, tubulina pronta, montagem bloqueada → despolimerização e citocinese por microfilamentos; exemplo do remédio contra protozoário espelhava a Q4; erros comuns entregavam Q3 e Q5; figura da Q3 sem anticorpos e com proteínas já separadas na etapa 1); 3 difíceis pelo b; figura da Q3 (crédito de livro) redesenhada em SVG; tabela da Q4 em markdown; sem divisão |
| biologia/fisiologia-humana | 3 | concluída | 2015-ppl-D1-branco-Q062, 2013-regular-D1-azul-Q056, 2024-ppl-D2-azul-Q111, 2023-ppl-D2-azul-Q128, 2023-regular-D2-azul-Q101 | d45fb39 | revisor: PASS na 2ª leitura (rodada 1: pH sem nome por extenso e sem neutro/básico, faltavam "válvulas venosas", sentido mão → tronco, frequência cardíaca, gastrointestinal e gameta; hemoglobina de maior afinidade atribuída também a povos humanos; Tópicos sem figura compacta); 3 difíceis pelo b; gravura de Harvey (1628, domínio público) recortada do PDF; 2 figuras SVG + 2 compactas; sem divisão |
| biologia/genetica | 4 | pendente |  |  |  |
| biologia/biotecnologia | 5 | pendente |  |  |  |
| biologia/evolucao | 6 | pendente |  |  |  |
| biologia/botanica | 7 | pendente |  |  |  |
| biologia/zoologia | 8 | pendente |  |  |  |
| biologia/ecologia | 9 | pendente |  |  |  |
| biologia/saude-publica | 10 | pendente |  |  |  |
| biologia/vacinacao | 11 | pendente |  |  |  |
| lingua-portuguesa/interpretacao-de-texto | 1 | pendente |  |  |  |
| lingua-portuguesa/denotacao-e-conotacao | 2 | pendente |  |  |  |
| lingua-portuguesa/ambiguidade | 3 | pendente |  |  |  |
| lingua-portuguesa/funcoes-da-linguagem | 4 | pendente |  |  |  |
| lingua-portuguesa/variacao-linguistica | 5 | concluída | 2015-ppl-D2-cinza-Q111, 2020-ppl-D1-azul-Q006, 2009-regular-D2-azul-Q131, 2015-ppl-D2-cinza-Q101, 2025-reaplicacao-D1-azul-Q043 | 3e2c6ef | piloto; revisor: PASS na 3ª leitura; sem divisão |
| lingua-portuguesa/generos-textuais | 6 | pendente |  |  |  |
| lingua-portuguesa/coesao-e-coerencia | 7 | pendente |  |  |  |
| lingua-portuguesa/intertextualidade | 8 | pendente |  |  |  |
| lingua-portuguesa/gramatica-norma-padrao | 9 | pendente |  |  |  |
| lingua-portuguesa/concordancia-e-regencia | 10 | pendente |  |  |  |
| lingua-portuguesa/pontuacao-e-seus-efeitos | 11 | pendente |  |  |  |
| lingua-portuguesa/escolas-literarias | 12 | pendente |  |  |  |
| lingua-portuguesa/analise-narrativa | 13 | pendente |  |  |  |
| lingua-portuguesa/analise-de-poesia | 14 | pendente |  |  |  |
| lingua-portuguesa/vanguardas-europeias | 15 | pendente |  |  |  |
| lingua-portuguesa/referencias-socioculturais | 16 | pendente |  |  |  |
| lingua-estrangeira/vocabulario-em-contexto | 1 | pendente |  |  | inglês |
| lingua-estrangeira/falsos-cognatos | 2 | pendente |  |  | inglês |
| lingua-estrangeira/conectivos | 3 | pendente |  |  | inglês |
| lingua-estrangeira/interpretacao-de-texto-e-compreensao-leitora | 4 | pendente |  |  | inglês |
| lingua-estrangeira/analise-de-generos-textuais | 5 | pendente |  |  | inglês |
| lingua-estrangeira/temas-culturais-e-atualidades | 6 | pendente |  |  | inglês |
| artes/movimentos-artisticos | 1 | pendente |  |  |  |
| artes/arte-moderna-e-contemporanea | 2 | pendente |  |  |  |
| artes/arte-como-critica-social | 3 | pendente |  |  |  |
| artes/patrimonio-cultural | 4 | pendente |  |  |  |
| historia/brasil-colonia | 1 | pendente |  |  |  |
| historia/revolucao-industrial | 2 | pendente |  |  |  |
| historia/revolucao-francesa | 3 | pendente |  |  |  |
| historia/brasil-imperio | 4 | pendente |  |  |  |
| historia/republica | 5 | pendente |  |  |  |
| historia/guerras-mundiais | 6 | pendente |  |  |  |
| historia/era-vargas | 7 | concluída | 2012-regular-D1-azul-Q041, 2022-regular-D1-azul-Q081, 2025-reaplicacao-D1-azul-Q057, 2024-ppl-D1-azul-Q082, 2017-regular-D1-azul-Q081 | 2e0855d | piloto; revisor: PASS na 2ª leitura; data do DIP: a questão 2 imprime 1937 (erro da prova), a aula ensina 1939; sem divisão |
| historia/guerra-fria | 8 | pendente |  |  |  |
| historia/ditadura-militar | 9 | pendente |  |  |  |
| historia/movimentos-sociais | 10 | pendente |  |  |  |
| historia/globalizacao | 11 | pendente |  |  |  |
| geografia/cartografia | 1 | pendente |  |  |  |
| geografia/demografia | 2 | pendente |  |  |  |
| geografia/migracao | 3 | pendente |  |  |  |
| geografia/urbanizacao | 4 | pendente |  |  |  |
| geografia/agricultura | 5 | pendente |  |  |  |
| geografia/questoes-ambientais | 6 | pendente |  |  |  |
| geografia/mudancas-climaticas | 7 | pendente |  |  |  |
| geografia/globalizacao | 8 | pendente |  |  |  |
| geografia/blocos-economicos | 9 | pendente |  |  |  |
| geografia/geopolitica | 10 | pendente |  |  |  |
| geografia/conflitos-internacionais | 11 | pendente |  |  |  |
| filosofia/filosofia-antiga | 1 | pendente |  |  |  |
| filosofia/filosofia-moderna | 2 | pendente |  |  |  |
| filosofia/filosofia-contemporanea | 3 | pendente |  |  |  |
| filosofia/etica | 4 | pendente |  |  |  |
| filosofia/politica | 5 | pendente |  |  |  |
| filosofia/cidadania | 6 | pendente |  |  |  |
| sociologia/cultura | 1 | pendente |  |  |  |
| sociologia/industria-cultural | 2 | pendente |  |  |  |
| sociologia/trabalho | 3 | pendente |  |  |  |
| sociologia/desigualdade-social | 4 | pendente |  |  |  |
| sociologia/estado-e-poder | 5 | pendente |  |  |  |
| sociologia/cidadania | 6 | pendente |  |  |  |
| sociologia/direitos-humanos | 7 | pendente |  |  |  |
| sociologia/movimentos-sociais | 8 | pendente |  |  |  |

## Redação (aguarda a decisão sobre o Teste de Fogo)

| aula | order | status | questões | commit | notas |
|---|---|---|---|---|---|
| redacao/redacao-dissertativo-argumentativa | 3 | pendente |  |  | veio de lingua-portuguesa |
| redacao/proposta-de-intervencao | 8 | pendente |  |  | veio de lingua-portuguesa |
| redacao/regras-da-nota-zero | 1 | pendente |  |  | nova |
| redacao/leitura-da-proposta-e-recorte-do-tema | 2 | pendente |  |  | nova |
| redacao/repertorio-sociocultural | 4 | pendente |  |  | nova |
| redacao/projeto-de-texto-e-argumentacao | 5 | pendente |  |  | nova |
| redacao/coesao-conectivos-e-referenciacao | 6 | pendente |  |  | nova |
| redacao/norma-padrao-na-redacao | 7 | pendente |  |  | nova |

## Fase 4: temas que faltavam

| aula | order | status | questões | commit | notas |
|---|---|---|---|---|---|
| matematica-basica/divisibilidade-e-fatoracao | 7 | pendente |  |  | nova |
| matematica-basica/inequacoes | 8 | pendente |  |  | nova |
| matematica-basica/sistemas-lineares | 9 | pendente |  |  | nova |
| funcoes/progressao-aritmetica | 5 | pendente |  |  | nova |
| funcoes/funcoes-polinomiais-e-racionais | 6 | pendente |  |  | nova |
| funcoes/progressao-geometrica | 7 | pendente |  |  | nova |
| geometria/teorema-de-tales | 6 | pendente |  |  | nova |
| geometria/relacoes-metricas-no-triangulo-retangulo | 7 | pendente |  |  | nova |
| geometria/ciclo-trigonometrico | 8 | pendente |  |  | nova |
| geometria/circunferencia-arcos-e-angulos | 9 | pendente |  |  | nova |
| geometria/plano-cartesiano | 10 | pendente |  |  | nova |
| geometria/equacao-da-reta | 11 | pendente |  |  | nova |
| geometria/equacao-da-circunferencia | 12 | pendente |  |  | nova |
| geometria/posicoes-relativas | 13 | pendente |  |  | nova |
| fisica/grandezas-e-unidades | 11 | pendente |  |  | nova |
| fisica/estatica-e-torque | 12 | pendente |  |  | nova |
| fisica/gravitacao | 13 | pendente |  |  | nova |
| fisica/ondulatoria | 14 | pendente |  |  | nova |
| fisica/magnetismo-e-eletromagnetismo | 15 | pendente |  |  | nova |
| quimica/materiais-e-estados-fisicos | 10 | pendente |  |  | nova |
| quimica/misturas-e-separacao | 11 | pendente |  |  | nova |
| quimica/gases | 12 | pendente |  |  | nova |
| quimica/cinetica-quimica | 13 | pendente |  |  | nova |
| quimica/equilibrio-quimico | 14 | pendente |  |  | nova |
| quimica/eletroquimica | 15 | pendente |  |  | nova |
| quimica/radioatividade | 16 | pendente |  |  | nova |
| quimica/fontes-de-energia | 17 | pendente |  |  | nova |
| quimica/industria-quimica-e-tratamento-de-agua | 18 | pendente |  |  | nova |
| biologia/biologia-como-ciencia | 12 | pendente |  |  | nova |
| biologia/origem-da-vida | 13 | pendente |  |  | nova |
| biologia/histologia | 14 | pendente |  |  | nova |
| biologia/microbiologia-e-virologia | 15 | pendente |  |  | nova |
| biologia/sistematica-e-filogenia | 16 | pendente |  |  | nova |
| biologia/embriologia | 17 | pendente |  |  | nova |
| biologia/imunologia-e-grupos-sanguineos | 18 | pendente |  |  | nova |
| biologia/biomas-brasileiros | 19 | pendente |  |  | nova |
| biologia/conservacao-e-legislacao-ambiental | 20 | pendente |  |  | nova |
| biologia/indicadores-sociais | 21 | pendente |  |  | nova |
| lingua-portuguesa/figuras-de-linguagem | 17 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-interpretacao-de-texto | 7 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-generos-textuais | 8 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-vocabulario-em-contexto | 9 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-conectivos | 10 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-temas-culturais-e-atualidades | 11 | pendente |  |  | nova |
| lingua-estrangeira/espanhol-falsos-cognatos | 12 | pendente |  |  | nova |
| historia/antiguidade-e-idade-media | 12 | pendente |  |  | nova |
| historia/povos-indigenas-e-afro-brasileiros | 13 | pendente |  |  | nova |
| historia/independencias-na-america-latina | 14 | pendente |  |  | nova |
| historia/neocolonialismo-e-imperialismo | 15 | pendente |  |  | nova |
| historia/revolucoes-russa-chinesa-e-cubana | 16 | pendente |  |  | nova |
| filosofia/liberalismo-e-seus-criticos | 7 | pendente |  |  | nova |
| educacao-fisica/corpo-esporte-e-sociedade | 1 | pendente |  |  | nova |
| tic/tecnologias-e-sociedade | 1 | pendente |  |  | nova |
