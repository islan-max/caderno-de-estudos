// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { niveisDeTitulo, tabelasRolaveis } from './src/lib/niveis-de-titulo.mjs';

// Site estático: as aulas são publicadas no repositório como arquivos MDX.
// BASE_PATH é definido pelo workflow do GitHub Pages (ex.: /caderno-de-estudos).
export default defineConfig({
  output: 'static',
  base: process.env.BASE_PATH || '/',

  integrations: [mdx()],

  // Baixa a próxima página assim que o link entra na tela. Com o ClientRouter,
  // a navegação passa a usar o HTML já em cache em vez de esperar a rede.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  // Código das aulas: duas paletas (claro e escuro); o CSS escolhe a do tema do site.
  markdown: {
    // Corrige saltos de nível de título (h2 → h4) sem reescrever as aulas. O Astro 7 usa o
    // processador Sätteri; seus plugins "hast" fazem o papel dos antigos plugins rehype.
    processor: satteri({ hastPlugins: [niveisDeTitulo(), tabelasRolaveis()] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
