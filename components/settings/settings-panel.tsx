'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ParameterControl,
  type ParameterValue,
} from '@/components/settings/parameter-control';
import type { ClientModel } from '@/lib/chat/protocol';
import type { InferenceCapabilities } from '@/lib/models/types';

export type ParameterState = Record<string, ParameterValue>;

interface Props {
  models: ClientModel[];
  selectedModel: ClientModel;
  onSelectModel: (modelId: string) => void;
  parameters: ParameterState;
  onChangeParameter: (key: string, value: ParameterValue) => void;
  systemPrompt: string;
  onChangeSystemPrompt: (value: string) => void;
}

export function SettingsPanel({
  models,
  selectedModel,
  onSelectModel,
  parameters,
  onChangeParameter,
  systemPrompt,
  onChangeSystemPrompt,
}: Props) {
  const inference = selectedModel.capabilities.inference;
  const systemSupported = selectedModel.capabilities.features.systemPrompt;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Model</Label>
        <Select
          value={selectedModel.modelId}
          onValueChange={(v) => v && onSelectModel(v as string)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.modelId} value={m.modelId}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel.description && (
          <p className="text-xs text-muted-foreground">
            {selectedModel.description}
            {selectedModel.contextWindowTokens
              ? ` Context: ${(selectedModel.contextWindowTokens / 1000).toLocaleString()}K tokens.`
              : ''}
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          rows={3}
          value={systemPrompt}
          disabled={!systemSupported}
          onChange={(e) => onChangeSystemPrompt(e.target.value)}
          placeholder={
            systemSupported ? 'Instructions for the model…' : undefined
          }
        />
        {!systemSupported && (
          <p className="text-xs text-muted-foreground">
            This model does not support system prompts — the field is disabled
            and nothing is sent.
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        {(Object.entries(inference) as [keyof InferenceCapabilities, NonNullable<InferenceCapabilities[keyof InferenceCapabilities]>][]).map(
          ([key, spec]) => (
            <ParameterControl
              key={`${selectedModel.modelId}:${key}`}
              paramKey={key}
              spec={spec}
              value={parameters[key]}
              onChange={(v) => onChangeParameter(key, v)}
            />
          )
        )}
      </div>
    </div>
  );
}
