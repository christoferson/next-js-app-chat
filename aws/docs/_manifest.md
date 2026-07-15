# aws/docs manifest

## Pinned versions (exact, no ^/~)
| Package | Version |
|---|---|
| next | 16.2.10 |
| @aws-sdk/client-bedrock-runtime | 3.1085.0 |
| zod | 4.4.3 |

## Cached docs

| File | Source | Fetched | Notes |
|---|---|---|---|
| bedrock-runtime/converse-stream.md | docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html (+ API_runtime_InferenceConfiguration, API_runtime_ContentBlockDelta, API_runtime_MessageStopEvent) | 2026-07-13 | Request shape, full stream event union incl. exception events, metadata/usage, stopReason enum. Cross-checked against pinned SDK types (`ConverseStreamOutput`, `ContentBlockDelta`, `StopReason` in dist-types/models) — match. SDK `StopReason` enum omits Anthropic's `refusal` → adapter treats stopReason as open string. |
| bedrock-models/anthropic-claude.md | model cards: claude-sonnet-5, claude-fable-5, claude-opus-4-8, claude-opus-4-6 + model-parameters-anthropic-claude-messages-request-response.html + platform.claude.com/docs/en/api/messages | 2026-07-13 | IDs (global.* verified), 1M ctx / 128K out, temp 0–1 default 1.0, top_k via additionalModelRequestFields, Fable 5 sampling restrictions + refusal stop reason. |
| bedrock-models/amazon-nova.md | model-card-amazon-nova-2-lite.html + nova2-userguide/using-converse-api.html + nova/userguide complete-request-schema.html & using-converse-api.html | 2026-07-13 | global.amazon.nova-2-lite-v1:0 verified; maxTokens ≤ 65,000 (card: 64K), temp 0–1 def 0.7, topP 0–1 def 0.9, topK 0–128 via NESTED additionalModelRequestFields.inferenceConfig.topK. |
| bedrock-models/qwen.md | model-card-qwen-qwen3-next-80b-a3b.html | 2026-07-13 | ID qwen.qwen3-next-80b-a3b verified; in-region only (us-east-1 OK). ⚠️ Native param ranges not published — base Converse params only; top_k NOT exposed; system-prompt support unverified (flagged). |
| bedrock-models/openai-gpt-oss.md | model-card-openai-gpt-oss-safeguard-120b.html + model-parameters-openai.html | 2026-07-13 | ID openai.gpt-oss-safeguard-120b verified; in-region only. max_completion_tokens→maxTokens mapping; reasoning/non-text delta quirk recorded. Defaults not documented → null. |
| nextjs/route-handlers-streaming.md | node_modules/next/dist/docs (bundled with next 16.2.10) | 2026-07-13 | Route handlers, ReadableStream streaming pattern, request.signal abort → SDK abortSignal. |
| bedrock-runtime/prompt-caching.md | docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html + boto3 converse_stream reference | 2026-07-14 | cachePoint shape ({type:'default', ttl?:'5m'\|'1h'}) in system/messages/tools unions; usage cacheReadInputTokens/cacheWriteInputTokens/cacheDetails; tools→system→messages ordering, cumulative min tokens. Cross-checked against pinned SDK (`CachePointBlock`, `TokenUsage`) — match. |

## Live verification (curl via /api/chat, us-east-1, 2026-07-13)
All 7 seed models streamed successfully end-to-end. IMPORTANT divergence from model
cards (recorded in bedrock-models/anthropic-claude.md): Bedrock REJECTS temperature
and top_k for Claude Sonnet 5, Fable 5, and Opus 4.8 ("… is deprecated for this
model"), and restricts their top_p to the Fable band (0.99 works, 0.5 rejected).
Opus 4.6 accepts temperature/top_p/top_k but not temperature+top_p together.
Registry updated to match live behavior. Qwen + GPT-OSS system prompts verified
working. Nova nested topK routing verified in outgoing request logs.

## Flags raised to user (per CLAUDE.md §6 / spec §4.3)
1. **Qwen3 Next 80B**: AWS publishes no native parameter ranges/defaults and no
   additionalModelRequestFields contract → registry exposes only base Converse params
   (no top_k). System-prompt support not explicitly documented; marked true with a
   note — verify live in Stage 3.
2. **GPT-OSS Safeguard 120B**: no documented temperature/top_p defaults → defaults
   null (omitted unless user sets them). top_k not in the OpenAI schema → not exposed.
3. **Anthropic top_k bounds**: docs give no min/max (example: 200). UI slider bound
   0–500 chosen pragmatically; documented in anthropic-claude.md.
4. Spec's expected shape for Claude Sonnet 5 listed "temp, topP, topK→top_k"; Claude
   Fable 5 docs FORBID top_k and restrict temperature/top_p — registry follows docs.
5. **Prompt caching (2026-07-14)**: user-guide table lists only Opus 4.6 among our
   models. Sonnet 5 / Fable 5 / Opus 4.8 / Nova 2 Lite live-verified as supported
   (cache-probe.ts: write→read round trip); their min tokens/checkpoint remain
   undocumented → omitted from registry. Qwen3 + GPT-OSS rejected cachePoint
   (AccessDeniedException) → no promptCaching capability, noted in registry.
