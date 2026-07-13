'use client';

import { Badge } from '@/components/ui/badge';
import type { ClientModel } from '@/lib/chat/protocol';

const FEATURE_BADGES: { key: 'vision' | 'documentChat' | 'toolUse'; label: string }[] = [
  { key: 'vision', label: 'Vision' },
  { key: 'documentChat', label: 'Documents' },
  { key: 'toolUse', label: 'Tool Use' },
];

export function InfoPanel({ model }: { model: ClientModel }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-[6rem_1fr] gap-y-1.5">
        <span className="text-muted-foreground">Provider</span>
        <span>{model.provider}</span>
        <span className="text-muted-foreground">Region</span>
        <span className="font-mono text-xs leading-5">{model.resolvedRegion}</span>
        <span className="text-muted-foreground">Model ID</span>
        <span className="break-all font-mono text-xs leading-5">{model.modelId}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FEATURE_BADGES.map(({ key, label }) => (
          <Badge
            key={key}
            variant={model.capabilities.features[key] ? 'default' : 'outline'}
            className={
              model.capabilities.features[key] ? '' : 'text-muted-foreground line-through'
            }
          >
            {label}
          </Badge>
        ))}
      </div>
      {model.notes && model.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {model.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
