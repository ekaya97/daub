import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['vite'],
  onSuccess: async () => {
    const src = resolve(__dirname, '../overlay/dist/index.js');
    const dest = resolve(__dirname, 'dist/overlay.js');
    if (existsSync(src)) {
      mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
      copyFileSync(src, dest);
      console.log('[daub] overlay.js copied into plugin dist');
    } else {
      console.warn('[daub] overlay/dist/overlay.js not found — build overlay first');
    }
  },
});
