import { describe, it, expect } from 'vitest';
import { generateBootstrapScript, generateMountScript } from '../bootstrap.js';

describe('generateBootstrapScript', () => {
  const defaultOpts = {
    position: 'bottom-right' as const,
    outputDir: '.daub-output',
    shortcut: 'Alt+Shift+D',
    modifyGitignore: true,
  };

  it('sets window.__DAUB_CONFIG__', () => {
    const script = generateBootstrapScript(defaultOpts, '/Users/me/project', 'token-abc');
    expect(script).toContain('window.__DAUB_CONFIG__');
  });

  it('includes position', () => {
    const script = generateBootstrapScript({ ...defaultOpts, position: 'top-left' }, '/', 't');
    expect(script).toContain('"position":"top-left"');
  });

  it('includes outputDir', () => {
    const script = generateBootstrapScript({ ...defaultOpts, outputDir: '.custom-out' }, '/', 't');
    expect(script).toContain('"outputDir":".custom-out"');
  });

  it('includes projectRoot', () => {
    const script = generateBootstrapScript(defaultOpts, '/Users/me/project', 't');
    expect(script).toContain('"projectRoot":"/Users/me/project"');
  });

  it('includes token', () => {
    const script = generateBootstrapScript(defaultOpts, '/', 'my-secret-token');
    expect(script).toContain('"token":"my-secret-token"');
  });

  it('includes shortcut', () => {
    const script = generateBootstrapScript({ ...defaultOpts, shortcut: 'Ctrl+Shift+D' }, '/', 't');
    expect(script).toContain('"shortcut":"Ctrl+Shift+D"');
  });

  it('hardcodes writeEndpoint to /daub-write', () => {
    const script = generateBootstrapScript(defaultOpts, '/', 't');
    expect(script).toContain('"writeEndpoint":"/daub-write"');
  });

  it('includes modifyGitignore', () => {
    const script = generateBootstrapScript({ ...defaultOpts, modifyGitignore: false }, '/', 't');
    expect(script).toContain('"modifyGitignore":false');
  });

  it('produces valid JSON inside assignment', () => {
    const script = generateBootstrapScript(defaultOpts, '/root', 'tok');
    const json = script.replace('window.__DAUB_CONFIG__ = ', '').replace(/;$/, '');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('generateMountScript', () => {
  it('imports mountDaub from virtual module', () => {
    const script = generateMountScript();
    expect(script).toContain("import { mountDaub } from '/@daub/overlay'");
  });

  it('calls mountDaub with config', () => {
    const script = generateMountScript();
    expect(script).toContain('mountDaub(window.__DAUB_CONFIG__)');
  });
});
