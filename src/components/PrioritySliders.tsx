"use client";

import type { Priorities } from "@/lib/types";

const CRITERIA: { key: keyof Priorities; label: string }[] = [
  { key: "fewTrafficLights", label: "Wenig Ampeln/Kreuzungen" },
  { key: "nature", label: "Viel Natur/Wasser" },
  { key: "poiDensity", label: "Viele Cafés/POIs" },
  { key: "shortestTime", label: "Kürzeste Zeit" },
  { key: "tailwind", label: "Maximaler Rückenwind" },
];

export default function PrioritySliders({
  priorities,
  setPriorities,
}: {
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
}) {
  function update(key: keyof Priorities, value: number) {
    setPriorities({ ...priorities, [key]: value });
  }

  return (
    <div>
      <span className="block text-sm font-medium mb-2">Prioritäten</span>
      <div className="flex flex-col gap-3">
        {CRITERIA.map((c) => (
          <div key={c.key}>
            <label className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
              <span>{c.label}</span>
              <span>{Math.round(priorities[c.key] * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(priorities[c.key] * 100)}
              onChange={(e) => update(c.key, Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
