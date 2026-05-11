import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeSessionToDisk, ensureGitignore } from '../write.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('writeSessionToDisk', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daub-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a text file with correct content', async () => {
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: { 'context.md': '# Hello' },
    });

    const filePath = path.join(result, 'context.md');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('# Hello');
  });

  it('writes a base64 image as binary', async () => {
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: { 'before.png': TINY_PNG },
    });

    const filePath = path.join(result, 'before.png');
    const stat = await fs.stat(filePath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('strips data URL prefix from base64 images', async () => {
    const dataUrl = `data:image/png;base64,${TINY_PNG}`;
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: { 'before.png': dataUrl },
    });

    const filePath = path.join(result, 'before.png');
    const written = await fs.readFile(filePath);
    const expected = Buffer.from(TINY_PNG, 'base64');
    expect(written).toEqual(expected);
  });

  it('throws on session ID with special characters', async () => {
    await expect(
      writeSessionToDisk(tmpDir, {
        sessionId: '../etc',
        files: { 'context.md': 'test' },
      }),
    ).rejects.toThrow('Invalid session ID');
  });

  it('throws on session ID longer than 64 characters', async () => {
    const longId = 'a'.repeat(65);
    await expect(
      writeSessionToDisk(tmpDir, {
        sessionId: longId,
        files: { 'context.md': 'test' },
      }),
    ).rejects.toThrow('Invalid session ID');
  });

  it('throws on empty session ID', async () => {
    await expect(
      writeSessionToDisk(tmpDir, {
        sessionId: '',
        files: { 'context.md': 'test' },
      }),
    ).rejects.toThrow('Invalid session ID');
  });

  it('accepts valid session ID formats', async () => {
    for (const id of ['abc-123', 'ABC_def', 'a1b2c3']) {
      await expect(
        writeSessionToDisk(tmpDir, {
          sessionId: id,
          files: { 'context.md': 'ok' },
        }),
      ).resolves.toBeDefined();
    }
  });

  it('throws on unexpected filename', async () => {
    await expect(
      writeSessionToDisk(tmpDir, {
        sessionId: 'abc123',
        files: { 'evil.sh': 'bad' },
      }),
    ).rejects.toThrow('Unexpected file');
  });

  it('accepts all allowed filenames', async () => {
    const allowed = [
      'before.png',
      'after.png',
      'annotated.png',
      'context.md',
      'before.jpg',
      'after.jpg',
    ];
    for (const filename of allowed) {
      const content = filename.endsWith('.md') ? 'text' : TINY_PNG;
      await expect(
        writeSessionToDisk(tmpDir, {
          sessionId: `session-${filename.replace('.', '-')}`,
          files: { [filename]: content },
        }),
      ).resolves.toBeDefined();
    }
  });

  it('skips files with empty content', async () => {
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: { 'context.md': '' },
    });

    const entries = await fs.readdir(result);
    expect(entries).not.toContain('context.md');
  });

  it('writes multiple files', async () => {
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: {
        'before.jpg': TINY_PNG,
        'context.md': '# Notes',
      },
    });

    const entries = await fs.readdir(result);
    expect(entries).toContain('before.jpg');
    expect(entries).toContain('context.md');
  });

  it('returns the session directory as an absolute path', async () => {
    const result = await writeSessionToDisk(tmpDir, {
      sessionId: 'abc123',
      files: { 'context.md': 'hi' },
    });

    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.join(tmpDir, 'abc123'));
  });

  it('creates nested directories when outputDir does not exist', async () => {
    const nested = path.join(tmpDir, 'deep', 'nested', 'output');
    const result = await writeSessionToDisk(nested, {
      sessionId: 'abc123',
      files: { 'context.md': 'content' },
    });

    const content = await fs.readFile(path.join(result, 'context.md'), 'utf-8');
    expect(content).toBe('content');
  });
});

describe('ensureGitignore', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daub-gitignore-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .gitignore with entry when none exists and modify=true', async () => {
    await ensureGitignore('daub-output', true);

    const content = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toContain('daub-output/');
  });

  it('does not create .gitignore when none exists and modify=false', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureGitignore('daub-output', false);

    const exists = await fs.access(path.join(tmpDir, '.gitignore')).then(
      () => true,
      () => false,
    );
    expect(exists).toBe(false);

    warnSpy.mockRestore();
  });

  it('appends entry when .gitignore exists without it and modify=true', async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), 'node_modules/\n');

    await ensureGitignore('daub-output', true);

    const content = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('daub-output/');
  });

  it('does not modify .gitignore when entry already exists', async () => {
    const original = 'node_modules/\ndaub-output/\n';
    await fs.writeFile(path.join(tmpDir, '.gitignore'), original);

    await ensureGitignore('daub-output', true);

    const content = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toBe(original);
  });
});
