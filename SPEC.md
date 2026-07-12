# spec.md — Basic Bedrock Chatbot (Local, Extensible)

## 1. Overview
A minimal, local-only Next.js chatbot. The backend (Next.js route handlers) calls
Amazon Bedrock via the **Converse Stream** API and streams responses to a simple chat
UI. No auth, no persistence, no deployment — `npm run dev` and chat.

Two architectural mandates:
1. **Model Registry**: Bedrock foundation models are modeled as typed metadata with
   capabilities split into two groups — **inference capabilities** (supported
   parameters with ranges/defaults/routing) and **general feature capabilities**
   (vision, documents, tool use, system prompt, streaming). All model-specific
   behavior — UI controls, request construction, validation, region routing — is
   driven by this metadata, never hardcoded at call sites.
2. **Extensibility**: clean seams so auth, persistence, RAG/Knowledge Bases, tool use,
   file/image input, metrics, and deployment can be added later without restructuring.

Default region: **us-east-1** (per-model override supported). Credentials: local
`AWS_PROFILE` (SSO supported).

## 2. Goals & Non-Goals
### Goals
- Multi-turn text chat with streaming (token-by-token) responses.
- Model selector; switching models mid-conversation is allowed (history is replayed
  to the new model).
- Per-model inference parameter controls (maxTokens, temperature, topP, topK,
  stopSequences) **rendered dynamically from registry metadata**, with
  model-appropriate ranges and defaults. Unsupported params never shown, never sent.
- Editable system prompt, gated on per-model feature support.
- Per-response usage footer (tokens in/out/total, latency) from stream metadata.
- Stop-generation button; clear-conversation button.
- Graceful error surfacing (throttling, access-denied, validation, stop reasons) in
  the chat UI.
- Per-model region routing (some models are only available in specific regions).
- Runs entirely locally against real Bedrock (no emulators, no mocks).

### Non-Goals (v1 — design for, don't build)
- Auth, user accounts.
- Conversation persistence (client-state only; lost on refresh).
- RAG / Knowledge Bases, tool/function calling, agents.
- Image/document input (message model + feature flags anticipate it).
- Deployment, Docker, CI/CD, IaC.
- Cost display, guardrails, CloudWatch metrics sink (interface stubbed only).

## 3. Architecture
```
Browser (React client)
  │  POST /api/chat  { modelId, system, parameters, messages[] }
  ▼
Next.js route handler (Node runtime)
  ├── registry.validate(modelId, parameters)   → reject unknown keys, clamp ranges
  ├── buildConverseRequest(definition, …)      → inferenceConfig vs
  │                                              additionalModelRequestFields split
  └── bedrockClientFor(definition.region ?? env.AWS_REGION)   // cached per region
        .send(ConverseStreamCommand)
  ▼
SSE / ReadableStream back to client (text deltas, stop reason, usage, errors)
```
- **Stateless backend**: full message history sent with each request. This is the seam
  for future persistence (swap client state for a repository without API changes).
- **Server-only AWS calls**: Bedrock clients never in the client bundle.
- Client abort (stop button) cancels the fetch; server aborts the Bedrock stream.

## 4. Model Registry (the core design)

### 4.1 Types — capabilities grouped: inference vs general features
```ts
// lib/models/types.ts
export type ParameterTarget = 'inferenceConfig' | 'additionalModelRequestFields';

export interface ParameterSpec {
  label: string;
  type: 'float' | 'int' | 'stringList';
  min?: number;
  max?: number;
  step?: number;
  default: number | string[] | null;   // null = omit from request unless user sets it
  target: ParameterTarget;             // where it goes in the Converse request
  fieldName?: string;                  // wire name if different, e.g. topK -> 'top_k'
  description?: string;                // UI tooltip
}

// GROUP 1 — inference capabilities: presence in the map = supported.
// Well-known keys so UI/backend can address them uniformly across providers.
export interface InferenceCapabilities {
  maxTokens: ParameterSpec;            // required for every model
  temperature?: ParameterSpec;
  topP?: ParameterSpec;
  topK?: ParameterSpec;
  stopSequences?: ParameterSpec;
  // future model-native extras (reasoning budget, etc.) added as optional keys
}

// GROUP 2 — general feature capabilities: booleans (+ limits where relevant).
export interface FeatureCapabilities {
  streaming: boolean;
  systemPrompt: boolean;               // e.g. some Mistral models: false
  vision: boolean;
  documentChat: boolean;
  toolUse: boolean;
  // future: citations, guardrails, promptCaching, ...
}

export interface ModelDefinition {
  modelId: string;
  provider: string;                    // informational only — NEVER branched on
  displayName: string;
  description?: string;
  region?: string;                     // override when model isn't in default region
  contextWindowTokens?: number;
  capabilities: {
    inference: InferenceCapabilities;
    features: FeatureCapabilities;
  };
  notes?: string[];                    // quirks (mutual exclusivity, format issues)
}

// Helpers (isSupported / isFeatureSupported pattern)
export function supportsParam(m: ModelDefinition,
  k: keyof InferenceCapabilities): boolean;
export function supportsFeature(m: ModelDefinition,
  k: keyof FeatureCapabilities): boolean;
export function getParamSpec(m: ModelDefinition,
  k: keyof InferenceCapabilities): ParameterSpec | undefined;
```

### 4.2 Behavior rules
- **UI**: parameter panel renders one control per present key in
  `capabilities.inference`, using that spec's min/max/step/default. Feature-gated UI
  (system prompt field, future upload buttons) checks `capabilities.features`.
  Switching models re-renders controls and resets out-of-range values to the new
  model's defaults.
- **Backend validation**: zod schema built from the selected model's inference map —
  unknown keys rejected, values clamped to [min, max], types enforced. A param absent
  from the map is NEVER sent (prevents e.g. Cohere "extraneous key [top_k]"
  validation errors). Never trust the client.
- **Request construction**: each present+set param routes to `inferenceConfig`
  (standard Converse fields) or `additionalModelRequestFields` (model-native fields)
  per its `target`/`fieldName`. If additionalModelRequestFields ends up empty, omit
  it entirely.
- **System prompt**: included only if `features.systemPrompt`; otherwise the UI
  disables the field with an explanatory hint (never a runtime error).
- **Region routing**: Bedrock client resolved per request from
  `definition.region ?? AWS_REGION` (cached client per region) — no model-id string
  matching at call sites.
- **No provider branching**: any behavior difference must be expressible as registry
  metadata. If it can't be, extend the types — don't add `if (provider === ...)`.
- Adding a model = one registry entry. Nothing else changes.

### 4.3 Seed registry
All IDs, ranges, defaults, and capability flags MUST be populated from fetched
official docs (see CLAUDE.md) — treat the table below as the intended lineup, not as
verified data:

| displayName | modelId | expected shape |
|---|---|---|
| Claude Sonnet 5 (default) | global.anthropic.claude-sonnet-5 | temp, topP, topK→top_k (additional), stopSeq; vision/docs/tools/system: verify |
| Claude Fable 5 | global.anthropic.claude-fable-5 | verify |
| Claude Opus 4.8 | global.anthropic.claude-opus-4-8 | verify |
| Claude Opus 4.6 | global.anthropic.claude-opus-4-6-v1 | verify |
| Nova 2 Lite | global.amazon.nova-2-lite-v1:0 | Nova param ranges differ from Anthropic — source separately |
| Qwen3 Next 80B | qwen.qwen3-next-80b-a3b | verify params + which need additionalModelRequestFields |
| GPT-OSS Safeguard 120B | openai.gpt-oss-safeguard-120b | KNOWN QUIRK: stream deltas may lack `text` (non-text/reasoning blocks) — note in registry; stream adapter must handle |

- Possible future additions (registry-entry-only by design): DeepSeek, GLM.
- If a listed ID is not found in official docs / not accessible in the account, flag
  to the user rather than guessing — do not invent parameter ranges.
- Record known quirks in `notes` (e.g. Anthropic temperature/top_p mutual-exclusivity
  guidance).

## 5. API

### `POST /api/chat`
Request:
```json
{
  "modelId": "…",
  "system": "optional string",
  "parameters": { "temperature": 0.7, "maxTokens": 1024 },
  "messages": [ { "role": "user" | "assistant", "content": [ { "text": "…" } ] } ]
}
```
- `content` is a **block array** (only `text` blocks in v1) — matches Converse's shape
  and leaves room for image/document blocks later.
- Response: streamed text deltas + terminal event. SSE or ReadableStream — pick one,
  document it.
- **Stream adapter parses events defensively** per the documented event union:
  `contentBlockDelta` may contain non-text deltas (e.g. reasoning blocks on some
  models) — skip or surface gracefully, never assume `delta.text` exists.
- Terminal event carries `stopReason` AND usage metadata when present
  (`{ inputTokens, outputTokens, totalTokens, latencyMs }`).
- Non-`end_turn` stop reasons surface as a styled notice in the chat (e.g.
  `max_tokens` → "Generation stopped: increase Max Tokens").
- Errors: map common Bedrock failures (AccessDenied → "enable model access",
  Throttling → "retry shortly", Validation → message) AND in-stream exception events
  (internalServerException, modelStreamErrorException, throttlingException,
  validationException) to a structured error event.

### `GET /api/models`
- Returns the registry (client-safe fields) for the selector + parameter panel +
  feature badges.

## 6. Frontend UX
- Single chat page:
  - message list (user right / assistant left), streaming render, markdown support
    (code blocks highlighted).
  - **per-response footer**: token in/out/total + latency (from the metadata event).
  - input box (Enter send, Shift+Enter newline), Stop button while streaming,
    Clear conversation.
  - collapsible **settings panel**: model selector (name + description +
    context-window info), dynamically generated parameter controls (slider + numeric
    input, reset-to-default), system prompt textarea (disabled when unsupported, with
    hint).
  - **info panel** (collapsible): current model's provider, region, and feature
    badges (Vision / Documents / Tool Use) driven by `capabilities.features`.
  - error banner inline in the conversation on failures.
- Tailwind + shadcn/ui, desktop-first, dark-mode friendly if trivial.

## 7. Tech Stack
- Next.js (App Router), TypeScript strict. Node runtime for the chat route.
- `@aws-sdk/client-bedrock-runtime` (ConverseStreamCommand). Version pinned.
- zod (param validation built from metadata; request body validation).
- Tailwind CSS + shadcn/ui; react-markdown (+ highlighter) for rendering.
- No database, no auth libraries.

## 8. Configuration
```
# .env.local (from committed .env.local.example)
AWS_REGION=us-east-1
AWS_PROFILE=<profile>          # SSO: run `aws sso login` first
DEFAULT_MODEL_ID=global.anthropic.claude-sonnet-5
DEFAULT_SYSTEM_PROMPT=You are a helpful assistant.
```
- Registry lives in code (typed), not env. Env only selects defaults.
- Per-model region overrides live in the registry, not env.

## 9. Extensibility Seams (build these shapes now, features later)
- **Persistence**: define a `ConversationStore` interface (in-memory no-op impl in
  v1); future DynamoDB impl slots in behind it.
- **Auth**: route handlers isolate a `getCurrentUser()` helper returning a stub user;
  future Auth.js/Cognito replaces the stub, middleware added later.
- **Metrics hook**: a `MetricsSink` interface invoked with per-response usage (no-op
  impl in v1; future CloudWatch Logs sink slots in — per-user token accounting once
  auth exists).
- **RAG/tools**: request pipeline is a single `buildConverseRequest()` — future
  toolConfig/context injection extends it; `features.toolUse` flag already exists.
- **Multimodal**: message content is block-based; `features.vision` /
  `features.documentChat` gate future upload UI (incl. per-model file-type/size
  limits added to FeatureCapabilities when built).
- **Deployment**: clean server/client boundaries + env-driven config so the ECS/CDK
  pattern from prior projects can be bolted on unchanged.

## 10. Acceptance Criteria
1. `npm run dev` + valid `AWS_PROFILE` → chat works at `localhost:3000` with
   streaming responses.
2. Model selector lists all registry models; switching models mid-conversation works.
3. Parameter panel renders ONLY the selected model's supported params, with that
   model's ranges/defaults; out-of-range client values are clamped server-side;
   unsupported/unknown params are rejected and never sent to Bedrock.
4. Params route correctly: standard fields via inferenceConfig, model-native fields
   (e.g. top_k) via additionalModelRequestFields (verifiable in code + debug logs);
   empty additionalModelRequestFields is omitted.
5. System prompt applies when supported; control disabled with hint when not.
6. A model with a region override is invoked in its correct region.
7. Usage footer shows tokens + latency per response; non-end_turn stop reasons render
   a readable notice.
8. Streams containing non-text deltas do not crash the adapter.
9. Stop button halts generation immediately; Clear resets the conversation.
10. Bedrock errors (access, throttle, validation — request-level AND in-stream)
    render as readable in-chat messages, not crashes.
11. Adding another model requires ONLY a new registry entry.

## 11. Project Structure
```
/app
  page.tsx                 # chat UI
  /api/chat/route.ts
  /api/models/route.ts
/lib
  /models
    types.ts               # ModelDefinition, ParameterSpec, capability groups, helpers
    registry.ts            # seed model entries (data only)
    validate.ts            # zod-from-metadata param validation
  /bedrock
    client.ts              # bedrockClientFor(region) — cached per-region clients
    converse.ts            # buildConverseRequest + defensive stream adapter
  /store
    conversation-store.ts  # interface + in-memory stub (future persistence seam)
  /metrics
    metrics-sink.ts        # interface + no-op stub (future CloudWatch seam)
/components                # chat, settings panel, param controls, info panel (+ /ui)
/aws/docs                  # cached official docs + _manifest.md (see CLAUDE.md)
.env.local.example
```