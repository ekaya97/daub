// App Router API route handler for disk writes.
// Usage in app/api/daub-write/route.ts:
//   export { POST } from '@daub/next/app-route';

import { writeSessionToDisk, ensureGitignore } from '@daub/core';
import path from 'node:path';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const outputDir = path.resolve(process.cwd(), body.outputDir ?? '.daub-output');
    const sessionDir = await writeSessionToDisk(outputDir, body);
    await ensureGitignore(outputDir, true);
    return Response.json({ ok: true, path: sessionDir });
  } catch (e: any) {
    const status = e.message?.includes('Invalid') ? 400 : 500;
    return Response.json({ error: e.message ?? String(e) }, { status });
  }
}
