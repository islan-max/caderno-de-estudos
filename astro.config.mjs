// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

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
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
