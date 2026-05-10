import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import daub from 'vite-plugin-daub';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    daub(),
  ],
});
