import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/api.ts', 'src/app-route.ts', 'src/provider.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['next', 'react', 'react-dom', 'react/jsx-runtime', 'vite-plugin-daub', '@daub/overlay', 'webpack'],
  esbuildOptions(options) {
    // Use automatic JSX runtime — outputs import { jsx } from "react/jsx-runtime"
    // instead of React.createElement, so no global React import needed
    options.jsx = 'automatic';
  },
});
