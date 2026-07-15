// Live probe: which registry models accept Converse cachePoint blocks and
// report cache usage? Run: npx tsx cache-probe.ts   (uses AWS_PROFILE creds)
// Two identical calls per model with a >4k-token system prefix + cachePoint:
// call 1 should show cacheWriteInputTokens > 0, call 2 cacheReadInputTokens > 0.
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const MODELS = [
  'global.anthropic.claude-sonnet-5',
  'global.anthropic.claude-fable-5',
  'global.anthropic.claude-opus-4-8',
  'global.anthropic.claude-opus-4-6-v1',
  'global.amazon.nova-2-lite-v1:0',
  'qwen.qwen3-next-80b-a3b',
  'openai.gpt-oss-safeguard-120b',
];

// ~5,000+ tokens of stable text (repeat a sentence; identical across calls).
const BIG_PREFIX = Array.from(
  { length: 420 },
  (_, i) =>
    `Rule ${i}: assistants should answer briefly, cite sources when available, avoid speculation, and keep formatting simple unless asked otherwise.`
).join(' ');

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

async function call(modelId: string) {
  const res = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: BIG_PREFIX }, { cachePoint: { type: 'default' } }],
      messages: [{ role: 'user', content: [{ text: 'Say OK.' }] }],
      inferenceConfig: { maxTokens: 10 },
    })
  );
  return res.usage;
}

async function main() {
  for (const modelId of MODELS) {
    try {
      const u1 = await call(modelId);
      const u2 = await call(modelId);
      console.log(
        `${modelId}\n  call1: in=${u1?.inputTokens} read=${u1?.cacheReadInputTokens} write=${u1?.cacheWriteInputTokens}` +
          `\n  call2: in=${u2?.inputTokens} read=${u2?.cacheReadInputTokens} write=${u2?.cacheWriteInputTokens}`
      );
    } catch (err) {
      console.log(
        `${modelId}\n  ERROR ${(err as Error).name}: ${(err as Error).message}`
      );
    }
  }
}

void main();
