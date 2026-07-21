import { routing, type AppLocale } from "@/i18n/routing";
import { OSRM_STRINGS } from "./i18nStrings";
import type { LatLon } from "./types";

// Public OSRM demo instance with a bicycle routing profile.
// Note: OSRM's HTTP API requires a "profile" path segment, but the
// routing.openstreetmap.de demo servers are dedicated per-mode instances
// (routed-bike, routed-car, routed-foot) where that segment is a fixed
// label rather than a live profile switch — "driving" is the documented
// placeholder to use here regardless of the actual (bike) backend.
const OSRM_BASE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";

const OSRM_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "racebike-app/0.1 (personal cycling route planner; https://github.com/oli4-02/Racebike-App)",
};

// routing.openstreetmap.de's fair-use policy caps this demo server at one
// request per second -- planRoundTripAlternatives routes up to 5 variants
// concurrently (each with its own initial route plus refine-loop reroutes),
// which without this throttle fires several requests at the very same
// instant on every single roundtrip-alternatives search, not just
// occasionally. That's a hard violation of the documented limit, not a
// transient overload, so no amount of retrying elsewhere fixes it -- only
// serializing requests to actually stay under ~1/s does. This queues every
// call (single-leg or full-chain, from any caller) through one shared
// pacing gate.
const MIN_REQUEST_INTERVAL_MS = 1100;
let earliestNextRequestAt = 0;
let throttleQueue: Promise<void> = Promise.resolve();

function throttledOsrmSlot(): Promise<void> {
  const slot = throttleQueue.then(async () => {
    const waitMs = earliestNextRequestAt - Date.now();
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    earliestNextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });
  // Swallow so one failed wait (can't actually happen here, but defensively)
  // doesn't wedge the queue for every request queued after it.
  throttleQueue = slot.catch(() => {});
  return slot;
}

export type OsrmLeg = {
  distanceM: number;
  durationS: number;
  geometry: LatLon[];
};

/** Routes a single leg between two points, following the paved cycling network. */
export async function routeLeg(a: LatLon, b: LatLon, locale: AppLocale = routing.defaultLocale): Promise<OsrmLeg> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`;

  await throttledOsrmSlot();
  const res = await fetch(url, {
    headers: OSRM_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const bodySnippet = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `${OSRM_STRINGS[locale].httpError(res.status, res.statusText)}${
        bodySnippet ? `: ${bodySnippet}` : ""
      }`
    );
  }
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(OSRM_STRINGS[locale].noRoute(data.code ?? "unknown"));
  }

  const route = data.routes[0];
  const geometry: LatLon[] = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => ({ lat, lon })
  );

  return {
    distanceM: route.distance,
    durationS: route.duration,
    geometry,
  };
}

/**
 * Routes a full chain of waypoints in a single OSRM request instead of one
 * request per leg (previously sequential and, with the route-length refine
 * loop in routePlanner.ts able to re-route the whole growing chain up to
 * three more times, a major source of slow route planning). OSRM's `steps`
 * response gives each leg's own distance/duration plus turn-by-turn steps;
 * concatenating each leg's step geometries (dropping the duplicate point at
 * step boundaries, same trick used when combining legs into the full route)
 * reconstructs the per-leg geometry the rest of the app needs for the
 * tailwind-colored polyline segments.
 */
export async function routeChain(points: LatLon[], locale: AppLocale = routing.defaultLocale): Promise<OsrmLeg[]> {
  if (points.length < 2) return [];

  const coords = points.map((p) => `${p.lon},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=false&geometries=geojson&steps=true`;

  await throttledOsrmSlot();
  const res = await fetch(url, {
    headers: OSRM_HEADERS,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const bodySnippet = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `${OSRM_STRINGS[locale].httpError(res.status, res.statusText)}${
        bodySnippet ? `: ${bodySnippet}` : ""
      }`
    );
  }
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(OSRM_STRINGS[locale].noRoute(data.code ?? "unknown"));
  }

  type OsrmStep = { geometry: { coordinates: [number, number][] } };
  type OsrmRouteLeg = { distance: number; duration: number; steps: OsrmStep[] };

  return (data.routes[0].legs as OsrmRouteLeg[]).map((leg) => {
    const geometry: LatLon[] = [];
    leg.steps.forEach((step, i) => {
      const stepPoints: LatLon[] = step.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      geometry.push(...(i === 0 ? stepPoints : stepPoints.slice(1)));
    });
    return { distanceM: leg.distance, durationS: leg.duration, geometry };
  });
}
