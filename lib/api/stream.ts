import 'server-only';
import type { AssembledPrompt } from '../prompt/assemble';
import { getConnection, getDecryptedKey } from '../db/repos/connections';
import { markModelUsed } from '../db/repos/models';
import { getProvider, ProviderError } from '../providers';

export interface FinalizeResult {
  messageId: string;
  swipeIndex: number;
}

export interface StreamChatOptions {
  assembled: AssembledPrompt;
  signal: AbortSignal;
  seedText?: string;
  finalize: (fullText: string, aborted: boolean) => FinalizeResult;
}

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export function streamChat(opts: StreamChatOptions): Response {
  const { assembled, signal } = opts;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!assembled.connectionId || !assembled.modelId) {
        controller.enqueue(sse({ error: 'This chat has no model. Pick a model first.' }));
        controller.close();
        return;
      }
      const connection = getConnection(assembled.connectionId);
      if (!connection) {
        controller.enqueue(sse({ error: 'Connection unavailable. Pick a replacement model.' }));
        controller.close();
        return;
      }

      const provider = getProvider(connection.type, connection.base_url, getDecryptedKey(connection.id));
      markModelUsed(assembled.connectionId, assembled.modelId);

      let full = opts.seedText ?? '';
      let aborted = false;

      try {
        const iterator = provider.chat({
          model: assembled.modelId,
          messages: assembled.built.messages,
          config: assembled.genConfig,
          signal,
        });
        for await (const chunk of iterator) {
          if (signal.aborted) {
            aborted = true;
            break;
          }
          if (chunk.delta) {
            full += chunk.delta;
            controller.enqueue(sse({ delta: chunk.delta }));
          }
          if (chunk.done) break;
        }
      } catch (e) {
        if (signal.aborted || (e instanceof ProviderError && e.code === 'ABORTED')) {
          aborted = true;
        } else {
          const message = e instanceof Error ? e.message : 'Generation failed';
          const result = opts.finalize(full, true);
          controller.enqueue(sse({ error: message, messageId: result.messageId }));
          controller.close();
          return;
        }
      }

      const result = opts.finalize(full, aborted);
      controller.enqueue(
        sse({ done: true, aborted, messageId: result.messageId, swipeIndex: result.swipeIndex }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
