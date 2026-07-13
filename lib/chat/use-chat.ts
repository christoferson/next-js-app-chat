'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, ChatStreamEvent } from '@/lib/chat/protocol';

export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export interface UiMessage {
  role: 'user' | 'assistant';
  text: string;
  usage?: UsageInfo;
  stopReason?: string;
  error?: { code: string; message: string };
}

export interface SendOptions {
  modelId: string;
  system?: string;
  parameters: Record<string, number | string[]>;
}

export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const send = useCallback(
    async (text: string, options: SendOptions) => {
      const userMessage: UiMessage = { role: 'user', text };
      // History replay: convert current UI messages (+ new one) to API shape.
      const history: ChatMessage[] = [...messagesRef.current, userMessage]
        .filter((m) => !m.error && m.text.length > 0)
        .map((m) => ({ role: m.role, content: [{ text: m.text }] }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: 'assistant', text: '' },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              ...(typeof patch === 'function' ? patch(last) : patch),
            };
          }
          return next;
        });
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            modelId: options.modelId,
            system: options.system || undefined,
            parameters: options.parameters,
            messages: history,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          patchAssistant({
            error: body?.error ?? {
              code: `HTTP${response.status}`,
              message: 'Request failed.',
            },
          });
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: ChatStreamEvent;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === 'delta') {
              patchAssistant((m) => ({ text: m.text + event.text }));
            } else if (event.type === 'stop') {
              patchAssistant({ stopReason: event.stopReason });
            } else if (event.type === 'metadata') {
              patchAssistant({
                usage: { ...event.usage, latencyMs: event.latencyMs },
              });
            } else if (event.type === 'error') {
              patchAssistant({
                error: { code: event.code, message: event.message },
              });
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          patchAssistant({
            error: {
              code: 'NetworkError',
              message: 'Connection failed — is the dev server running?',
            },
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  // Keep a ref of messages for history replay without re-creating send().
  const messagesRef = useRef<UiMessage[]>(messages);
  messagesRef.current = messages;

  return { messages, isStreaming, send, stop, clear };
}
