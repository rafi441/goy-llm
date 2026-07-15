import { indexDocument, extractText } from '@/lib/rag/index';
import { apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const file = form.get('file');
  const chatIdRaw = form.get('chatId');
  const chatId = typeof chatIdRaw === 'string' && chatIdRaw ? chatIdRaw : null;
  if (!(file instanceof File)) return apiError('No file', 400);
  if (file.size > MAX_BYTES) return apiError('File exceeds 20MB', 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = extractText(file.name, buffer);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const progress of indexDocument(chatId, file.name, content)) {
          controller.enqueue(sse(progress));
          if (progress.stage === 'error') break;
        }
      } catch (e) {
        controller.enqueue(
          sse({ stage: 'error', message: e instanceof Error ? e.message : 'Indexing failed' }),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
