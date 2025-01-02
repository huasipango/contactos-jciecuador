import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://contactos.jciecuador.com',
  output: 'server',
  vite: {
    ssr: {
      noExternal: ['canvas-confetti']
    }
  }
}); 