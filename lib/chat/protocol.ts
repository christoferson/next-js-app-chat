// Shared client/server types for the /api/chat NDJSON stream and /api/models.
// No server-only imports here — the browser bundles this module.

import type { ModelDefinition } from '@/lib/models/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: { text: string }[];
}

/** Events streamed to the browser as NDJSON lines. */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'stop'; stopReason: string }
  | {
      type: 'metadata';
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      latencyMs?: number;
    }
  | { type: 'error'; code: string; message: string };

export type ClientModel = ModelDefinition & { resolvedRegion: string };

export interface ModelsResponse {
  models: ClientModel[];
  defaults: { modelId: string; systemPrompt: string };
}
