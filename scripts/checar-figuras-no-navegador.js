// Checagem das figuras SVG de uma aula, para rodar no console do navegador
// (ou pela ferramenta de JavaScript do navegador) com a aula aberta no `npm run dev`.
// Lista textos que saem da área do desenho (viewBox) ou que se sobrepõem.
// O jsdom não calcula tamanho de texto, por isso esta checagem é no navegador.
// Resultado esperado: [] (nenhum problema).
[...document.querySelectorAll('article svg')]
  .map((svg) => {
    const vb = svg.viewBox.baseVal;
    const textos = [...svg.querySelectorAll('text')].map((t) => [t.textContent, t.getBBox()]);
    const fora = textos
      .filter(([, b]) => b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1)
      .map(([t]) => t);
    const sobrepostos = [];
    for (let i = 0; i < textos.length; i++) {
      for (let j = i + 1; j < textos.length; j++) {
        const a = textos[i][1];
        const b = textos[j][1];
        if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) {
          sobrepostos.push(`${textos[i][0]} / ${textos[j][0]}`);
        }
      }
    }
    return { figura: svg.getAttribute('aria-labelledby')?.split(' ')[0], fora, sobrepostos };
  })
  .filter((f) => f.fora.length || f.sobrepostos.length);
