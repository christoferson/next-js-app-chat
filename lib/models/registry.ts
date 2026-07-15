import type { ModelDefinition } from './types';

// All values sourced from aws/docs/bedrock-models/* (see aws/docs/_manifest.md).
// This file is data-only — helpers live in types.ts / validate.ts.

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    // aws/docs/bedrock-models/anthropic-claude.md — Claude Sonnet 5
    modelId: 'global.anthropic.claude-sonnet-5',
    provider: 'Anthropic',
    displayName: 'Claude Sonnet 5',
    description:
      'Near-Opus intelligence for coding, agents, and professional work at scale.',
    contextWindowTokens: 1_000_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 128_000,
          step: 1,
          default: 4096,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 128K).',
        },
        // temperature/topK omitted: Bedrock rejects them for Claude 5-gen
        // models ("`temperature` is deprecated for this model") — verified
        // live 2026-07-13, see aws/docs/bedrock-models/anthropic-claude.md.
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0.99,
          max: 0.999,
          step: 0.001,
          default: null,
          target: 'inferenceConfig',
          description:
            'Restricted on this model: must be ≥ 0.99 and < 1.0, or unset.',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: true,
        documentChat: true,
        toolUse: true,
      },
      // Not in the prompt-caching user-guide table; support verified live
      // 2026-07-14 (write 19743 → read 19743). Min tokens undocumented.
      promptCaching: {
        maxCheckpoints: 4,
        ttls: ['5m'],
        fields: ['system', 'messages', 'tools'],
      },
    },
    notes: [
      'Claude 5-generation sampling: temperature/top_k rejected by Bedrock; top_p only ≥ 0.99 (verified live).',
      'Adaptive thinking is always on and cannot be disabled.',
    ],
  },
  {
    // aws/docs/bedrock-models/anthropic-claude.md — Claude Fable 5
    modelId: 'global.anthropic.claude-fable-5',
    provider: 'Anthropic',
    displayName: 'Claude Fable 5',
    description:
      'Next-generation model for complex knowledge work and coding; sustained autonomous operation.',
    contextWindowTokens: 1_000_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 128_000,
          step: 1,
          default: 4096,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 128K).',
        },
        // temperature omitted: docs — "temperature must be 1.0 or unset".
        // topK omitted: docs — "top_k is not supported".
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0.99,
          max: 0.999,
          step: 0.001,
          default: null,
          target: 'inferenceConfig',
          description:
            'Restricted on this model: must be ≥ 0.99 and < 1.0, or unset.',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: true,
        documentChat: true,
        toolUse: true,
      },
      // Not in the prompt-caching user-guide table; support verified live
      // 2026-07-14 (write 19743 → read 19743). Min tokens undocumented.
      promptCaching: {
        maxCheckpoints: 4,
        ttls: ['5m'],
        fields: ['system', 'messages', 'tools'],
      },
    },
    notes: [
      'Sampling restricted: temperature must be 1.0 or unset; top_p ≥ 0.99 and < 1.0 or unset; top_k unsupported.',
      'Dual-use content classifiers: stop_reason "refusal" occurs at a materially higher rate and can fire mid-stream.',
      'Requires account opt-in to provider data sharing (Data Retention API).',
    ],
  },
  {
    // aws/docs/bedrock-models/anthropic-claude.md — Claude Opus 4.8
    modelId: 'global.anthropic.claude-opus-4-8',
    provider: 'Anthropic',
    displayName: 'Claude Opus 4.8',
    description:
      'Opus model optimized for coding, agents, and deeper reasoning in enterprise workflows.',
    contextWindowTokens: 1_000_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 128_000,
          step: 1,
          default: 4096,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 128K).',
        },
        // temperature/topK omitted: rejected by Bedrock ("deprecated for
        // this model") — verified live 2026-07-13.
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0.99,
          max: 0.999,
          step: 0.001,
          default: null,
          target: 'inferenceConfig',
          description:
            'Restricted on this model: must be ≥ 0.99 and < 1.0, or unset.',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: true,
        documentChat: true,
        toolUse: true,
      },
      // Not in the prompt-caching user-guide table; support verified live
      // 2026-07-14 (write 19743 → read 19743). Min tokens undocumented.
      promptCaching: {
        maxCheckpoints: 4,
        ttls: ['5m'],
        fields: ['system', 'messages', 'tools'],
      },
    },
    notes: [
      'Sampling restricted like Claude 5 generation: temperature/top_k rejected; top_p only ≥ 0.99 (verified live).',
    ],
  },
  {
    // aws/docs/bedrock-models/anthropic-claude.md — Claude Opus 4.6
    modelId: 'global.anthropic.claude-opus-4-6-v1',
    provider: 'Anthropic',
    displayName: 'Claude Opus 4.6',
    description:
      'Flagship model that plans carefully, sustains agentic tasks, and operates in massive codebases.',
    contextWindowTokens: 1_000_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 128_000,
          step: 1,
          default: 4096,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 128K).',
        },
        temperature: {
          label: 'Temperature',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: 1,
          target: 'inferenceConfig',
          description: 'Randomness. 0 = analytical, 1 = creative. Default 1.0.',
        },
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: null,
          target: 'inferenceConfig',
          description:
            'Nucleus sampling. Adjust temperature OR topP, not both.',
        },
        topK: {
          label: 'Top K',
          type: 'int',
          min: 0,
          max: 500,
          step: 1,
          default: null,
          target: 'additionalModelRequestFields',
          fieldName: 'top_k',
          description:
            'Sample only from the top K options. Removes long-tail responses.',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: true,
        documentChat: true,
        toolUse: true,
      },
      // aws/docs/bedrock-runtime/prompt-caching.md (user-guide table row
      // anthropic.claude-opus-4-6-v1). Verified live 2026-07-14.
      promptCaching: {
        minTokensPerCheckpoint: 4096,
        maxCheckpoints: 4,
        ttls: ['5m'],
        fields: ['system', 'messages', 'tools'],
      },
    },
    notes: [
      'temperature and topP cannot both be specified — Bedrock returns a validation error (verified live).',
    ],
  },
  {
    // aws/docs/bedrock-models/amazon-nova.md — Nova 2 Lite
    modelId: 'global.amazon.nova-2-lite-v1:0',
    provider: 'Amazon',
    displayName: 'Nova 2 Lite',
    description:
      'Cost-efficient multimodal model for automation, document processing, and support.',
    contextWindowTokens: 1_000_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 65_000,
          step: 1,
          default: 4096,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (up to 65,000).',
        },
        temperature: {
          label: 'Temperature',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.7,
          target: 'inferenceConfig',
          description: 'Randomness (0.0–1.0). Nova default 0.7.',
        },
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.9,
          target: 'inferenceConfig',
          description:
            'Nucleus sampling (0–1). Nova default 0.9. Alter temperature OR topP, not both.',
        },
        topK: {
          label: 'Top K',
          type: 'int',
          min: 0,
          max: 128,
          step: 1,
          default: null,
          target: 'additionalModelRequestFields',
          fieldName: 'inferenceConfig.topK',
          description:
            'Sample only from the top K options (0–128). Not used unless set.',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: true,
        documentChat: true,
        toolUse: true,
      },
      // Guide documents automatic Nova caching + recommends explicit opt-in,
      // but publishes no Converse table row. Explicit cachePoint verified
      // live 2026-07-14 (write 10544 → read 10544). Min tokens undocumented.
      promptCaching: {
        maxCheckpoints: 4,
        ttls: ['5m'],
        fields: ['system', 'messages'],
      },
    },
    notes: [
      'Nova topK is passed nested: additionalModelRequestFields.inferenceConfig.topK.',
      'Alter either temperature or topP, but not both (Nova guidance).',
    ],
  },
  {
    // aws/docs/bedrock-models/qwen.md — Qwen3 Next 80B A3B
    modelId: 'qwen.qwen3-next-80b-a3b',
    provider: 'Qwen',
    displayName: 'Qwen3 Next 80B',
    description:
      'Efficient mixture-of-experts model (80B total / 3B active) for fast, cost-effective inference.',
    contextWindowTokens: 256_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 8192,
          step: 1,
          default: 2048,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 8K).',
        },
        temperature: {
          label: 'Temperature',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: null,
          target: 'inferenceConfig',
          description: 'Randomness (Converse base range 0–1).',
        },
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: null,
          target: 'inferenceConfig',
          description: 'Nucleus sampling (Converse base range 0–1).',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: false,
        documentChat: false,
        toolUse: false,
      },
    },
    notes: [
      'AWS docs publish no native parameter ranges for this model — only base Converse parameters are exposed; top_k is not exposed (no documented additionalModelRequestFields contract).',
      'System-prompt support not explicitly documented for Converse — verified live before relying on it.',
      'No geo/global inference profile — in-region only (us-east-1 supported).',
      'Prompt caching NOT supported — cachePoint rejected by Bedrock (verified live 2026-07-14).',
    ],
  },
  {
    // aws/docs/bedrock-models/openai-gpt-oss.md — GPT OSS Safeguard 120B
    modelId: 'openai.gpt-oss-safeguard-120b',
    provider: 'OpenAI',
    displayName: 'GPT-OSS Safeguard 120B',
    description:
      'Open-source 120B safety model for content moderation and guardrail enforcement.',
    contextWindowTokens: 128_000,
    capabilities: {
      inference: {
        maxTokens: {
          label: 'Max Tokens',
          type: 'int',
          min: 1,
          max: 16_384,
          step: 1,
          default: 2048,
          target: 'inferenceConfig',
          description: 'Maximum tokens to generate (model max output: 16K).',
        },
        temperature: {
          label: 'Temperature',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: null,
          target: 'inferenceConfig',
          description: 'Randomness (Converse base range 0–1).',
        },
        topP: {
          label: 'Top P',
          type: 'float',
          min: 0,
          max: 1,
          step: 0.01,
          default: null,
          target: 'inferenceConfig',
          description: 'Nucleus sampling (Converse base range 0–1).',
        },
        stopSequences: {
          label: 'Stop Sequences',
          type: 'stringList',
          default: null,
          target: 'inferenceConfig',
          description: 'Text sequences that stop generation.',
        },
      },
      features: {
        streaming: true,
        systemPrompt: true,
        vision: false,
        documentChat: false,
        toolUse: false,
      },
    },
    notes: [
      'Stream deltas may carry reasoningContent instead of text — the adapter must not assume delta.text exists.',
      'No documented temperature/topP defaults for this variant — omitted from requests unless set.',
      'No geo/global inference profile — in-region only (us-east-1 supported).',
      'Prompt caching NOT supported — cachePoint rejected by Bedrock (verified live 2026-07-14).',
    ],
  },
];
