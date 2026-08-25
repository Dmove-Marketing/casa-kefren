import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://eventos.casakefren.com.br',
  output: 'static',
  prefetch: true,
  build: {
    inlineStylesheets: 'always',
  },
  server: {
    port: 4324,
  },
});
