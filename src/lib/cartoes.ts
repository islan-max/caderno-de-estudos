// Cartões de revisão = os tópicos de "Tópicos-Chave para Revisão" (cada `#### N. Título` dentro de
// <div className="topico">). Aqui só se CONTA quantos a aula tem; o conteúdo de cada um é lido do
// HTML da própria aula na hora da revisão (src/scripts/revisao.ts), para trazer fórmulas e figuras
// já prontas. Para tirar uma aula (ou matéria) da revisão: <div className="topico" data-cartoes="nao">.

export function contarCartoes(corpo = ''): number {
  const abertura = /<div\s+className="topico"([^>]*)>/.exec(corpo);
  if (!abertura || /data-cartoes="nao"/.test(abertura[1])) return 0;
  const resto = corpo.slice(abertura.index);
  const fim = resto.search(/\n##\s/);
  const bloco = fim < 0 ? resto : resto.slice(0, fim);
  return (bloco.match(/^####\s/gm) ?? []).length;
}
