import type { Connect } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

const SESSION_ID_RE = /^[a-z0-9_-]{1,64}$/i;
const ALLOWED_FILES = new Set(['before.png', 'after.png', 'annotated.png', 'context.md',
  'before.jpg', 'after.jpg', 'annotated.jpg']);

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  return LOOPBACK.has(addr);
}

interface WritePayload {
  sessionId: string;
  files: Record<string, string>;
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

    // Security: loopback only
    if (!isLoopback(req.socket.remoteAddress)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    // Security: CSRF token
    if (req.headers['x-daub-token'] !== token) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return;
    }

    // Size limit: 50MB
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > 50 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }

    try {
      const body = await parseBody(req);

      // Validate session ID
      if (!SESSION_ID_RE.test(body.sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid session ID' }));
        return;
      }

      // Validate filenames
      for (const filename of Object.keys(body.files)) {
        if (!ALLOWED_FILES.has(filename)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unexpected file: ${filename}` }));
          return;
        }
      }

      const outputBase = path.resolve(process.cwd(), outputDir);
      const sessionDir = path.resolve(outputBase, body.sessionId);

      // Path traversal check
      if (!sessionDir.startsWith(outputBase + path.sep) && sessionDir !== outputBase) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid path' }));
        return;
      }

      await fs.mkdir(sessionDir, { recursive: true });

      for (const [filename, content] of Object.entries(body.files)) {
        if (!content) continue;
        const filePath = path.join(sessionDir, filename);

        if (filename.endsWith('.png') || filename.endsWith('.jpg')) {
          const raw = content.replace(/^data:image\/\w+;base64,/, '');
          await fs.writeFile(filePath, Buffer.from(raw, 'base64'));
        } else {
          await fs.writeFile(filePath, content, 'utf-8');
        }
      }

      await ensureGitignore(outputDir, modifyGitignore);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: sessionDir }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
  };
}

async function ensureGitignore(outputDir: string, modify: boolean): Promise<void> {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (content.includes(outputDir)) return;

    if (modify) {
      await fs.appendFile(gitignorePath, `\n# Daub output\n${outputDir}/\n`);
      console.log(`[Daub] Added ${outputDir}/ to .gitignore`);
    } else {
      console.warn(`[Daub] Remember to add ${outputDir}/ to your .gitignore`);
    }
  } catch {
    if (modify) {
      await fs.writeFile(gitignorePath, `# Daub output\n${outputDir}/\n`);
      console.log(`[Daub] Created .gitignore with ${outputDir}/`);
    } else {
      console.warn(`[Daub] Remember to add ${outputDir}/ to your .gitignore`);
    }
  }
}
