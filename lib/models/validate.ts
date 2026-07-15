import { z } from 'zod';
import { MODEL_REGISTRY } from './registry';
import type {
  InferenceCapabilities,
  ModelDefinition,
  ParameterSpec,
} from './types';

export function getModelDefinition(
  modelId: string
): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.modelId === modelId);
}

function schemaForSpec(spec: ParameterSpec): z.ZodTypeAny {
  switch (spec.type) {
    case 'int':
    case 'float': {
      const s =
        spec.type === 'int' ? z.number().int() : z.number();
      // Clamp instead of reject so slightly-stale client values survive a
      // model switch; unknown keys are still rejected below.
      if (spec.min !== undefined || spec.max !== undefined) {
        const min = spec.min ?? Number.MIN_SAFE_INTEGER;
        const max = spec.max ?? Number.MAX_SAFE_INTEGER;
        return s.transform((v) => Math.min(Math.max(v, min), max));
      }
      return s;
    }
    case 'stringList':
      return z.array(z.string().min(1)).max(2500);
  }
}

/**
 * Build a zod schema from the selected model's inference capability map.
 * - keys absent from the map are rejected (strict object)
 * - numeric values are clamped to [min, max]
 */
export function buildParameterSchema(model: ModelDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, spec] of Object.entries(model.capabilities.inference)) {
    shape[key] = schemaForSpec(spec).optional();
  }
  return z.strictObject(shape);
}

export type ValidatedParameters = Partial<
  Record<keyof InferenceCapabilities, number | string[]>
>;

export interface ValidationResult {
  ok: boolean;
  parameters?: ValidatedParameters;
  error?: string;
}

export function validateParameters(
  model: ModelDefinition,
  raw: unknown
): ValidationResult {
  const parsed = buildParameterSchema(model).safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || 'parameters'}: ${i.message}`)
        .join('; '),
    };
  }
  // Drop undefined entries so downstream request-building only sees set params.
  const parameters: ValidatedParameters = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) {
      parameters[k as keyof InferenceCapabilities] = v as number | string[];
    }
  }
  return { ok: true, parameters };
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .array(z.object({ text: z.string().min(1) }))
    .min(1),
});

export const chatRequestSchema = z.object({
  modelId: z.string().min(1),
  system: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(messageSchema).min(1),
  /** request prompt caching — applied only if the registry declares support */
  cache: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
