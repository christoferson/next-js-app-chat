'use client';

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import type { UiMessage } from '@/lib/chat/use-chat';
import { cn } from '@/lib/utils';

const STOP_REASON_NOTICES: Record<string, string> = {
  max_tokens: 'Generation stopped: increase Max Tokens to allow longer replies.',
  stop_sequence: 'Generation stopped: a stop sequence was matched.',
  guardrail_intervened: 'Generation stopped by a guardrail.',
  content_filtered: 'Generation stopped: content was filtered.',
  refusal: 'The model declined to complete this response (content classifier).',
  model_context_window_exceeded:
    'Generation stopped: the context window limit was reached.',
  malformed_model_output: 'Generation stopped: the model produced malformed output.',
};

function UsageFooter({ message }: { message: UiMessage }) {
  const u = message.usage;
  if (!u) return null;
  return (
    <div className="mt-1.5 text-xs text-muted-foreground">
      {u.inputTokens ?? '–'} in · {u.outputTokens ?? '–'} out ·{' '}
      {u.totalTokens ?? '–'} total
      {u.latencyMs !== undefined ? ` · ${(u.latencyMs / 1000).toFixed(2)}s` : ''}
    </div>
  );
}

function StopReasonNotice({ stopReason }: { stopReason?: string }) {
  if (!stopReason || stopReason === 'end_turn') return null;
  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
      {STOP_REASON_NOTICES[stopReason] ?? `Generation stopped: ${stopReason}`}
    </div>
  );
}

export function MessageList({
  messages,
  isStreaming,
}: {
  messages: UiMessage[];
  isStreaming: boolean;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Send a message to start chatting.
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((message, i) => {
        const isUser = message.role === 'user';
        const isLast = i === messages.length - 1;
        return (
          <div
            key={i}
            className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.text}</div>
              ) : (
                <>
                  {message.text ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-zinc-900 [&_pre]:p-3 [&_pre]:text-zinc-100 [&_code]:text-[0.85em]">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  ) : isLast && isStreaming && !message.error ? (
                    <span className="animate-pulse text-muted-foreground">…</span>
                  ) : null}
                  {message.error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <span className="font-medium">{message.error.code}:</span>{' '}
                      {message.error.message}
                    </div>
                  )}
                  <StopReasonNotice stopReason={message.stopReason} />
                  <UsageFooter message={message} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
