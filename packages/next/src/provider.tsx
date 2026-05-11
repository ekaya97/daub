// @ts-nocheck
'use client';

import type { ReactNode, JSX } from 'react';
import { useEffect } from 'react';

export function DaubProvider({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // Config injected by withDaub via DefinePlugin, or fallback defaults
    const config = typeof globalThis.__DAUB_CONFIG_JSON__ === 'string'
      ? JSON.parse(globalThis.__DAUB_CONFIG_JSON__)
      : {
          position: 'bottom-right',
          outputDir: '.daub-output',
          projectRoot: '',
          writeEndpoint: '/api/daub-write',
          token: '',
          shortcut: 'Alt+Shift+D',
          modifyGitignore: true,
        };

    (window as any).__DAUB_CONFIG__ = config;

    import('@daub/overlay').then((mod) => {
      mod.mountDaub(config);
    }).catch((e) => {
      console.warn('[Daub] Could not load overlay:', e);
    });
  }, []);

  return <>{children}</>;
}
