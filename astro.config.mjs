import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [],
  site: 'https://contactos-jciecuador.netlify.app',
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['canvas-confetti']
    }
  },

  adapter: netlify()
});
