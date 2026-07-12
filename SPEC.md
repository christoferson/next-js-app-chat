# spec.md — Basic Bedrock Chatbot (Local, Extensible)

## 1. Overview
A minimal, local-only Next.js chatbot. The backend (Next.js route handlers) calls
Amazon Bedrock via the **Converse Stream** API and streams responses to a simple chat
UI. No auth, no persistence, no deployment — `npm run dev` and chat.

Two architectural mandates:
1. **Model Registry**: Bedrock foundation models are modeled as typed metadata
   (capabilities + supported inference parameters). All model-specific behavior —
   UI controls, request construction, validation — is driven by this metadata, never
   hardcoded at call sites.
2. **Extensibility**: clean seams so auth, persistence, RAG/Knowledge Bases, tool use,
   file/image input, and deployment can be added later without restructuring.

Region: **us-east-1**. Credentials: local `AWS_PROFILE` (SSO supported).

## 2. Goals & Non-Goals
### Goals
- Multi-turn text chat with streaming (token-by-token) responses.
- Model selector; switching models mid-conversation is allowed (history is replayed
  to the new model).
- Per-model inference parameter controls (temperature, topP, maxTokens, etc.)
  **rendered dynamically from registry metadata**, with model-appropriate ranges and
  defaults.
- Editable system prompt (respecting per-model support).
- Stop-generation button; clear-conversation button.
- Graceful error surfacing (throttling, access-denied, validation) in the chat UI.
- Runs entirely locally against real Bedrock (no emulators, no mocks).

### Non-Goals (v1 — design for, don't build)
- Auth, user accounts.
- Conversation persistence (in-memory/client-state only; lost on refresh).
- RAG / Knowledge Bases, tool/function calling, agents.
- Image/document input (but message model and registry flags anticipate it).
- Deployment, Docker, CI/CD, IaC.
- Token counting/cost display, guardrails.

## 3. Architecture
```
Browser (React client)
  │  POST /api/chat  { modelId, system, params, messages[] }
  ▼
Next.js route handler (Node runtime)
  ├── registry.validate(modelId, params)   → clamp/reject per metadata
  ├── buildConverseRequest(definition, …)  → inferenceConfig vs
  │                                          additionalModelRequestFields split
  └── BedrockRuntimeClient.ConverseStreamCommand
  ▼
SSE / ReadableStream back to client (text deltas, stop reason, errors)
```
- **Stateless backend**: full message history sent with each request. This is the seam
  for future persistence (swap client state for a repository without API changes).
- **Server-only AWS calls**: Bedrock client never in the client bundle.
- Client abort (stop button) cancels the fetch; server aborts the Bedrock stream.

## 4. Model Registry (the core design)

### 4.1 Types
```ts
// lib/models/types.ts
export type ParameterTarget = 'inferenceConfig' | 'additionalModelRequestFields';

export interface ParameterSpec {
  key: string;                 // canonical key used by UI + API, e.g. 'temperature'
  label: string;               // UI label
  type: 'float' | 'int' | 'stringList';
  min?: number;
  max?: number;
  step?: number;
  default: number | string[] | null;   // null = omit unless user sets it
  target: ParameterTarget;
  fieldName?: string;          // wire name if it differs, e.g. key 'topK' -> 'top_k'
  description?: string;        // UI tooltip
}

export interface ModelDefinition {
  modelId: string;             // Bedrock model/inference-profile ID
  provider: 'anthropic' | 'amazon' | 'meta' | 'mistral' | 'cohere';
  displayName: string;
  description?: string;
  // capability flags — future features gate on these, never on provider checks
  streaming: boolean;
  supportsSystemPrompt: boolean;
  supportsVision: boolean;         // future: image input
  supportsToolUse: boolean;        // future: function calling
  supportsDocuments: boolean;      // future: doc blocks
  contextWindowTokens?: number;    // informational, shown in UI
  maxOutputTokens: number;         // hard cap for the maxTokens control
  parameters: ParameterSpec[];     // ONLY params this model actually supports
  notes?: string[];                // quirks, e.g. mutually exclusive params
}
```

### 4.2 Behavior rules
- **UI**: the parameter panel is generated from `parameters[]` — a model that doesn't
  support `topK` simply shows no topK slider. Switching models re-renders controls and
  resets out-of-range values to that model's defaults.
- **Backend validation**: `/api/chat` re-validates every incoming param against the
  selected model's specs (zod schema built from metadata): unknown keys rejected,
  values clamped to [min, max], types enforced. Never trust the client.
- **Request construction**: params route to `inferenceConfig` (standard Converse:
  maxTokens, temperature, topP, stopSequences) or `additionalModelRequestFields`
  (model-native fields, e.g. Anthropic `top_k`) based on `target` + `fieldName`.
- **System prompt**: included only if `supportsSystemPrompt`; otherwise the UI disables
  the field with an explanatory hint.
- Adding a model = adding ONE registry entry. No other code changes.

### 4.3 Seed registry (verify IDs/limits against fetched docs at build time)
| displayName | modelId | provider | params (typical) |
|---|---|---|---|
| Claude Sonnet 4.5 | global.anthropic.claude-sonnet-4-5-20250929-v1:0 | anthropic | maxTokens, temperature, topP, topK→top_k (additional), stopSequences |
| Claude 3.5 Haiku | (current Bedrock ID) | anthropic | same shape as above |
| Nova Pro | (current Bedrock ID) | amazon | maxTokens, temperature, topP, topK (verify target), stopSequences |
| Nova Lite | (current Bedrock ID) | amazon | same shape as Nova Pro |
- Registry entries carry accurate per-model ranges/defaults from the official model
  parameter docs — do not copy Anthropic ranges onto Nova.
- Anthropic note: record temperature/top_p mutual-exclusivity guidance in `notes`.

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
- Response: streamed text deltas + terminal event carrying `stopReason` (and usage
  metadata if trivially available). SSE or ReadableStream — pick one, document it.
- Errors: map common Bedrock failures (AccessDenied → "enable model access",
  Throttling → "retry shortly", Validation → message) to a structured error event.

### `GET /api/models`
- Returns the registry (client-safe fields) for the selector + parameter panel.

## 6. Frontend UX
- Single chat page:
  - message list (user right / assistant left), streaming render, markdown support
    (code blocks highlighted).
  - input box (Enter send, Shift+Enter newline), Stop button while streaming,
    Clear conversation.
  - collapsible **settings panel**: model selector (name + description +
    context-window info), dynamically generated parameter controls (slider + numeric
    input, reset-to-default), system prompt textarea (disabled when unsupported).
  - error banner inline in the conversation on failures.
- Tailwind + shadcn/ui, desktop-first, dark-mode friendly if trivial.

## 7. Tech Stack
- Next.js (App Router), TypeScript strict. Node runtime for the chat route.
- `@aws-sdk/client-bedrock-runtime` (ConverseStreamCommand). Version pinned.
- zod (param validation from metadata; request body validation).
- Tailwind CSS + shadcn/ui; react-markdown (+ highlighter) for rendering.
- No database, no auth libraries.

## 8. Configuration
```
# .env.local (from committed .env.local.example)
AWS_REGION=us-east-1
AWS_PROFILE=<profile>          # SSO: run `aws sso login` first
DEFAULT_MODEL_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0
DEFAULT_SYSTEM_PROMPT=You are a helpful assistant.
```
- Registry lives in code (typed), not env. Env only selects defaults.

## 9. Extensibility Seams (build these shapes now, features later)
- **Persistence**: define a `ConversationStore` interface (in-memory no-op impl in v1);
  future DynamoDB impl slots in behind it.
- **Auth**: route handlers isolate a `getCurrentUser()` helper returning a stub user;
  future Auth.js/Cognito replaces the stub, middleware added later.
- **RAG/tools**: request pipeline is a single `buildConverseRequest()` — future
  toolConfig/context injection extends it; capability flags already exist.
- **Multimodal**: message content is block-based; `supportsVision`/`supportsDocuments`
  flags gate future upload UI.
- **Deployment**: keep server/client boundaries clean and config in env so the
  ECS/CDK pattern from prior projects can be bolted on unchanged.

## 10. Acceptance Criteria
1. `npm run dev` + valid `AWS_PROFILE` → chat works at `localhost:3000` with streaming
   responses.
2. Model selector lists all registry models; switching models mid-conversation works.
3. Parameter panel renders ONLY the selected model's supported params, with that
   model's ranges/defaults; out-of-range client values are clamped server-side.
4. Anthropic-specific fields (e.g. top_k) reach Bedrock via
   additionalModelRequestFields; standard fields via inferenceConfig (verifiable in
   code + logs).
5. System prompt applies when supported; control disabled when not.
6. Stop button halts generation immediately; Clear resets the conversation.
7. Bedrock errors (access, throttle, validation) render as readable in-chat messages,
   not crashes.
8. Adding a fifth model requires ONLY a new registry entry.

## 11. Project Structure
```
/app
  page.tsx                 # chat UI
  /api/chat/route.ts
  /api/models/route.ts
/lib
  /models
    types.ts               # ModelDefinition, ParameterSpec
    registry.ts            # seed model entries
    validate.ts            # zod-from-metadata param validation
  /bedrock
    client.ts              # singleton BedrockRuntimeClient
    converse.ts            # buildConverseRequest + stream adapter
  /store
    conversation-store.ts  # interface + in-memory stub (future persistence seam)
/components                # chat, settings panel, param controls (+ /ui shadcn)
/aws/docs                  # cached official docs + _manifest.md (see CLAUDE.md)
.env.local.example
```