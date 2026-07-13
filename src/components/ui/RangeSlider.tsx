"use client";

import type { ReactNode } from "react";

// Both underlying <input type="range"> elements are stacked over the same
// track and made fully transparent except for their thumb (pointer-events
// only re-enabled on the thumb pseudo-element) -- a standard technique for
// a dual-handle range slider without a extra dependency.
const THUMB_INPUT_CLASSES = `
  pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent focus:outline-none
  [&::-webkit-slider-runnable-track]:bg-transparent
  [&::-webkit-slider-thumb]:pointer-events-auto
  [&::-webkit-slider-thumb]:mt-[2px]
  [&::-webkit-slider-thumb]:h-5
  [&::-webkit-slider-thumb]:w-5
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:rounded-full
  [&::-webkit-slider-thumb]:border-2
  [&::-webkit-slider-thumb]:border-meewind-bg
  [&::-webkit-slider-thumb]:bg-meewind-accent
  [&::-webkit-slider-thumb]:shadow-md
  [&::-moz-range-track]:bg-transparent
  [&::-moz-range-thumb]:pointer-events-auto
  [&::-moz-range-thumb]:h-5
  [&::-moz-range-thumb]:w-5
  [&::-moz-range-thumb]:rounded-full
  [&::-moz-range-thumb]:border-2
  [&::-moz-range-thumb]:border-meewind-bg
  [&::-moz-range-thumb]:bg-meewind-accent
`;

/** Styled dual-handle range slider (e.g. "somewhere between 40% and 60% of the route"). */
export default function RangeSlider({
  min,
  max,
  step = 5,
  valueMin,
  valueMax,
  onChange,
  label,
  formatValue,
}: {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (valueMin: number, valueMax: number) => void;
  label: ReactNode;
  formatValue: (value: number) => string;
}) {
  const pctMin = ((valueMin - min) / (max - min)) * 100;
  const pctMax = ((valueMax - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="text-meewind-accent font-semibold tabular-nums">
          {formatValue(valueMin)} – {formatValue(valueMax)}
        </span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-meewind-border" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-meewind-accent"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax - step), valueMax)}
          className={THUMB_INPUT_CLASSES}
          aria-label="minimum"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin + step))}
          className={THUMB_INPUT_CLASSES}
          aria-label="maximum"
        />
      </div>
    </div>
  );
}
