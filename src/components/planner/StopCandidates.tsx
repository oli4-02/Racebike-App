"use client";

import { useTranslations } from "next-intl";
import { routeFraction } from "@/lib/geo";
import type { PlannedRoute, POI, POICategory, StopRequest } from "@/lib/types";

const MAX_CANDIDATES = 4;

/** POIs of the requested category whose position along the route falls in [rangeStartPct, rangeEndPct], closest-to-the-window-center first. */
function candidatesFor(stop: StopRequest, pois: POI[], route: PlannedRoute): POI[] {
  const lo = stop.rangeStartPct / 100;
  const hi = stop.rangeEndPct / 100;
  const center = (lo + hi) / 2;

  return pois
    .filter((p) => p.category === stop.category)
    .map((p) => ({ poi: p, fraction: routeFraction(p, route.geometry) }))
    .filter(({ fraction }) => fraction >= lo && fraction <= hi)
    .sort((a, b) => Math.abs(a.fraction - center) - Math.abs(b.fraction - center))
    .slice(0, MAX_CANDIDATES)
    .map(({ poi }) => poi);
}

function StopCandidateRow({
  stop,
  index,
  pois,
  route,
  selectedPoiId,
  onSelect,
}: {
  stop: StopRequest;
  index: number;
  pois: POI[];
  route: PlannedRoute;
  selectedPoiId: number | undefined;
  onSelect: (poiId: number) => void;
}) {
  const t = useTranslations("planner.form");
  const categoryLabels: Record<POICategory, string> = {
    fuel: t("poiFuel"),
    supermarket: t("poiSupermarket"),
    ice_cream: t("poiIceCream"),
    cafe: t("poiCafe"),
  };
  const candidates = candidatesFor(stop, pois, route);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-meewind-border p-2.5">
      <span className="text-xs font-medium text-meewind-fg-muted">
        {t("stops.stopLabel", { n: index + 1 })}: {categoryLabels[stop.category]} (
        {stop.rangeStartPct}–{stop.rangeEndPct}%)
      </span>
      {candidates.length === 0 ? (
        <p className="text-xs text-meewind-fg-muted">{t("stops.noneFound")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {candidates.map((poi) => (
            <button
              key={poi.id}
              type="button"
              onClick={() => onSelect(poi.id)}
              className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                selectedPoiId === poi.id
                  ? "border-meewind-accent bg-meewind-accent/15"
                  : "border-meewind-border"
              }`}
            >
              {poi.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function routeIdentity(route: PlannedRoute): string {
  const first = route.geometry[0];
  const last = route.geometry[route.geometry.length - 1];
  return `${route.geometry.length}-${first?.lat}-${first?.lon}-${last?.lat}-${last?.lon}`;
}

export default function StopCandidates({
  route,
  pois,
  stopRequests,
  selectedStopPoiIds,
  onSelectStopPoi,
}: {
  route: PlannedRoute;
  pois: POI[];
  stopRequests: StopRequest[];
  selectedStopPoiIds: Record<string, number>;
  onSelectStopPoi: (stopId: string, poiId: number) => void;
}) {
  const t = useTranslations("planner.form");
  if (stopRequests.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("stops.title")}</span>
      {stopRequests.map((stop, i) => (
        <StopCandidateRow
          key={`${routeIdentity(route)}-${stop.id}`}
          stop={stop}
          index={i}
          pois={pois}
          route={route}
          selectedPoiId={selectedStopPoiIds[stop.id]}
          onSelect={(poiId) => onSelectStopPoi(stop.id, poiId)}
        />
      ))}
    </div>
  );
}
