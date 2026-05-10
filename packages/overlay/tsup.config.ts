import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  clean: true,
  minify: true,
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  treeshake: true,
});
