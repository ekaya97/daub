import type { DaubConfig } from '@daub/core';
import { DaubApp } from './DaubApp.js';

export function mountDaub(config: DaubConfig): void {
  if (document.getElementById('__daub_host__')) return;

  const host = document.createElement('div');
  host.id = '__daub_host__';
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;top:0;left:0;width:0;height:0;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const app = new DaubApp(shadow, config);
  app.mount();

  console.log('[Daub] mounted', { position: config.position });
}
