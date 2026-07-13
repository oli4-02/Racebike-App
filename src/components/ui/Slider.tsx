"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Styled replacement for a native <input type="range"> -- gradient-filled
 * track (via a CSS custom property so the fill percentage can be set
 * without touching pseudo-elements from JS) and an oversized, accent-colored
 * thumb, cross-browser (WebKit's track/thumb pseudo-elements need the fill
 * gradient; Firefox's ::-moz-range-progress already paints the filled part
 * itself, so it only needs flat colors).
 */
export default function Slider({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  valueLabel,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: ReactNode;
  valueLabel: ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium mb-2">
        <span>{label}</span>
        <span className="text-meewind-accent font-semibold tabular-nums">{valueLabel}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--slider-pct": `${pct}%` } as CSSProperties}
        className="
          h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent
          focus:outline-none
          [&::-webkit-slider-runnable-track]:h-2
          [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--meewind-accent)_var(--slider-pct),var(--meewind-border)_var(--slider-pct))]
          [&::-webkit-slider-thumb]:mt-[-6px]
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-meewind-bg
          [&::-webkit-slider-thumb]:bg-meewind-accent
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:transition-transform
          hover:[&::-webkit-slider-thumb]:scale-110
          [&::-moz-range-track]:h-2
          [&::-moz-range-track]:rounded-full
          [&::-moz-range-track]:bg-meewind-border
          [&::-moz-range-progress]:h-2
          [&::-moz-range-progress]:rounded-full
          [&::-moz-range-progress]:bg-meewind-accent
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-meewind-bg
          [&::-moz-range-thumb]:bg-meewind-accent
        "
      />
    </div>
  );
}
