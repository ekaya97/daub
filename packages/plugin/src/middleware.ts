import type { Connect } from 'vite';
import type { WritePayload } from '@daub/core';
import { writeSessionToDisk, ensureGitignore } from '@daub/core';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  return LOOPBACK.has(addr);
}

function parseBody(req: Connect.IncomingMessage): Promise<WritePayload> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function handleDaubWrite(
  outputDir: string,
  token: string,
  modifyGitignore: boolean,
): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next();

    if (!isLoopback(req.socket.remoteAddress)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    if (req.headers['x-daub-token'] !== token) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return;
    }

    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > 50 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }

    try {
      const body = await parseBody(req);
      const sessionDir = await writeSessionToDisk(outputDir, body);
      await ensureGitignore(outputDir, modifyGitignore);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: sessionDir }));
    } catch (e: any) {
      const status = e.message?.includes('Invalid') ? 400 : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message ?? String(e) }));
    }
  };
}
