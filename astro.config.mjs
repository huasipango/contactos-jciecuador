import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://contactos-jciecuador.netlify.app',
  output: 'server',

  vite: {
    ssr: {
      noExternal: ['canvas-confetti']
    }
  },

  adapter: netlify()
});