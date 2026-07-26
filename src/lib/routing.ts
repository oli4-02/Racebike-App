import { routing, type AppLocale } from "@/i18n/routing";
import { ROUTING_STRINGS } from "./i18nStrings";
import type { LatLon } from "./types";

// Replaces the public OSRM demo server (routing.openstreetmap.de), whose
// documented 1-request/second fair-use limit caused repeated production
// failures once roundtrip planning started routing several variants
// concurrently -- no amount of client-side throttling around a shared,
// free demo instance fully avoids that ceiling. OpenRouteService is a
// managed API with its own (much higher) rate limits and no server for us
// to run or maintain; "cycling-regular" is its general-purpose bike
// profile, the closest match to OSRM's generic bike backend.
const ORS_BASE = "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson";

function apiKey(locale: AppLocale): string {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error(ROUTING_STRINGS[locale].apiKeyMissing);
  return key;
}

// OpenRouteService's free tier is documented around 40 requests/minute --
// far more headroom than OSRM's old 1/s, but still a real ceiling that
// planRoundTripAlternatives' 5 concurrent variants (each issuing several
// requests across the refine loop) could burst past without pacing. Same
// shared-queue design as before, just tuned to this API's limit instead of
// removed outright.
const MIN_REQUEST_INTERVAL_MS = 1500;
let earliestNextRequestAt = 0;
let throttleQueue: Promise<void> = Promise.resolve();

function throttledRoutingSlot(): Promise<void> {
  const slot = throttleQueue.then(async () => {
    const waitMs = earliestNextRequestAt - Date.now();
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    earliestNextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });
  throttleQueue = slot.catch(() => {});
  return slot;
}

export type OsrmLeg = {
  distanceM: number;
  durationS: number;
  geometry: LatLon[];
};

type OrsStep = { distance: number; duration: number; way_points: [number, number] };
type OrsSegment = { distance: number; duration: number; steps: OrsStep[] };
type OrsFeature = {
  properties: { segments: OrsSegment[] };
  geometry: { coordinates: [number, number][] };
};
type OrsResponse = { features?: OrsFeature[]; error?: { message?: string } | string };

async function requestDirections(
  points: LatLon[],
  timeoutMs: number,
  locale: AppLocale
): Promise<OrsResponse> {
  await throttledRoutingSlot();
  const res = await fetch(ORS_BASE, {
    method: "POST",
    headers: {
      Authorization: apiKey(locale),
      "Content-Type": "application/json",
      Accept: "application/geo+json",
    },
    body: JSON.stringify({ coordinates: points.map((p) => [p.lon, p.lat]) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data: OrsResponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : (data.error?.message ?? null);
    throw new Error(ROUTING_STRINGS[locale].httpError(res.status, message));
  }
  if (!data.features?.length) {
    throw new Error(ROUTING_STRINGS[locale].httpError(res.status, "no route in response"));
  }
  return data;
}

/** Slices a feature's shared LineString into one geometry array per segment, using each segment's steps' way_points ranges. */
function legsFromFeature(feature: OrsFeature): OsrmLeg[] {
  const coords = feature.geometry.coordinates;
  return feature.properties.segments.map((segment) => {
    if (segment.steps.length === 0) {
      return { distanceM: segment.distance, durationS: segment.duration, geometry: [] };
    }
    const startIdx = segment.steps[0].way_points[0];
    const endIdx = segment.steps[segment.steps.length - 1].way_points[1];
    const geometry: LatLon[] = coords
      .slice(startIdx, endIdx + 1)
      .map(([lon, lat]) => ({ lat, lon }));
    return { distanceM: segment.distance, durationS: segment.duration, geometry };
  });
}

/** Routes a single leg between two points, following the paved cycling network. */
export async function routeLeg(a: LatLon, b: LatLon, locale: AppLocale = routing.defaultLocale): Promise<OsrmLeg> {
  const data = await requestDirections([a, b], 20000, locale);
  const [leg] = legsFromFeature(data.features![0]);
  return leg;
}

/**
 * Routes a full chain of waypoints in a single request instead of one per
 * leg. Each of the response's `segments` corresponds to one leg between
 * consecutive input points, with its own distance/duration; slicing the
 * single shared LineString geometry by each segment's steps' way_points
 * ranges reconstructs the per-leg geometry the rest of the app needs for
 * the tailwind-colored polyline segments.
 */
export async function routeChain(points: LatLon[], locale: AppLocale = routing.defaultLocale): Promise<OsrmLeg[]> {
  if (points.length < 2) return [];
  const data = await requestDirections(points, 25000, locale);
  return legsFromFeature(data.features![0]);
}
