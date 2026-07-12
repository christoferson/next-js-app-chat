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
                     #   shapes for the pinned @aws-sdk/client-bedrock-runtime;
                     #   inferenceConfig vs additionalModelRequestFields semantics
  bedrock-models/    # per-model pages: EXACT model IDs, inference parameter names,
                     #   ranges, defaults, quirks for every seed registry model
                     #   (Anthropic Claude + Amazon Nova) — this data populates
                     #   lib/models/registry.ts and must be sourced, not recalled
  nextjs/            # route handlers, streaming responses, request abort handling
  _manifest.md
```

## 2. Version pinning
Exact versions (no ^/~) for: next, @aws-sdk/client-bedrock-runtime, zod. Record in
`_manifest.md`; saved docs must match pinned versions.

## 3. Implementation order (verify each stage on localhost)
1. Scaffold Next.js (App Router, TS strict, Tailwind, shadcn/ui) + `.env.local.example`.
2. Fetch bedrock-runtime + bedrock-models docs → build registry types + seed entries
   (IDs/ranges/defaults FROM the saved docs) + zod-from-metadata validation.
3. `/api/chat`: buildConverseRequest (param routing per `target`), ConverseStream,
   stream adapter, error mapping, abort handling. Verify with curl.
4. Chat UI: streaming render, markdown, stop/clear.
5. Settings panel: model selector + metadata-driven parameter controls + system prompt
   gating. Verify param routing end-to-end (log the outgoing Converse request shape).
6. Extensibility stubs: ConversationStore interface + in-memory impl; getCurrentUser()
   stub.

## 4. Conventions
- Server-only AWS clients (`server-only` where helpful); no AWS code in client bundles.
- All model-specific behavior via registry metadata — no `if (provider === …)` at call
  sites; add capability flags instead.
- Validate/clamp all client params server-side against the registry.
- Message content = block arrays (text-only v1) matching Converse shapes.
- No secrets in code; `.env.local` gitignored, example committed.

## 5. Done-checklist per stage
- [ ] Docs fetched/saved/manifested; API calls match saved shapes exactly?
- [ ] Registry values (IDs, ranges, defaults) traceable to saved model docs?
- [ ] top_k-style fields flow via additionalModelRequestFields; standard via
      inferenceConfig?
- [ ] Adding a model touches only registry.ts?
- [ ] Stop/abort cleanly terminates the Bedrock stream?
- [ ] Errors render in-chat (access/throttle/validation)?
- [ ] Full chat flow works via `npm run dev` + AWS_PROFILE?

## 6. When unsure — don't guess: save what docs say, ask.