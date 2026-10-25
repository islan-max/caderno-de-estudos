# Recomendador de aulas

Sugere a próxima aula a partir das **matérias que a pessoa escolheu** e dos **👍/👎** que ela deu a aulas, e diz **por que** cada aula foi sugerida. As regras estão em [`src/lib/recomendacao.ts`](../src/lib/recomendacao.ts) (funções puras, sem DOM) e os testes em [`src/lib/recomendacao.test.ts`](../src/lib/recomendacao.test.ts).

## Como funciona

- Cada aula tem etiquetas: a **matéria** (peso 1), o **grupo** (0,5) e até 4 **termos raros do título** (até 0,5, mais raro pesa mais, por idf do catálogo).
- O perfil soma: +1 na matéria de cada interesse e ±0,5 em todas as etiquetas de cada aula avaliada.
- A nota de uma aula é a soma dos pesos das suas etiquetas no perfil; só entram as de nota positiva. Desempate por id, então a mesma entrada dá sempre a mesma lista.
- Ficam de fora o que já foi concluído e o que a pessoa já avaliou (avaliar é decidir).
- O motivo vem das mesmas contas: "Você escolheu Física" e/ou "Parecida com “…”, que você curtiu" (a aula curtida que mais divide etiquetas).
- Sem interesse nem feedback não há sugestão: a interface pede para escolher matérias (problema do usuário novo, assumido em vez de disfarçado com uma lista aleatória).

Por que não um modelo: o catálogo é pequeno (160 aulas), não há dados de uso de outras pessoas e tudo roda no navegador. Um modelo treinado não teria com o que aprender, e as contas acima podem ser conferidas à mão.

## Avaliação offline

`node --experimental-strip-types scripts/avaliar-recomendacao.ts` (depois de `npm run build`), semente 2026, 500 pessoas sintéticas, k = 5, catálogo real:

| Método | Precisão@5 | Achou a outra matéria |
|---|---|---|
| Recomendador (interesse + 👍) | 100,0% | 77,6% |
| Só interesses (sem 👍) | 100,0% | 0,0% |
| Aulas com mais cartões | 16,6% | 6,0% |
| Sorteio (média de 20) | 14,9% | 15,5% |

Cada pessoa sintética gosta de um grupo inteiro, declara uma matéria dele e dá 👍 a duas aulas de outra matéria do mesmo grupo. "Achou a outra matéria" é a medida que interessa: o 👍 faz o recomendador chegar numa matéria que a pessoa nunca declarou; sem 👍 isso não acontece.

**Leia com cuidado:**
- A precisão de 100% **não** é um resultado: o interesse declarado já enche as 5 primeiras vagas com aulas do mesmo grupo. Fica na tabela só para mostrar que os baselines não chegam perto.
- O grupo é uma etiqueta que o próprio recomendador usa; a avaliação é um teste de sanidade (o feedback muda e melhora a lista?), **não prova** de que as sugestões servem a uma pessoa real. Isso só se mede com pessoas.
- "Mais cartões" é um substituto fraco de "popular": o caderno não tem dados de uso, então não existe lista popular de verdade.

## Limites conhecidos

- Os termos do título são a única leitura do conteúdo (sem sinônimos, sem o texto da aula).
- Sem noção de dificuldade, pré-requisito ou de quando revisar (isso é da fila do "Hoje").
- Preferências e 👍/👎 ficam só neste navegador.
