"use client";

import { Button } from "@/components/ui/Button";

interface ScoreStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  highlight?: boolean;
}

export function ScoreStepper({ label, value, onChange, highlight }: ScoreStepperProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-line-600">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line-200 text-lg text-line-600 active:bg-line-100"
          aria-label={`${label} 점수 감소`}
        >
          −
        </button>
        <span
          className={`font-score w-12 text-center text-4xl font-bold ${
            highlight ? "text-clay-400" : "text-line-900"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line-200 text-lg text-line-600 active:bg-line-100"
          aria-label={`${label} 점수 증가`}
        >
          +
        </button>
      </div>
    </div>
  );
}
