import 'server-only';
import type {
  ContentBlock,
  ConverseStreamCommandInput,
  ConverseStreamOutput,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import type { ModelDefinition } from '@/lib/models/types';
import type { ValidatedParameters } from '@/lib/models/validate';

export type { ChatMessage, ChatStreamEvent } from '@/lib/chat/protocol';
import type { ChatMessage, ChatStreamEvent } from '@/lib/chat/protocol';

function setNested(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor[key] = cursor[key] ?? {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

const CACHE_POINT = { cachePoint: { type: 'default' as const } };

/**
 * Route each validated parameter to inferenceConfig or
 * additionalModelRequestFields per its registry spec (target/fieldName).
 * Params absent from the model's inference map never reach this function.
 *
 * Prompt caching (aws/docs/bedrock-runtime/prompt-caching.md): when enabled
 * AND the registry declares promptCaching, cachePoint blocks are appended to
 * the sections the model supports — end of system, end of the latest user
 * message. Anthropic's simplified cache management looks back ~20 content
 * blocks from a checkpoint, so this single moving checkpoint per section
 * yields hits on each successive turn. Below the model's min token count the
 * request still succeeds (prefix simply isn't cached), so this is always safe.
 */
export function buildConverseRequest(
  definition: ModelDefinition,
  messages: ChatMessage[],
  parameters: ValidatedParameters,
  system?: string,
  options?: { cache?: boolean }
): ConverseStreamCommandInput {
  const caching = options?.cache
    ? definition.capabilities.promptCaching
    : undefined;
  const inferenceConfig: Record<string, unknown> = {};
  const additionalFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    const spec =
      definition.capabilities.inference[
        key as keyof typeof definition.capabilities.inference
      ];
    if (!spec || value === undefined || value === null) continue;
    const wireName = spec.fieldName ?? key;
    if (spec.target === 'inferenceConfig') {
      inferenceConfig[wireName] = value;
    } else {
      setNested(additionalFields, wireName, value);
    }
  }

  const lastUserIndex = messages.reduce(
    (acc, m, i) => (m.role === 'user' ? i : acc),
    -1
  );
  const cacheMessages = caching?.fields.includes('messages') ?? false;

  const request: ConverseStreamCommandInput = {
    modelId: definition.modelId,
    messages: messages.map((m, i): Message => {
      const content = m.content.map((c): ContentBlock => ({ text: c.text }));
      if (cacheMessages && i === lastUserIndex) {
        content.push(CACHE_POINT);
      }
      return { role: m.role, content };
    }),
  };
  if (Object.keys(inferenceConfig).length > 0) {
    request.inferenceConfig = inferenceConfig;
  }
  if (Object.keys(additionalFields).length > 0) {
    request.additionalModelRequestFields = additionalFields as never;
  }
  if (system && definition.capabilities.features.systemPrompt) {
    request.system = caching?.fields.includes('system')
      ? [{ text: system }, CACHE_POINT]
      : [{ text: system }];
  }
  return request;
}

const STREAM_EXCEPTION_KEYS = [
  'internalServerException',
  'modelStreamErrorException',
  'serviceUnavailableException',
  'throttlingException',
  'validationException',
] as const;

const STREAM_EXCEPTION_MESSAGES: Record<string, string> = {
  internalServerException: 'Bedrock internal error — try again.',
  modelStreamErrorException: 'The model stream failed — try again.',
  serviceUnavailableException: 'Bedrock is temporarily unavailable — retry shortly.',
  throttlingException: 'Request throttled — wait a moment and retry.',
  validationException: 'The request was rejected by Bedrock validation.',
};

/**
 * Defensive adapter: Bedrock stream events → ChatStreamEvent.
 * - contentBlockDelta is a union; delta.text may be absent (reasoning/tool
 *   deltas) — those are skipped, never crash.
 * - in-stream exception events map to a structured error event.
 * - stopReason is passed through as an open string (SDK enum omits e.g.
 *   Anthropic's "refusal").
 */
export async function* adaptConverseStream(
  stream: AsyncIterable<ConverseStreamOutput>
): AsyncGenerator<ChatStreamEvent> {
  for await (const event of stream) {
    if (event.contentBlockDelta) {
      const text = event.contentBlockDelta.delta?.text;
      if (typeof text === 'string' && text.length > 0) {
        yield { type: 'delta', text };
      }
      continue;
    }
    if (event.messageStop) {
      yield {
        type: 'stop',
        stopReason: event.messageStop.stopReason ?? 'unknown',
      };
      continue;
    }
    if (event.metadata) {
      yield {
        type: 'metadata',
        usage: event.metadata.usage
          ? {
              inputTokens: event.metadata.usage.inputTokens,
              outputTokens: event.metadata.usage.outputTokens,
              totalTokens: event.metadata.usage.totalTokens,
              cacheReadInputTokens: event.metadata.usage.cacheReadInputTokens,
              cacheWriteInputTokens:
                event.metadata.usage.cacheWriteInputTokens,
            }
          : undefined,
        latencyMs: event.metadata.metrics?.latencyMs,
      };
      continue;
    }
    for (const key of STREAM_EXCEPTION_KEYS) {
      if (event[key]) {
        yield {
          type: 'error',
          code: key,
          message:
            (event[key] as { message?: string }).message ??
            STREAM_EXCEPTION_MESSAGES[key],
        };
        return;
      }
    }
    // messageStart / contentBlockStart / contentBlockStop / unknown: ignored
  }
}

/** Map request-level SDK errors to a user-readable structured error. */
export function mapBedrockError(err: unknown): { code: string; message: string } {
  const name = (err as { name?: string })?.name ?? 'UnknownError';
  const raw = (err as { message?: string })?.message;
  switch (name) {
    case 'AccessDeniedException':
      return {
        code: name,
        message:
          'Access denied — enable model access for this model in the Bedrock console, and check your AWS credentials.',
      };
    case 'ThrottlingException':
    case 'ModelNotReadyException':
      return { code: name, message: 'Request throttled — retry shortly.' };
    case 'ValidationException':
      return { code: name, message: raw ?? 'Request failed Bedrock validation.' };
    case 'ResourceNotFoundException':
      return {
        code: name,
        message: 'Model not found — it may not be available in this region.',
      };
    case 'ModelTimeoutException':
      return { code: name, message: 'The model timed out — try again.' };
    case 'ServiceUnavailableException':
    case 'InternalServerException':
    case 'ModelErrorException':
      return { code: name, message: 'Bedrock service error — try again.' };
    case 'CredentialsProviderError':
    case 'ExpiredTokenException':
    case 'ExpiredToken':
      return {
        code: name,
        message:
          'AWS credentials missing or expired — run `aws sso login` (AWS_PROFILE) and retry.',
      };
    default:
      return { code: name, message: raw ?? 'Unexpected error calling Bedrock.' };
  }
}
