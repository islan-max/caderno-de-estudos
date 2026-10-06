// Plugin hast (Sätteri): nenhum título da aula "pula" de nível.
//
// O leitor de tela monta o índice da página pelos níveis de título (h1 → h2 → h3…).
// Um h4 logo abaixo de um h2 aparece como se faltasse um título no meio (WCAG 1.3.1).
// As aulas escrevem os Tópicos-Chave em `####` direto sob `## Tópicos-Chave` (ver
// docs/aulas/formato-das-aulas-mdx.md); em vez de reescrever as centenas de aulas, este
// plugin rebaixa o salto na hora do build e deixa uma marca (data-visual) para o CSS
// manter a aparência que o autor escolheu.
//
// Regra: o título vira "filho do título anterior de nível menor", ou seja, nível dele + 1.
// O <h1> é o título da aula e vem do layout, não do MDX, então a contagem começa nele.
export function niveisDeTitulo() {
  // Pilha de ancestrais: { original, novo }. O h1 do layout é o primeiro.
  const pilha = [{ original: 1, novo: 1 }];

  // Objeto simples: `defineHastPlugin` (satteri) só acrescenta tipos, não muda nada em tempo de execução.
  return {
    name: 'niveis-de-titulo',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      visit(no, ctx) {
        const original = Number(no.tagName[1]);
        while (pilha.length > 1 && pilha[pilha.length - 1].original >= original) pilha.pop();
        const novo = Math.min(6, pilha[pilha.length - 1].novo + 1);
        pilha.push({ original, novo });
        if (novo === original) return;
        return {
          type: 'element',
          tagName: `h${novo}`,
          // hast guarda atributos data-* em camelCase (dataVisual → data-visual).
          properties: { ...no.properties, dataVisual: `h${original}` },
          children: no.children,
        };
      },
    },
  };
}

// Tabelas largas: o Markdown gera <table> solta, que em tela estreita (ou com zoom de
// 400%) alarga a página inteira e força rolagem horizontal da página (WCAG 1.4.10).
// O plugin embrulha cada tabela num contêiner que rola sozinho. O contêiner recebe foco
// pelo teclado (tabindex=0) e um nome, senão quem não usa mouse não consegue rolar a tabela.
export function tabelasRolaveis() {
  return {
    name: 'tabelas-rolaveis',
    element: {
      filter: ['table'],
      visit(no, ctx) {
        ctx.wrapNode(no, {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['tabela-rolavel'],
            role: 'region',
            ariaLabel: 'Tabela. Use as setas para rolar para os lados',
            tabIndex: 0,
          },
          children: [],
        });
      },
    },
  };
}
