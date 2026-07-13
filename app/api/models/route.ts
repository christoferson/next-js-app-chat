import { MODEL_REGISTRY } from '@/lib/models/registry';
import { defaultRegion } from '@/lib/bedrock/client';

export const runtime = 'nodejs';

/**
 * GET /api/models — registry (client-safe fields) for the model selector,
 * parameter panel, and feature badges. The registry holds no secrets, so the
 * definitions are returned as-is, plus the resolved region per model.
 */
export async function GET() {
  const models = MODEL_REGISTRY.map((m) => ({
    ...m,
    resolvedRegion: m.region ?? defaultRegion(),
  }));
  return Response.json({
    models,
    defaults: {
      modelId:
        process.env.DEFAULT_MODEL_ID ?? models[0]?.modelId ?? '',
      systemPrompt:
        process.env.DEFAULT_SYSTEM_PROMPT ?? 'You are a helpful assistant.',
    },
  });
}
