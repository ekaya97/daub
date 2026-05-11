import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withDaub } from '../index.js';

describe('withDaub', () => {
  it('returns a config object with webpack function', () => {
    const result = withDaub({});
    expect(result).toBeDefined();
    expect(typeof result.webpack).toBe('function');
  });

  it('returns original config when disabled', () => {
    const original = { reactStrictMode: true };
    const result = withDaub(original, { enabled: false });
    expect(result).toBe(original);
  });

  it('preserves existing config properties', () => {
    const result = withDaub({ reactStrictMode: true, images: { domains: ['cdn.example.com'] } });
    expect(result.reactStrictMode).toBe(true);
    expect(result.images.domains).toEqual(['cdn.example.com']);
  });

  it('preserves existing webpack function', () => {
    const existingWebpack = vi.fn().mockImplementation((config) => config);
    const result = withDaub({ webpack: existingWebpack });

    const mockConfig = { entry: async () => ({}), plugins: [] };
    const context = { dev: true, isServer: false, webpack: { DefinePlugin: vi.fn() } };
    result.webpack(mockConfig, context);

    expect(existingWebpack).toHaveBeenCalled();
  });

  it('detects Turbopack and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = withDaub({});

    const mockConfig = { entry: async () => ({}), plugins: [] };
    // Turbopack: context.webpack is undefined
    const context = { dev: true, isServer: false };
    result.webpack(mockConfig, context);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Turbopack'));
    warnSpy.mockRestore();
  });

  it('skips injection for server-side', () => {
    const result = withDaub({});
    const mockConfig = { entry: async () => ({}), plugins: [] };
    const context = { dev: true, isServer: true, webpack: { DefinePlugin: vi.fn() } };

    const returned = result.webpack(mockConfig, context);
    // Plugins should not be modified for server
    expect(mockConfig.plugins).toHaveLength(0);
  });

  it('skips injection for production', () => {
    const result = withDaub({});
    const mockConfig = { entry: async () => ({}), plugins: [] };
    const context = { dev: false, isServer: false, webpack: { DefinePlugin: vi.fn() } };

    result.webpack(mockConfig, context);
    expect(mockConfig.plugins).toHaveLength(0);
  });

  it('adds DefinePlugin in dev client context', () => {
    const MockDefinePlugin = vi.fn();
    const result = withDaub({});

    const mockConfig = { entry: async () => ({ 'main-app': ['existing.js'] }), plugins: [] };
    const context = { dev: true, isServer: false, webpack: { DefinePlugin: MockDefinePlugin } };
    result.webpack(mockConfig, context);

    expect(MockDefinePlugin).toHaveBeenCalledTimes(1);
    const defineArg = MockDefinePlugin.mock.calls[0][0];
    expect(defineArg).toHaveProperty('globalThis.__DAUB_CONFIG_JSON__');
  });

  it('config JSON contains expected fields', () => {
    const MockDefinePlugin = vi.fn();
    const result = withDaub({}, { position: 'top-left', shortcut: 'Ctrl+D' });

    const mockConfig = { entry: async () => ({}), plugins: [] };
    const context = { dev: true, isServer: false, webpack: { DefinePlugin: MockDefinePlugin } };
    result.webpack(mockConfig, context);

    const defineArg = MockDefinePlugin.mock.calls[0][0];
    const configJson = JSON.parse(JSON.parse(defineArg['globalThis.__DAUB_CONFIG_JSON__']));
    expect(configJson.position).toBe('top-left');
    expect(configJson.shortcut).toBe('Ctrl+D');
    expect(configJson.writeEndpoint).toBe('/api/daub-write');
    expect(configJson.token).toBeTruthy();
    expect(configJson.projectRoot).toBeTruthy();
  });
});
