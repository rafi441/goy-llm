import { importCardFile, type ImportResult } from '@/lib/cards/import';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return apiError('No files', 400);

  const results: ImportResult[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      results.push({ ok: false, filename: file.name, error: 'Melebihi 10MB' });
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    results.push(importCardFile(file.name, buffer));
  }

  const succeeded = results.filter((r) => r.ok).length;
  return json({
    results,
    summary: { total: results.length, succeeded, failed: results.length - succeeded },
  });
}
