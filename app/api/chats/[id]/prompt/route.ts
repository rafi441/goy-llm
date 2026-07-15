import { assemblePrompt } from '@/lib/prompt/assemble';
import { json, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const directiveRaw = new URL(req.url).searchParams.get('directive');
    const assembled = await assemblePrompt(id, {
      directive: directiveRaw ? { content: directiveRaw } : null,
    });
    return json({
      messages: assembled.built.messages,
      blocks: assembled.built.blocks,
      totalTokens: assembled.built.totalTokens,
      budget: assembled.built.budget,
      truncatedAt: assembled.built.truncatedAt,
      activeLorebookEntries: assembled.built.activeLorebookEntries,
      connectionId: assembled.connectionId,
      modelId: assembled.modelId,
      genConfig: assembled.genConfig,
    });
  } catch (e) {
    return handleError(e);
  }
}
