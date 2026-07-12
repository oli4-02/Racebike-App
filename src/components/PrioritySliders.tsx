"use client";

import { useTranslations } from "next-intl";
import type { Priorities } from "@/lib/types";

const CRITERIA_KEYS: (keyof Priorities)[] = [
  "fewTrafficLights",
  "nature",
  "poiDensity",
  "shortestTime",
  "tailwind",
];

export default function PrioritySliders({
  priorities,
  setPriorities,
}: {
  priorities: Priorities;
  setPriorities: (p: Priorities) => void;
}) {
  const t = useTranslations("planner.priorities");

  function update(key: keyof Priorities, value: number) {
    setPriorities({ ...priorities, [key]: value });
  }

  return (
    <div>
      <span className="block text-sm font-medium mb-2">{t("title")}</span>
      <div className="flex flex-col gap-3">
        {CRITERIA_KEYS.map((key) => (
          <div key={key}>
            <label className="flex justify-between text-xs text-meewind-fg-muted mb-1">
              <span>{t(key)}</span>
              <span>{Math.round(priorities[key] * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(priorities[key] * 100)}
              onChange={(e) => update(key, Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
