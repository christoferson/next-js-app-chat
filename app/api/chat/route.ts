import {
  ConverseStreamCommand,
  type ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockClientFor, defaultRegion } from '@/lib/bedrock/client';
import {
  adaptConverseStream,
  buildConverseRequest,
  mapBedrockError,
  type ChatStreamEvent,
} from '@/lib/bedrock/converse';
import {
  chatRequestSchema,
  getModelDefinition,
  validateParameters,
} from '@/lib/models/validate';
import { getCurrentUser } from '@/lib/auth/current-user';
import { metricsSink } from '@/lib/metrics/metrics-sink';

export const runtime = 'nodejs';

const encoder = new TextEncoder();

function ndjson(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event) + '\n');
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * POST /api/chat — body: { modelId, system?, parameters?, messages[] }.
 * Response: NDJSON stream of ChatStreamEvent lines
 * (delta / stop / metadata / error).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'InvalidJSON', 'Request body must be JSON.');
  }

  const parsedBody = chatRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return errorResponse(
      400,
      'InvalidRequest',
      parsedBody.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
    );
  }
  const { modelId, system, parameters, messages } = parsedBody.data;

  const definition = getModelDefinition(modelId);
  if (!definition) {
    return errorResponse(400, 'UnknownModel', `Unknown modelId: ${modelId}`);
  }

  const validated = validateParameters(definition, parameters);
  if (!validated.ok) {
    return errorResponse(400, 'InvalidParameters', validated.error!);
  }

  const converseRequest = buildConverseRequest(
    definition,
    messages,
    validated.parameters!,
    system
  );
  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[chat] outgoing Converse request:',
      JSON.stringify(
        { ...converseRequest, messages: `<${messages.length} messages>` },
        null,
        2
      )
    );
  }

  const region = definition.region ?? defaultRegion();
  const client = bedrockClientFor(region);

  let converseStream: AsyncIterable<ConverseStreamOutput>;
  try {
    const response = await client.send(
      new ConverseStreamCommand(converseRequest),
      { abortSignal: request.signal }
    );
    if (!response.stream) {
      return errorResponse(502, 'NoStream', 'Bedrock returned no stream.');
    }
    converseStream = response.stream;
  } catch (err) {
    const mapped = mapBedrockError(err);
    return errorResponse(502, mapped.code, mapped.message);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of adaptConverseStream(converseStream)) {
          controller.enqueue(ndjson(event));
          if (event.type === 'metadata' && event.usage) {
            metricsSink.record({
              userId: user.id,
              modelId,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              totalTokens: event.usage.totalTokens,
              latencyMs: event.latencyMs,
            });
          }
        }
      } catch (err) {
        // Client abort surfaces here; anything else becomes an error event.
        if ((err as { name?: string })?.name !== 'AbortError') {
          const mapped = mapBedrockError(err);
          try {
            controller.enqueue(
              ndjson({ type: 'error', code: mapped.code, message: mapped.message })
            );
          } catch {
            // controller already closed
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Browser aborted the fetch; the abortSignal passed to Bedrock
      // terminates the upstream stream.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
