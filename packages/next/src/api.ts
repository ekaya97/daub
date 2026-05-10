// Pages Router API route handler for disk writes.
// Usage: export { daubWriteHandler as default } from '@daub/next/api';

import type { NextApiRequest, NextApiResponse } from 'next';
import { writeSessionToDisk, ensureGitignore } from '@daub/core';
import path from 'node:path';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export async function daubWriteHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const outputDir = path.resolve(process.cwd(), req.body.outputDir ?? '.daub-output');
    const sessionDir = await writeSessionToDisk(outputDir, req.body);
    await ensureGitignore(outputDir, true);
    return res.status(200).json({ ok: true, path: sessionDir });
  } catch (e: any) {
    const status = e.message?.includes('Invalid') ? 400 : 500;
    return res.status(status).json({ error: e.message ?? String(e) });
  }
}
