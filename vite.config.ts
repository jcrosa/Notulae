import { defineConfig } from 'vite';

// El base path es configurable para desplegar en GitHub Pages (proyecto:
// https://<usuario>.github.io/notulae/). En local, `/`. En CI se puede
// sobreescribir con la variable de entorno BASE_PATH.
const base = process.env.BASE_PATH ?? '/notulae/';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : base,
  build: {
    target: 'es2022',
    sourcemap: true,
  },
}));
