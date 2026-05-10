import type { DaubOptions } from '@daub/core';

interface ResolvedOpts {
  position: NonNullable<DaubOptions['position']>;
  outputDir: string;
  shortcut: string;
  modifyGitignore: boolean;
}

export function generateBootstrapScript(opts: ResolvedOpts, projectRoot: string, token: string): string {
  const config = {
    position: opts.position,
    outputDir: opts.outputDir,
    projectRoot,
    writeEndpoint: '/daub-write',
    token,
    shortcut: opts.shortcut,
    modifyGitignore: opts.modifyGitignore,
  };

  return `window.__DAUB_CONFIG__ = ${JSON.stringify(config)};`;
}

export function generateMountScript(): string {
  return `import { mountDaub } from '/@daub/overlay'; mountDaub(window.__DAUB_CONFIG__);`;
}
