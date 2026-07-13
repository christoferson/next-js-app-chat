export type ParameterTarget = 'inferenceConfig' | 'additionalModelRequestFields';

export interface ParameterSpec {
  label: string;
  type: 'float' | 'int' | 'stringList';
  min?: number;
  max?: number;
  step?: number;
  /** null = omit from the request unless the user explicitly sets it */
  default: number | string[] | null;
  /** where the value goes in the Converse request */
  target: ParameterTarget;
  /**
   * Wire name if different from the registry key, e.g. topK -> 'top_k'.
   * Dots denote nesting inside additionalModelRequestFields, e.g. Nova's
   * 'inferenceConfig.topK' -> { inferenceConfig: { topK: … } }.
   */
  fieldName?: string;
  description?: string;
}

// GROUP 1 — inference capabilities: presence in the map = supported.
export interface InferenceCapabilities {
  maxTokens: ParameterSpec; // required for every model
  temperature?: ParameterSpec;
  topP?: ParameterSpec;
  topK?: ParameterSpec;
  stopSequences?: ParameterSpec;
}

// GROUP 2 — general feature capabilities.
export interface FeatureCapabilities {
  streaming: boolean;
  systemPrompt: boolean;
  vision: boolean;
  documentChat: boolean;
  toolUse: boolean;
}

export interface ModelDefinition {
  modelId: string;
  /** informational only — NEVER branched on */
  provider: string;
  displayName: string;
  description?: string;
  /** override when the model isn't available in the default region */
  region?: string;
  contextWindowTokens?: number;
  capabilities: {
    inference: InferenceCapabilities;
    features: FeatureCapabilities;
  };
  /** quirks (mutual exclusivity, format issues, unverified data) */
  notes?: string[];
}

export function supportsParam(
  m: ModelDefinition,
  k: keyof InferenceCapabilities
): boolean {
  return m.capabilities.inference[k] !== undefined;
}

export function supportsFeature(
  m: ModelDefinition,
  k: keyof FeatureCapabilities
): boolean {
  return m.capabilities.features[k];
}

export function getParamSpec(
  m: ModelDefinition,
  k: keyof InferenceCapabilities
): ParameterSpec | undefined {
  return m.capabilities.inference[k];
}
