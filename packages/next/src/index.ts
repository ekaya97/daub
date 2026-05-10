import type { DaubOptions, DaubConfig } from '@daub/core';
import { randomUUID } from 'node:crypto';

export type { DaubOptions };

export function withDaub(nextConfig: any = {}, options: DaubOptions = {}) {
  const opts = {
    enabled: options.enabled ?? true,
    outputDir: options.outputDir ?? '.daub-output',
    position: options.position ?? 'bottom-right' as const,
    shortcut: options.shortcut ?? 'Alt+Shift+D',
    modifyGitignore: options.modifyGitignore ?? true,
  };

  if (!opts.enabled) return nextConfig;

  const token = randomUUID();

  return {
    ...nextConfig,
    webpack(config: any, context: any) {
      // Turbopack detection (v2 G2)
      if (!context.webpack) {
        console.warn('[Daub] Turbopack detected. Run with --no-turbo for Daub support in v1.');
        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, context);
        }
        return config;
      }

      if (context.dev && !context.isServer) {
        // Inject client entry point
        const originalEntry = config.entry;
        config.entry = async () => {
          const entries = await (typeof originalEntry === 'function' ? originalEntry() : originalEntry);

          // Inject Daub config as a global
          const projectRoot = process.cwd().replace(/\\/g, '/');
          const daubConfig: DaubConfig = {
            position: opts.position,
            outputDir: opts.outputDir,
            projectRoot,
            writeEndpoint: '/api/daub-write',
            token,
            shortcut: opts.shortcut,
            modifyGitignore: opts.modifyGitignore,
          };

          // Add a virtual entry that sets window.__DAUB_CONFIG__ and mounts
          const inlineEntry = `
            if (typeof window !== 'undefined') {
              window.__DAUB_CONFIG__ = ${JSON.stringify(daubConfig)};
            }
          `;

          // Find the main client entry
          const mainKey = Object.keys(entries).find(k =>
            k.includes('main') || k.includes('app')
          );

          if (mainKey && Array.isArray(entries[mainKey])) {
            // Prepend inline config and client entry
            const clientPath = require.resolve('@daub/next/client');
            if (!entries[mainKey].includes(clientPath)) {
              entries[mainKey].unshift(clientPath);
            }
          }

          return entries;
        };

        // Define the config as a global via webpack.DefinePlugin
        config.plugins = config.plugins || [];
        if (context.webpack) {
          config.plugins.push(
            new context.webpack.DefinePlugin({
              'globalThis.__DAUB_CONFIG_JSON__': JSON.stringify(JSON.stringify({
                position: opts.position,
                outputDir: opts.outputDir,
                projectRoot: process.cwd().replace(/\\/g, '/'),
                writeEndpoint: '/api/daub-write',
                token,
                shortcut: opts.shortcut,
                modifyGitignore: opts.modifyGitignore,
              })),
            }),
          );
        }
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, context);
      }
      return config;
    },
  };
}
