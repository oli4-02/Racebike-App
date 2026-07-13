"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { Priorities } from "@/lib/types";

const AXIS_KEYS: (keyof Priorities)[] = [
  "fewTrafficLights",
  "nature",
  "poiDensity",
  "shortestTime",
  "tailwind",
];

const SIZE = 220;
const CENTER = SIZE / 2;
const MAX_RADIUS = 78;
const GRID_RINGS = [0.25, 0.5, 0.75, 1];

function axisAngleRad(index: number): number {
  return ((-90 + index * (360 / AXIS_KEYS.length)) * Math.PI) / 180;
}

function axisUnit(index: number): { x: number; y: number } {
  const a = axisAngleRad(index);
  return { x: Math.cos(a), y: Math.sin(a) };
}

function pointFor(index: number, value: number): { x: number; y: number } {
  const u = axisUnit(index);
  return { x: CENTER + u.x * MAX_RADIUS * value, y: CENTER + u.y * MAX_RADIUS * value };
}

function ringPoints(value: number): string {
  return AXIS_KEYS.map((_, i) => {
    const p = pointFor(i, value);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/**
 * Interactive pentagon/radar chart for the 5 priority weights -- lets the
 * balance between them be read (and adjusted) at a glance instead of
 * comparing 5 separate percentages. Each vertex only moves along its own
 * fixed axis (standard radar-editor behavior): dragging projects the
 * pointer position onto that axis's direction vector rather than following
 * the cursor freely, since a vertex "off its spoke" wouldn't mean anything.
 */
export default function PriorityRadar({
  priorities,
  setPriorities,
}: {
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
}) {
  const t = useTranslations("planner.priorities");
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function valueFromPointer(index: number, clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return priorities[AXIS_KEYS[index]];
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * SIZE;
    const py = ((clientY - rect.top) / rect.height) * SIZE;
    const u = axisUnit(index);
    const dot = (px - CENTER) * u.x + (py - CENTER) * u.y;
    const raw = dot / MAX_RADIUS;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(clamped * 20) / 20; // snap to 5% steps
  }

  function updateFromPointer(index: number, clientX: number, clientY: number) {
    const value = valueFromPointer(index, clientX, clientY);
    setPriorities({ ...priorities, [AXIS_KEYS[index]]: value });
  }

  function handlePointerDown(index: number, e: React.PointerEvent<SVGCircleElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
    updateFromPointer(index, e.clientX, e.clientY);
  }

  function handlePointerMove(index: number, e: React.PointerEvent<SVGCircleElement>) {
    if (dragIndex !== index) return;
    updateFromPointer(index, e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent<SVGCircleElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragIndex(null);
  }

  const dataPolygon = AXIS_KEYS.map((key, i) => {
    const p = pointFor(i, priorities[key]);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <div className="px-8">
      <span className="mb-2 block text-sm font-medium">{t("title")}</span>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
        className="mx-auto block w-full max-w-[240px] touch-none select-none"
      >
        {GRID_RINGS.map((r) => (
          <polygon
            key={r}
            points={ringPoints(r)}
            fill="none"
            stroke="var(--meewind-border)"
            strokeWidth={1}
          />
        ))}
        {AXIS_KEYS.map((_, i) => {
          const p = pointFor(i, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke="var(--meewind-border)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={dataPolygon}
          fill="var(--meewind-accent)"
          fillOpacity={0.25}
          stroke="var(--meewind-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {AXIS_KEYS.map((key, i) => {
          const u = axisUnit(i);
          const labelPos = {
            x: CENTER + u.x * (MAX_RADIUS + 26),
            y: CENTER + u.y * (MAX_RADIUS + 16),
          };
          const anchor = u.x > 0.15 ? "start" : u.x < -0.15 ? "end" : "middle";
          const p = pointFor(i, priorities[key]);
          // Long labels ("Wenig Ampeln/Kreuzungen") wrap onto a second line
          // at the "/" so they don't bleed far past the chart horizontally.
          const lines = t(key).split("/").map((part, pi, arr) => (pi < arr.length - 1 ? `${part}/` : part));
          return (
            <g key={key}>
              <text x={labelPos.x} y={labelPos.y} textAnchor={anchor} className="fill-meewind-fg-muted text-[9px]">
                {lines.map((line, li) => (
                  <tspan key={li} x={labelPos.x} dy={li === 0 ? 0 : 10}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 10 * lines.length + 1}
                textAnchor={anchor}
                className="fill-meewind-accent text-[9px] font-semibold"
              >
                {Math.round(priorities[key] * 100)}%
              </text>
              <circle
                cx={p.x}
                cy={p.y}
                r={9}
                fill="var(--meewind-accent)"
                stroke="var(--meewind-bg)"
                strokeWidth={2}
                className="cursor-pointer"
                onPointerDown={(e) => handlePointerDown(i, e)}
                onPointerMove={(e) => handlePointerMove(i, e)}
                onPointerUp={handlePointerUp}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
