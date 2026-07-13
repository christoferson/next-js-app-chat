'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Info, Send, Settings2, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MessageList } from '@/components/chat/message-list';
import {
  SettingsPanel,
  type ParameterState,
} from '@/components/settings/settings-panel';
import { InfoPanel } from '@/components/settings/info-panel';
import { useChat } from '@/lib/chat/use-chat';
import type { ClientModel, ModelsResponse } from '@/lib/chat/protocol';
import type { ParameterSpec } from '@/lib/models/types';

function defaultParameters(model: ClientModel): ParameterState {
  const state: ParameterState = {};
  for (const [key, spec] of Object.entries(model.capabilities.inference) as [
    string,
    ParameterSpec,
  ][]) {
    if (spec.default !== null) state[key] = spec.default;
  }
  return state;
}

/** Carry over compatible values on model switch; out-of-range or unsupported
 *  values reset to the new model's defaults. */
function migrateParameters(
  previous: ParameterState,
  model: ClientModel
): ParameterState {
  const next = defaultParameters(model);
  for (const [key, spec] of Object.entries(model.capabilities.inference) as [
    string,
    ParameterSpec,
  ][]) {
    const prev = previous[key];
    if (prev === undefined) continue;
    if (typeof prev === 'number') {
      if (
        (spec.min === undefined || prev >= spec.min) &&
        (spec.max === undefined || prev <= spec.max)
      ) {
        next[key] = prev;
      }
    } else {
      next[key] = prev;
    }
  }
  return next;
}

export function ChatApp() {
  const [models, setModels] = useState<ClientModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [parameters, setParameters] = useState<ParameterState>({});
  const [systemPrompt, setSystemPrompt] = useState('');
  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { messages, isStreaming, send, stop, clear } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data: ModelsResponse) => {
        setModels(data.models);
        const initial =
          data.models.find((m) => m.modelId === data.defaults.modelId) ??
          data.models[0];
        if (initial) {
          setSelectedModelId(initial.modelId);
          setParameters(defaultParameters(initial));
        }
        setSystemPrompt(data.defaults.systemPrompt);
      })
      .catch(() => setLoadError('Failed to load the model registry.'));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedModel = useMemo(
    () => models.find((m) => m.modelId === selectedModelId),
    [models, selectedModelId]
  );

  const handleSelectModel = useCallback(
    (modelId: string) => {
      const model = models.find((m) => m.modelId === modelId);
      if (!model) return;
      setSelectedModelId(modelId);
      setParameters((prev) => migrateParameters(prev, model));
    },
    [models]
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming || !selectedModel) return;
    setInput('');
    const cleanParameters: Record<string, number | string[]> = {};
    for (const [k, v] of Object.entries(parameters)) {
      if (v !== undefined) cleanParameters[k] = v;
    }
    void send(text, {
      modelId: selectedModel.modelId,
      system: selectedModel.capabilities.features.systemPrompt
        ? systemPrompt.trim() || undefined
        : undefined,
      parameters: cleanParameters,
    });
  }, [input, isStreaming, selectedModel, parameters, systemPrompt, send]);

  if (loadError) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-destructive">
        {loadError}
      </div>
    );
  }
  if (!selectedModel) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading models…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-6xl gap-4 p-4">
      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="text-sm font-medium">
            Bedrock Chat
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {selectedModel.displayName}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={messages.length === 0}
          >
            <Trash2 className="size-4" /> Clear
          </Button>
        </header>

        <MessageList messages={messages} isStreaming={isStreaming} />
        <div ref={bottomRef} />

        <footer className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={input}
              placeholder="Message… (Enter to send, Shift+Enter for newline)"
              className="resize-none"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {isStreaming ? (
              <Button variant="destructive" onClick={stop} title="Stop generation">
                <Square className="size-4" /> Stop
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!input.trim()} title="Send">
                <Send className="size-4" /> Send
              </Button>
            )}
          </div>
        </footer>
      </div>

      {/* Side panels */}
      <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto md:flex">
        <Collapsible
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          className="rounded-lg border"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Settings2 className="size-4" /> Settings
            </span>
            <ChevronDown
              className={`size-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-4 py-3">
            <SettingsPanel
              models={models}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              parameters={parameters}
              onChangeParameter={(key, value) =>
                setParameters((prev) => ({ ...prev, [key]: value }))
              }
              systemPrompt={systemPrompt}
              onChangeSystemPrompt={setSystemPrompt}
            />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible
          open={infoOpen}
          onOpenChange={setInfoOpen}
          className="rounded-lg border"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Info className="size-4" /> Model Info
            </span>
            <ChevronDown
              className={`size-4 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-4 py-3">
            <InfoPanel model={selectedModel} />
          </CollapsibleContent>
        </Collapsible>
      </aside>
    </div>
  );
}
