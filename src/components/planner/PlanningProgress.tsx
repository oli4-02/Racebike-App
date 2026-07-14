"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const STEP_INTERVAL_MS = 1800;

/**
 * The backend doesn't stream real progress (Overpass/OSRM/Open-Meteo calls
 * are plain request/response, no partial updates), so this fakes a sense of
 * progress instead of leaving the rider staring at a static "Route wird
 * geplant..." label -- a slim bar that creeps towards (not all the way to)
 * full, plus rotating status text roughly matching what's actually
 * happening server-side. Remounts fresh each time loading starts (the
 * caller keys/conditionally-renders this), so local state doesn't need
 * resetting on its own.
 */
export default function PlanningProgress() {
  const t = useTranslations("planner.form.planningSteps");
  const steps = [t("nodes"), t("wind"), t("routing"), t("almostDone")];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [steps.length]);

  const pct = Math.min(92, ((stepIndex + 1) / steps.length) * 92);

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="h-1 w-full overflow-hidden rounded-full bg-meewind-border">
        <div
          className="h-full rounded-full bg-meewind-accent transition-[width] ease-out"
          style={{ width: `${pct}%`, transitionDuration: `${STEP_INTERVAL_MS}ms` }}
        />
      </div>
      <span className="text-xs text-meewind-fg-muted">{steps[stepIndex]}</span>
    </div>
  );
}
