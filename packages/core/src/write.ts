import fs from 'node:fs/promises';
import path from 'node:path';

const SESSION_ID_RE = /^[a-z0-9_-]{1,64}$/i;
const ALLOWED_FILES = new Set([
  'before.png', 'after.png', 'annotated.png', 'context.md',
  'before.jpg', 'after.jpg', 'annotated.jpg',
]);

export interface WritePayload {
  sessionId: string;
  files: Record<string, string>;
}

export async function writeSessionToDisk(
  outputDir: string,
  payload: WritePayload,
): Promise<string> {
  // Validate session ID
  if (!SESSION_ID_RE.test(payload.sessionId)) {
    throw new Error(`Invalid session ID: ${payload.sessionId}`);
  }

  // Validate filenames
  for (const filename of Object.keys(payload.files)) {
    if (!ALLOWED_FILES.has(filename)) {
      throw new Error(`Unexpected file: ${filename}`);
    }
  }

  const outputBase = path.resolve(outputDir);
  const sessionDir = path.resolve(outputBase, payload.sessionId);

  // Path traversal check
  if (!sessionDir.startsWith(outputBase + path.sep) && sessionDir !== outputBase) {
    throw new Error('Invalid path');
  }

  await fs.mkdir(sessionDir, { recursive: true });

  for (const [filename, content] of Object.entries(payload.files)) {
    if (!content) continue;
    const filePath = path.join(sessionDir, filename);

    if (filename.endsWith('.png') || filename.endsWith('.jpg')) {
      const raw = content.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(filePath, Buffer.from(raw, 'base64'));
    } else {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  return sessionDir;
}

export async function ensureGitignore(outputDir: string, modify: boolean): Promise<void> {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const dirName = path.basename(outputDir);

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (content.includes(dirName)) return;

    if (modify) {
      await fs.appendFile(gitignorePath, `\n# Daub output\n${dirName}/\n`);
      console.log(`[Daub] Added ${dirName}/ to .gitignore`);
    } else {
      console.warn(`[Daub] Remember to add ${dirName}/ to your .gitignore`);
    }
  } catch {
    if (modify) {
      await fs.writeFile(gitignorePath, `# Daub output\n${dirName}/\n`);
      console.log(`[Daub] Created .gitignore with ${dirName}/`);
    }
  }
}
