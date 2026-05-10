import type { Plugin } from 'vite';
import type { DaubOptions } from '@daub/core';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { handleDaubWrite } from './middleware.js';
import { generateBootstrapScript, generateMountScript } from './bootstrap.js';

function getDirname(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
}

const VIRTUAL_ID = '/@daub/overlay';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export type { DaubOptions };

export default function daub(options: DaubOptions = {}): Plugin {
  const opts = {
    enabled: options.enabled ?? true,
    outputDir: options.outputDir ?? '.daub-output',
    position: options.position ?? 'bottom-right' as const,
    shortcut: options.shortcut ?? 'Alt+Shift+D',
    modifyGitignore: options.modifyGitignore ?? true,
  };

  const token = randomUUID();

  return {
    name: 'vite-plugin-daub',
    apply: 'serve',
    enforce: 'post',

    configureServer(server) {
      const resolvedOutputDir = resolve(server.config.root, opts.outputDir);
      server.middlewares.use('/daub-write', handleDaubWrite(resolvedOutputDir, token, opts.modifyGitignore));
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id === RESOLVED_ID) {
        const overlayPath = resolve(getDirname(), 'overlay.js');
        return readFileSync(overlayPath, 'utf-8');
      }
    },

    transformIndexHtml() {
      if (!opts.enabled) return [];

      const projectRoot = process.cwd().replace(/\\/g, '/');

      return [
        {
          tag: 'script',
          injectTo: 'head',
          children: generateBootstrapScript(opts, projectRoot, token),
        },
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: generateMountScript(),
          injectTo: 'body',
        },
      ];
    },
  };
}
