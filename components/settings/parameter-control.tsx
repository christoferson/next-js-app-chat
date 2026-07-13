'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { ParameterSpec } from '@/lib/models/types';

export type ParameterValue = number | string[] | undefined;

interface Props {
  paramKey: string;
  spec: ParameterSpec;
  value: ParameterValue;
  onChange: (value: ParameterValue) => void;
}

/** One control per registry ParameterSpec: slider+number for numerics,
 *  comma-separated input for string lists. */
export function ParameterControl({ paramKey, spec, value, onChange }: Props) {
  const reset = () => onChange(spec.default ?? undefined);

  if (spec.type === 'stringList') {
    const listValue = Array.isArray(value) ? value.join(', ') : '';
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={paramKey} title={spec.description}>
            {spec.label}
          </Label>
          <ResetButton onClick={reset} />
        </div>
        <Input
          id={paramKey}
          placeholder="comma, separated, sequences"
          value={listValue}
          onChange={(e) => {
            const parts = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            onChange(parts.length > 0 ? parts : undefined);
          }}
        />
        {spec.description && (
          <p className="text-xs text-muted-foreground">{spec.description}</p>
        )}
      </div>
    );
  }

  const numeric = typeof value === 'number' ? value : undefined;
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  const sliderValue = numeric ?? (typeof spec.default === 'number' ? spec.default : min);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={paramKey} title={spec.description}>
          {spec.label}
          {numeric === undefined && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (not sent)
            </span>
          )}
        </Label>
        <ResetButton onClick={reset} />
      </div>
      <div className="flex items-center gap-3">
        <Slider
          min={min}
          max={max}
          step={spec.step ?? 1}
          value={[sliderValue]}
          onValueChange={(v: number | readonly number[]) => {
            const next = Array.isArray(v) ? v[0] : (v as number);
            onChange(next);
          }}
          className="flex-1"
        />
        <Input
          id={paramKey}
          type="number"
          min={min}
          max={max}
          step={spec.step ?? 1}
          value={numeric ?? ''}
          placeholder={spec.default === null ? 'unset' : String(spec.default)}
          className="w-24"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(undefined);
              return;
            }
            const parsed = spec.type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
            if (!Number.isNaN(parsed)) onChange(parsed);
          }}
        />
      </div>
      {spec.description && (
        <p className="text-xs text-muted-foreground">{spec.description}</p>
      )}
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-6"
      title="Reset to default"
      onClick={onClick}
    >
      <RotateCcw className="size-3.5" />
    </Button>
  );
}
