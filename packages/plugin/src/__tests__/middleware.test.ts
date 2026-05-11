import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

vi.mock('@daub/core', () => ({
  writeSessionToDisk: vi.fn().mockResolvedValue('/tmp/session'),
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

import { handleDaubWrite } from '../middleware';
import { writeSessionToDisk, ensureGitignore } from '@daub/core';

function createMockReq(options: {
  method?: string;
  remoteAddress?: string;
  headers?: Record<string, string>;
  body?: any;
}): any {
  const readable = new Readable();
  readable.push(options.body ? JSON.stringify(options.body) : null);
  readable.push(null);
  return Object.assign(readable, {
    method: options.method ?? 'POST',
    headers: {
      'content-length': '100',
      'x-daub-token': 'test-token',
      ...options.headers,
    },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
  });
}

function createMockRes(): any {
  const res: any = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code: number, headers?: any) {
      res.statusCode = code;
      res.headers = headers ?? {};
      return res;
    },
    end(data?: string) {
      res.body = data ?? '';
    },
  };
  return res;
}

const OUTPUT_DIR = '/tmp/test';
const TOKEN = 'test-token';
const MODIFY_GITIGNORE = true;

describe('handleDaubWrite', () => {
  let handler: ReturnType<typeof handleDaubWrite>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = handleDaubWrite(OUTPUT_DIR, TOKEN, MODIFY_GITIGNORE);
  });

  describe('security checks', () => {
    it('should call next() for non-POST requests', async () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(0);
    });

    it('should return 403 for non-loopback address', async () => {
      const req = createMockReq({ remoteAddress: '192.168.1.1' });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow IPv4 loopback (127.0.0.1)', async () => {
      const req = createMockReq({
        remoteAddress: '127.0.0.1',
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).not.toBe(403);
    });

    it('should allow IPv6 loopback (::1)', async () => {
      const req = createMockReq({
        remoteAddress: '::1',
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).not.toBe(403);
    });

    it('should allow IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)', async () => {
      const req = createMockReq({
        remoteAddress: '::ffff:127.0.0.1',
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).not.toBe(403);
    });

    it('should return 403 when remoteAddress is undefined', async () => {
      const req = createMockReq({ remoteAddress: undefined as any });
      // Manually set remoteAddress to undefined (createMockReq defaults to 127.0.0.1)
      req.socket.remoteAddress = undefined;
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    });

    it('should return 403 for wrong CSRF token', async () => {
      const req = createMockReq({
        headers: { 'x-daub-token': 'wrong-token' },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Invalid token' });
    });

    it('should return 403 when CSRF token header is missing', async () => {
      const req = createMockReq({ headers: {} });
      // Remove the default token header
      delete req.headers['x-daub-token'];
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Invalid token' });
    });

    it('should continue when CSRF token is correct', async () => {
      const req = createMockReq({
        headers: { 'x-daub-token': 'test-token' },
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).not.toBe(403);
    });

    it('should return 413 when Content-Length exceeds 50MB', async () => {
      const oversized = String(50 * 1024 * 1024 + 1);
      const req = createMockReq({
        headers: { 'content-length': oversized, 'x-daub-token': 'test-token' },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(413);
      expect(JSON.parse(res.body)).toEqual({ error: 'Payload too large' });
    });

    it('should continue when Content-Length is within limit', async () => {
      const req = createMockReq({
        headers: { 'content-length': '1024', 'x-daub-token': 'test-token' },
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).not.toBe(413);
    });
  });

  describe('happy path', () => {
    it('should call writeSessionToDisk and ensureGitignore, then return 200', async () => {
      const body = { sessionId: 'abc123', events: [{ type: 'click' }] };
      const req = createMockReq({ body });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(writeSessionToDisk).toHaveBeenCalledWith(OUTPUT_DIR, body);
      expect(ensureGitignore).toHaveBeenCalledWith(OUTPUT_DIR, MODIFY_GITIGNORE);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true, path: '/tmp/session' });
    });

    it('should return 400 when writeSessionToDisk throws "Invalid session ID"', async () => {
      vi.mocked(writeSessionToDisk).mockRejectedValueOnce(
        new Error('Invalid session ID'),
      );

      const req = createMockReq({
        body: { sessionId: '', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body)).toEqual({ error: 'Invalid session ID' });
    });

    it('should return 500 when writeSessionToDisk throws a generic error', async () => {
      vi.mocked(writeSessionToDisk).mockRejectedValueOnce(
        new Error('Disk full'),
      );

      const req = createMockReq({
        body: { sessionId: 'test', events: [] },
      });
      const res = createMockRes();
      const next = vi.fn();

      await handler(req, res, next);

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'Disk full' });
    });
  });
});
