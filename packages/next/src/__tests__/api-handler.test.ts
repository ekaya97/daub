import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @daub/core write functions
vi.mock('@daub/core', () => ({
  writeSessionToDisk: vi.fn().mockResolvedValue('/tmp/test/abc123'),
  ensureGitignore: vi.fn().mockResolvedValue(undefined),
}));

import { daubWriteHandler } from '../api.js';
import { POST } from '../app-route.js';
import { writeSessionToDisk, ensureGitignore } from '@daub/core';

// ---------------------------------------------------------------------------
// Pages Router: daubWriteHandler
// ---------------------------------------------------------------------------

describe('daubWriteHandler (Pages Router)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockReq(method: string, body?: any): any {
    return { method, body: body ?? {} };
  }

  function mockRes(): any {
    const res: any = {
      statusCode: 0,
      body: null,
      status(code: number) { res.statusCode = code; return res; },
      json(data: any) { res.body = data; return res; },
    };
    return res;
  }

  it('rejects non-POST with 405', async () => {
    const res = mockRes();
    await daubWriteHandler(mockReq('GET'), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('Method not allowed');
  });

  it('calls writeSessionToDisk on valid POST', async () => {
    const body = { sessionId: 'abc123', files: { 'context.md': '# Test' } };
    const res = mockRes();
    await daubWriteHandler(mockReq('POST', body), res);

    expect(writeSessionToDisk).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('calls ensureGitignore', async () => {
    const body = { sessionId: 'abc123', files: { 'context.md': '# Test' } };
    const res = mockRes();
    await daubWriteHandler(mockReq('POST', body), res);

    expect(ensureGitignore).toHaveBeenCalled();
  });

  it('uses default outputDir when not specified', async () => {
    const body = { sessionId: 'abc123', files: { 'context.md': '# Test' } };
    const res = mockRes();
    await daubWriteHandler(mockReq('POST', body), res);

    const callArgs = (writeSessionToDisk as any).mock.calls[0];
    expect(callArgs[0]).toContain('.daub-output');
  });

  it('returns 400 on Invalid error', async () => {
    (writeSessionToDisk as any).mockRejectedValueOnce(new Error('Invalid session ID'));
    const res = mockRes();
    await daubWriteHandler(mockReq('POST', { sessionId: 'bad', files: {} }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 on generic error', async () => {
    (writeSessionToDisk as any).mockRejectedValueOnce(new Error('Disk full'));
    const res = mockRes();
    await daubWriteHandler(mockReq('POST', { sessionId: 'abc', files: {} }), res);

    expect(res.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// App Router: POST
// ---------------------------------------------------------------------------

describe('POST (App Router)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (writeSessionToDisk as any).mockResolvedValue('/tmp/test/abc123');
  });

  it('returns 200 on valid request', async () => {
    const body = { sessionId: 'abc123', files: { 'context.md': '# Test' } };
    const request = new Request('http://localhost/api/daub-write', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 400 on Invalid error', async () => {
    (writeSessionToDisk as any).mockRejectedValueOnce(new Error('Invalid session ID'));
    const request = new Request('http://localhost/api/daub-write', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'bad', files: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 500 on generic error', async () => {
    (writeSessionToDisk as any).mockRejectedValueOnce(new Error('Disk full'));
    const request = new Request('http://localhost/api/daub-write', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', files: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('uses default outputDir', async () => {
    const body = { sessionId: 'abc123', files: { 'context.md': '# Test' } };
    const request = new Request('http://localhost/api/daub-write', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    await POST(request);
    const callArgs = (writeSessionToDisk as any).mock.calls[0];
    expect(callArgs[0]).toContain('.daub-output');
  });
});
