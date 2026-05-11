import { describe, it, expect, vi } from 'vitest';
import daub from '../index.js';

// Mock readFileSync so load() doesn't need the actual overlay.js file
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('// overlay mock'),
  };
});

describe('daub() plugin', () => {
  it('returns a plugin object', () => {
    const plugin = daub();
    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
  });

  it('has correct name', () => {
    const plugin = daub();
    expect(plugin.name).toBe('vite-plugin-daub');
  });

  it('applies only in serve mode', () => {
    const plugin = daub();
    expect(plugin.apply).toBe('serve');
  });

  it('enforces post', () => {
    const plugin = daub();
    expect(plugin.enforce).toBe('post');
  });

  it('has resolveId hook', () => {
    const plugin = daub();
    expect(typeof plugin.resolveId).toBe('function');
  });

  it('resolves virtual module ID', () => {
    const plugin = daub();
    const resolved = (plugin.resolveId as Function)('/@daub/overlay');
    expect(resolved).toBe('\0/@daub/overlay');
  });

  it('ignores non-daub module IDs', () => {
    const plugin = daub();
    const resolved = (plugin.resolveId as Function)('react');
    expect(resolved).toBeUndefined();
  });

  it('has load hook', () => {
    const plugin = daub();
    expect(typeof plugin.load).toBe('function');
  });

  it('loads overlay for resolved virtual ID', () => {
    const plugin = daub();
    const result = (plugin.load as Function)('\0/@daub/overlay');
    expect(result).toBe('// overlay mock');
  });

  it('ignores non-virtual IDs in load', () => {
    const plugin = daub();
    const result = (plugin.load as Function)('some-other-id');
    expect(result).toBeUndefined();
  });

  describe('transformIndexHtml', () => {
    it('returns two script tags when enabled', () => {
      const plugin = daub();
      const tags = (plugin.transformIndexHtml as Function)();
      expect(tags).toHaveLength(2);
    });

    it('first tag is config script in head', () => {
      const plugin = daub();
      const tags = (plugin.transformIndexHtml as Function)();
      expect(tags[0].tag).toBe('script');
      expect(tags[0].injectTo).toBe('head');
      expect(tags[0].children).toContain('__DAUB_CONFIG__');
    });

    it('second tag is module script in body', () => {
      const plugin = daub();
      const tags = (plugin.transformIndexHtml as Function)();
      expect(tags[1].tag).toBe('script');
      expect(tags[1].attrs.type).toBe('module');
      expect(tags[1].injectTo).toBe('body');
      expect(tags[1].children).toContain('mountDaub');
    });

    it('returns empty when disabled', () => {
      const plugin = daub({ enabled: false });
      const tags = (plugin.transformIndexHtml as Function)();
      expect(tags).toEqual([]);
    });
  });
});
