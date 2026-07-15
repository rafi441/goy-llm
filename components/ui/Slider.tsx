'use client';

import { RotateCcw } from 'lucide-react';

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
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm text-[var(--fg)]">
          {label}
          {tooltip && (
            <span className="tooltip tooltip-right text-[var(--fg-subtle)]" data-tip={tooltip}>
              <span className="cursor-help text-xs">ⓘ</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="input input-xs w-20 border-[var(--border)] bg-[var(--bg)] text-right"
            value={current}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <button
            className="btn btn-ghost btn-xs btn-circle text-[var(--fg-subtle)]"
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
        className="range range-primary range-xs"
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
