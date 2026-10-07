// Checagem das figuras SVG de uma aula, para rodar no console do navegador
// (ou pela ferramenta de JavaScript do navegador) com a aula aberta no `npm run dev`.
// O jsdom não calcula geometria nem tamanho de texto, por isso esta checagem é no navegador.
// Resultado esperado: [] (nenhum problema). Cada item traz { figura, tipo, detalhe }.
//
// Tipos:
//  - texto-fora / texto-sobreposto: texto que sai do viewBox ou cai em cima de outro texto.
//  - seta: a haste de uma seta entra na ponta triangular (a reta aparece por cima/através da ponta).
//    Correção: a haste termina no meio da base do triângulo.
//  - reta-no-no: uma reta termina dentro de um círculo, caixa ou forma pequena (um "nó"). Correção:
//    a reta termina na borda do nó.
//  - reta-sobre-no: uma reta atravessa um círculo/bolinha. Correção: a reta vem ANTES do nó no SVG
//    e o nó leva a classe `no` (preenchimento opaco). Exceção: marca "X" sobre o círculo.
window.checarFiguras = (svgs) => {
  const NUM = (v) => Math.round(v * 100) / 100;
  const GEO = 'line,rect,circle,ellipse,polygon,polyline,path';
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const geo = (svg) => [...svg.querySelectorAll(GEO)].filter((e) => !e.closest('defs,marker'));
  const amostras = (el, passo = 1.2) => {
    const L = el.getTotalLength();
    const n = Math.max(2, Math.ceil(L / passo));
    return Array.from({ length: n + 1 }, (_, i) => {
      const p = el.getPointAtLength((L * i) / n);
      return [p.x, p.y];
    });
  };
  const vertices = (el) => {
    if (el.tagName === 'polygon') return [...el.points].map((p) => [p.x, p.y]);
    if (el.tagName !== 'path') return null;
    const d = el.getAttribute('d');
    if (/[CcQqSsTtAa]/.test(d)) return null;
    const m = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => +x[0]);
    const v = [];
    for (let i = 0; i + 1 < m.length; i += 2) v.push([m[i], m[i + 1]]);
    return v;
  };
  const fechada = (el) => (el.tagName === 'path' ? /z\s*$/i.test(el.getAttribute('d').trim()) : ['rect', 'circle', 'ellipse', 'polygon'].includes(el.tagName));

  // Acha a ponta de seta (triângulo pequeno) em que a haste S entra. Devolve o novo fim da haste, ou null.
  const cortarNaBase = (S, T, dentro) => {
    const el = S.el;
    const L = el.getTotalLength();
    const v = vertices(T.el);
    const fim = el.getPointAtLength(L);
    const f = [fim.x, fim.y];
    if (!dentro(T.el, f[0], f[1]) && Math.min(...v.map((q) => dist(f, q))) > 1.5) return null;
    const cauda = el.getPointAtLength(L - Math.min(30, L));
    const longe = v.map((q) => dist(q, [cauda.x, cauda.y]));
    const ponta = longe.indexOf(Math.max(...longe));
    const base = v.filter((_, i) => i !== ponta);
    return [NUM((base[0][0] + base[1][0]) / 2), NUM((base[0][1] + base[1][1]) / 2)];
  };

  return svgs.flatMap((svg) => {
    const figura = svg.getAttribute('aria-labelledby')?.split(' ')[0];
    const problemas = [];
    const p = (tipo, detalhe) => problemas.push({ figura, tipo, detalhe });
    const vb = svg.viewBox.baseVal;
    const ponto = (x, y) => {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      return pt;
    };
    const dentro = (el, x, y) => {
      try {
        return el.isPointInFill(ponto(x, y));
      } catch {
        return false;
      }
    };
    const fundo = (el, x, y, r = 1.8) => dentro(el, x, y) && dentro(el, x + r, y) && dentro(el, x - r, y) && dentro(el, x, y + r) && dentro(el, x, y - r);

    // --- textos ---
    const textos = [...svg.querySelectorAll('text')].filter((t) => !t.getAttribute('transform')).map((t) => [t.textContent, t.getBBox()]);
    textos
      .filter(([, b]) => b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1)
      .forEach(([t]) => p('texto-fora', t));
    for (let i = 0; i < textos.length; i++) {
      for (let j = i + 1; j < textos.length; j++) {
        const a = textos[i][1];
        const b = textos[j][1];
        if (a.x < b.x + b.width && b.x < a.x + a.width && a.y + 3 < b.y + b.height && b.y + 3 < a.y + a.height) p('texto-sobreposto', `${textos[i][0]} / ${textos[j][0]}`);
      }
    }

    // --- setas e nós ---
    const els = geo(svg);
    const info = els.map((el, k) => {
      const cs = getComputedStyle(el);
      return { el, k, tag: el.tagName, preenchido: cs.fill !== 'none', traco: cs.stroke !== 'none', fechada: fechada(el), b: el.getBBox(), opaco: el.classList.contains('no') };
    });
    const pontas = info.filter((o) => {
      if (o.tag !== 'polygon' && o.tag !== 'path') return false;
      const v = vertices(o.el);
      return v && o.fechada && new Set(v.map((q) => q.join())).size === 3 && Math.max(o.b.width, o.b.height) <= 18;
    });
    const ehPonta = new Set(pontas.map((o) => o.k));
    const abertas = info.filter((o) => o.traco && !o.preenchido && !o.fechada);
    abertas.forEach((S) => {
      let sm;
      try {
        sm = amostras(S.el, 1);
      } catch {
        return;
      }
      pontas.forEach((T) => {
        const n = sm.filter((q) => dentro(T.el, q[0], q[1])).length;
        if (n >= 3 && cortarNaBase(S, T, dentro)) p('seta', `haste #${S.k} entra na ponta #${T.k}`);
      });
    });
    const nos = info.filter((o) => o.fechada && !ehPonta.has(o.k) && o.traco);
    abertas
      .filter((S) => S.tag === 'line')
      .forEach((S) => {
        const pts = [[+S.el.getAttribute('x1'), +S.el.getAttribute('y1')], [+S.el.getAttribute('x2'), +S.el.getAttribute('y2')]];
        nos.forEach((F) => {
          const dim = Math.max(F.b.width, F.b.height);
          const pequeno = dim <= 30;
          const redondo = F.tag === 'circle' || F.tag === 'ellipse';
          const no = F.preenchido || pequeno;
          const dentroEm = pts.map((q) => fundo(F.el, q[0], q[1]));
          if (dentroEm[0] && dentroEm[1]) return;
          if (dentroEm[0] || dentroEm[1]) {
            if (no) p('reta-no-no', `reta #${S.k} termina dentro de #${F.k} (${F.tag})`);
            return;
          }
          if (!(redondo || pequeno) || !no) return;
          // marca sobre o círculo (um "X" de eliminado): as duas pontas ficam a até 1,8 raio do centro
          const raio = F.tag === 'circle' ? +F.el.getAttribute('r') : Math.max(+F.el.getAttribute('rx'), +F.el.getAttribute('ry'));
          const cx = F.tag === 'rect' ? F.b.x + F.b.width / 2 : +F.el.getAttribute('cx');
          const cy = F.tag === 'rect' ? F.b.y + F.b.height / 2 : +F.el.getAttribute('cy');
          if (raio && pts.every((q) => Math.hypot(q[0] - cx, q[1] - cy) <= raio * 1.8)) return;
          const n = amostras(S.el, 1).filter((q) => fundo(F.el, q[0], q[1], 1.5)).length;
          if (n >= 3 && !(F.opaco && S.k < F.k)) p('reta-sobre-no', `reta #${S.k} atravessa #${F.k} (${F.tag})${F.opaco ? ' mas vem depois dele' : ' sem a classe no'}`);
        });
      });
    return problemas;
  });
};
checarFiguras([...document.querySelectorAll('article svg')]);
