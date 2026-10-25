# Resumo de vídeo

Página `/resumo-de-video`: a pessoa cola ou envia a **transcrição** de um vídeo e recebe pontos por trecho, cada um com o momento do vídeo. As regras estão em [`src/lib/resumo.ts`](../src/lib/resumo.ts) (funções puras) e os testes em [`src/lib/resumo.test.ts`](../src/lib/resumo.test.ts).

## Decisões

- **Transcrição enviada pela pessoa, sem buscar nada no YouTube.** Baixar legendas por fora do player depende de servidor e esbarra nos termos do serviço. Aqui a pessoa copia o texto de “Mostrar transcrição” ou envia um `.vtt`/`.srt`, e o endereço do vídeo só serve para montar os links do minuto (`…&t=75s`). Só endereços do YouTube são aceitos.
- **Tudo no navegador.** Não há servidor, chave de API, custo por pedido nem armazenamento: a transcrição some ao fechar a página. Por isso “limitar custo e número de solicitações” não se aplica; o que existe são limites de tamanho (abaixo).
- **Resumo extrativo, não generativo.** Cada ponto é uma frase da transcrição, sem reescrita: dá para conferir de onde veio e nada é inventado. O preço é que o texto fica como foi falado.
- **Revisão antes de exportar.** Todos os pontos vêm marcados; a pessoa desmarca o que não quer, vê o Markdown final numa caixa e só então baixa ou copia.

## Como funciona

1. A transcrição é lida (WebVTT, SRT ou texto copiado, com a marca sozinha na linha ou junto do texto). Marcações, sons de fundo (`[Música]`, ♪) e a repetição de linha da legenda automática rolante são removidos.
2. O texto vira frases (corta em `. ! ? …`; sem pontuação, em 25 palavras) e as frases viram trechos de cerca de 250 palavras ou 2 minutos.
3. Em cada trecho, cada palavra pesa tf-idf (aparece muito no trecho e em poucos trechos); a nota da frase é a soma dos pesos dividida pela raiz do número de palavras distintas. Ficam as 1 a 3 melhores frases do trecho, em ordem de fala; frases com menos de 6 palavras não entram.

## Incerteza e falhas (o que a página diz em vez de esconder)

- Sem marcas de tempo: avisa que os pontos não levam ao momento do vídeo.
- Quase sem pontuação (legenda automática): avisa de possíveis erros de reconhecimento e de frases cortadas por tamanho.
- Transcrição curta (menos de 150 palavras) ou trecho com pouco texto (menos de 40 palavras): avisa que o resumo diz pouco.
- Recusa, com a razão: texto vazio ou com menos de 20 palavras, mais de 1 MB, mais de 60 mil palavras, mais de 3 horas, endereço que não é de vídeo do YouTube.

## Exemplo (transcrição sintética de 7 frases, escrita para a documentação)

```markdown
# Ciclo da água (exemplo)

- [0:50] Quando as gotas ficam pesadas demais elas caem como chuva, granizo ou neve.
- [1:15] Parte da água da chuva escorre pela superfície e volta para os rios.
- [2:30] O ciclo da água é contínuo: a água que bebemos hoje já passou por muitas nuvens e muitos rios.
```

Avisos mostrados: “Transcrição curta: um resumo diz pouco além do que já está no texto.” A frase de enchimento (“curtir o vídeo”) ficou de fora, mas o resumo também **deixou de fora a definição de evaporação e a de condensação**, que um resumo escrito à mão traria. Em textos curtos (um trecho só) o peso das palavras raras quase não diferencia as frases; o método rende mais em vídeos longos, com vários trechos, mas isso não foi medido com vídeos reais.

## Limites conhecidos

- Não foi testado com transcrições reais de vídeos (o repositório não guarda nenhuma): os testes usam legendas sintéticas escritas para cobrir os formatos e as armadilhas conhecidas.
- A lista de palavras sem valor cobre português e um pouco de inglês; outras línguas funcionam pior.
- Frases importantes ditas de passagem, ou divididas pela legenda em dois cartões sem pontuação, podem ficar de fora ou aparecer cortadas.
- Não há comparação medida com resumos feitos por pessoas.
