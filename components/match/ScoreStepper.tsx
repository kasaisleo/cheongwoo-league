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
      <p className={compact ? "text-[10px] font-semibold text-line-500" : "text-xs font-semibold text-line-600"}>
        {label}
      </p>
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className={
            compact
              ? "flex h-7 w-7 items-center justify-center rounded-full border border-line-200 text-sm text-line-600 active:bg-line-100"
              : "flex h-10 w-10 items-center justify-center rounded-full border border-line-200 text-lg text-line-600 active:bg-line-100"
          }
          aria-label={`${label} 점수 감소`}
        >
          −
        </button>
        <span
          className={`font-score text-center font-bold ${compact ? "w-7 text-lg" : "w-12 text-4xl"} ${
            highlight ? "text-clay-400" : "text-line-900"
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
              ? "flex h-7 w-7 items-center justify-center rounded-full border border-line-200 text-sm text-line-600 active:bg-line-100 disabled:opacity-30"
              : "flex h-10 w-10 items-center justify-center rounded-full border border-line-200 text-lg text-line-600 active:bg-line-100 disabled:opacity-30"
          }
          aria-label={`${label} 점수 증가`}
        >
          +
        </button>
      </div>
    </div>
  );
}
