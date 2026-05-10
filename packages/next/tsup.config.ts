import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/api.ts', 'src/app-route.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['next', 'react', 'react-dom', 'vite-plugin-daub', '@daub/overlay', 'webpack'],
});
