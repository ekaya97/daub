// Client entry point for Next.js — mounts the Daub overlay in dev mode.
// Injected into the webpack entry by withDaub().
// @ts-nocheck — dynamic import of overlay doesn't need type checking

declare const globalThis: any;

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const config = typeof globalThis.__DAUB_CONFIG_JSON__ === 'string'
    ? JSON.parse(globalThis.__DAUB_CONFIG_JSON__)
    : (window as any).__DAUB_CONFIG__;

  if (config) {
    (window as any).__DAUB_CONFIG__ = config;

    const mount = () => {
      import('@daub/overlay').then((mod: any) => {
        mod.mountDaub(config);
      }).catch(() => {
        console.warn('[Daub] Could not load overlay.');
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }
}

export {};
