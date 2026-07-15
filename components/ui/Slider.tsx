'use client';

import { RotateCcw, Info } from 'lucide-react';

interface SliderProps {
  label: string;
  tooltip?: string;
  value: number | undefined;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}

export function Slider({
  label,
  tooltip,
  value,
  defaultValue,
  min,
  max,
  step,
  disabled,
  onChange,
  onReset,
}: SliderProps) {
  const current = value ?? defaultValue;
  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--fg)]">
          <span className="truncate">{label}</span>
          {tooltip && (
            <span className="tooltip tooltip-left shrink-0 text-[var(--fg-subtle)]" data-tip={tooltip}>
              <Info size={13} className="cursor-help" />
            </span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <input
            type="number"
            className="input input-xs w-14 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] text-right tabular-nums"
            value={current}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <button
            className="btn btn-ghost btn-xs btn-circle text-[var(--fg-subtle)] hover:text-[var(--fg)]"
            onClick={onReset}
            aria-label={`Reset ${label}`}
            title="Reset to default"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
      <input
        type="range"
        className="range range-primary range-xs w-full"
        value={current}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
