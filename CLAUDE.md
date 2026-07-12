# CLAUDE.md — Build Instructions (Basic Bedrock Chatbot)

Read `spec.md` for WHAT to build. This file defines HOW.

## 0. Golden Rule
Do NOT write Bedrock/SDK integration code from memory. Fetch official docs first, save
under `aws/docs/`, implement strictly against them. If docs contradict spec.md, STOP
and ask.

## 1. Docs to fetch & cache (update `aws/docs/_manifest.md` per doc)
```
aws/docs/
  bedrock-runtime/   # Converse & ConverseStream: request/response + STREAM EVENT
                     #   shapes (full event union incl. exception events and
                     #   metadata/usage) for the pinned SDK version;
                     #   inferenceConfig vs additionalModelRequestFields semantics
  bedrock-models/    # per-model docs for EVERY seed model incl. qwen/openai-oss:
                     #   exact IDs, param names/ranges/defaults, capability flags
                     #   (vision/docs/tools/system/streaming), region availability,
                     #   and stream-delta quirks (e.g. gpt-oss non-text deltas).
                     #   This data populates lib/models/registry.ts and must be
                     #   sourced, not recalled.
  nextjs/            # route handlers, streaming responses, request abort handling
  _manifest.md
```
- If a seed model's ID cannot be verified in official docs, FLAG it to the user —
  do not invent IDs, parameter ranges, or capability flags.

## 2. Version pinning
Exact versions (no ^/~) for: next, @aws-sdk/client-bedrock-runtime, zod. Record in
`_manifest.md`; saved docs must match pinned versions.

## 3. Implementation order (verify each stage on localhost)
1. Scaffold Next.js (App Router, TS strict, Tailwind, shadcn/ui) + `.env.local.example`.
2. Fetch bedrock-runtime + bedrock-models docs → build registry types (grouped
   capabilities: inference vs features), seed entries (ALL values from saved docs),
   helpers (supportsParam/supportsFeature/getParamSpec), zod-from-metadata validation.
3. `/api/chat`: buildConverseRequest (param routing per target/fieldName; omit empty
   additionalModelRequestFields; system prompt gated on features.systemPrompt),
   per-region cached clients, ConverseStream, DEFENSIVE stream adapter (non-text
   deltas, exception events, metadata/usage, stopReason), error mapping, abort
   handling. Verify with curl against 2+ providers.
4. Chat UI: streaming render, markdown, usage footer, stop-reason notices, stop/clear.
5. Settings + info panels: model selector, metadata-driven parameter controls,
   system prompt gating, feature badges, region/provider display. Verify param
   routing end-to-end (log the outgoing Converse request shape in dev).
6. Extensibility stubs: ConversationStore, getCurrentUser(), MetricsSink (all no-op).

## 4. Conventions
- Server-only AWS clients (`server-only` where helpful); no AWS code in client
  bundles.
- All model-specific behavior via registry metadata — NO `if (provider === …)` or
  model-id string matching at call sites; extend types/flags instead.
- Params absent from a model's inference map are never sent; all client params
  validated/clamped server-side against the registry.
- Region resolution only via `definition.region ?? env.AWS_REGION`.
- Message content = block arrays (text-only v1) matching Converse shapes.
- Registry file is data-only (no logic); helpers live in types/validate modules.
- No secrets in code; `.env.local` gitignored, example committed.

## 5. Done-checklist per stage
- [ ] Docs fetched/saved/manifested; API calls match saved shapes exactly?
- [ ] Registry values (IDs, ranges, defaults, features, regions) traceable to saved
      model docs — unverifiable models flagged, not guessed?
- [ ] Params absent from a model's inference map never sent (no extraneous-key
      validation errors)?
- [ ] top_k-style fields flow via additionalModelRequestFields; standard via
      inferenceConfig; empty additional fields omitted?
- [ ] System prompt gated on features.systemPrompt (disabled UI, not runtime error)?
- [ ] Region-override models route to the correct regional client?
- [ ] Stream adapter survives non-text deltas, missing fields (gpt-oss class), and
      in-stream exception events?
- [ ] Usage footer + stop-reason notices render correctly?
- [ ] Stop/abort cleanly terminates the Bedrock stream?
- [ ] Adding a model touches only registry.ts?
- [ ] Full chat flow works via `npm run dev` + AWS_PROFILE across multiple providers?

## 6. When unsure — don't guess: save what docs say, ask.
```