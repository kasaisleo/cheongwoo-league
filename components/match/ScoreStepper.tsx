"use client";

interface ScoreStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  highlight?: boolean;
  max?: number;
  compact?: boolean;
}

export function ScoreStepper({ label, value, onChange, highlight, max, compact }: ScoreStepperProps) {
  const canIncrement = max === undefined || value < max;

  return (
    <div className="flex flex-col items-center gap-2">
      <p
        className={
          compact
            ? "text-[10px] font-semibold text-[color:var(--surface-muted)]"
            : "text-xs font-semibold text-[color:var(--surface-muted)]"
        }
      >
        {label}
      </p>
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className={
            compact
              ? "flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--control-border)] text-sm text-[color:var(--surface-muted)] active:bg-[color:var(--surface-bg-raised)]"
              : "flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--control-border)] text-lg text-[color:var(--surface-muted)] active:bg-[color:var(--surface-bg-raised)]"
          }
          aria-label={`${label} 점수 감소`}
        >
          −
        </button>
        <span
          className={`font-score text-center font-bold ${compact ? "w-7 text-lg" : "w-12 text-4xl"} ${
            highlight ? "text-[color:var(--control-border-focus)]" : "text-[color:var(--control-text)]"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => canIncrement && onChange(value + 1)}
          disabled={!canIncrement}
          className={
            compact
              ? "flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--control-border)] text-sm text-[color:var(--surface-muted)] active:bg-[color:var(--surface-bg-raised)] disabled:opacity-30"
              : "flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--control-border)] text-lg text-[color:var(--surface-muted)] active:bg-[color:var(--surface-bg-raised)] disabled:opacity-30"
          }
          aria-label={`${label} 점수 증가`}
        >
          +
        </button>
      </div>
    </div>
  );
}
