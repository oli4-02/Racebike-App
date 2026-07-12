import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/routing";
import { DESTINATION_STRINGS } from "@/lib/i18nStrings";
import {
  fetchAreaFeatures,
  fetchTourismHistoricPoints,
  fetchTowns,
  type TownCandidate,
} from "@/lib/overpass";
import { fetchWikipediaInfo, type WikipediaInfo } from "@/lib/wikipedia";
import { routeLeg } from "@/lib/osrm";
import { findNearestStation, isNsConfigured } from "@/lib/ns";
import { resolveLocale } from "@/lib/resolveLocale";
import { bearing, distance } from "@/lib/geo";
import {
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
  tailwindComponent,
} from "@/lib/wind";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { DestinationSuggestion, LatLon, Priorities } from "@/lib/types";

const NEARBY_STATION_THRESHOLD_M = 3000;
const MAX_SUGGESTIONS = 4;
// Tourism/historic density and Wikipedia lookups cost one Overpass query and
// N HTTP calls respectively; cap how many in-range candidates go through that
// before ranking, since NL's town+village density can otherwise mean dozens.
const PRESCORE_CANDIDATE_CAP = 20;
const TOWN_CENTER_RADIUS_M = 900;
const PREVIEW_MAX_POINTS = 100;

// An absolute distance window around the target, not a percentage of it —
// a percentage-based window (e.g. the old [0.5x, 1.3x]) gets disproportionately
// wide for long rides and disproportionately narrow for short ones, and in
// areas with sparse place=town/village tagging it can come up empty even
// though perfectly good candidates exist just outside it. Widening in steps
// (15 -> 25 -> 40 km) instead of using the widest window right away keeps
// the common case tightly matched to the requested distance.
const DISTANCE_TOLERANCE_STEPS_M = [15000, 25000, 40000];

type Candidate = TownCandidate & { distFromStart: number };

export async function POST(req: NextRequest) {
  let body: {
    start: LatLon;
    distanceKm: number;
    date?: string;
    priorities?: Priorities;
    locale?: string;
  };
  try {
    body = await req.json();
  } catch {
    const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
    const t = await getTranslations({ locale, namespace: "api" });
    return NextResponse.json({ error: t("invalidBody") }, { status: 400 });
  }

  const locale = resolveLocale(body.locale);
  const t = await getTranslations({ locale, namespace: "api" });

  if (!body?.start || !body?.distanceKm) {
    return NextResponse.json({ error: t("startDistanceRequired") }, { status: 400 });
  }

  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };
  const targetDistanceM = body.distanceKm * 1000;
  const start = body.start;

  try {
    const windInfo =
      body.date && isWithinForecastRange(body.date)
        ? await fetchWindForecast(start, body.date)
            .then((f) => (f.length > 0 ? representativeDaytimeWind(f) : null))
            .catch(() => null)
        : null;

    const maxToleranceM = DISTANCE_TOLERANCE_STEPS_M[DISTANCE_TOLERANCE_STEPS_M.length - 1];
    const searchRadiusM = targetDistanceM + maxToleranceM;
    const towns = await fetchTowns(start, searchRadiusM, locale);
    const withDistance = towns.map((t) => ({ ...t, distFromStart: distance(start, t) }));

    let inRange: Candidate[] = [];
    for (const toleranceM of DISTANCE_TOLERANCE_STEPS_M) {
      inRange = withDistance.filter((t) => Math.abs(t.distFromStart - targetDistanceM) <= toleranceM);
      if (inRange.length > 0) break;
    }

    if (inRange.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Bound the expensive attractiveness lookups to the candidates closest
    // to the target distance; small villages among them can still win the
    // final ranking below if they score well on the other components.
    const preScored = inRange
      .map((t) => ({ ...t, distanceFit: distanceFitScore(t.distFromStart, targetDistanceM) }))
      .sort((a, b) => b.distanceFit - a.distanceFit)
      .slice(0, PRESCORE_CANDIDATE_CAP);

    const [tourismPoints, areaFeatures, wikiInfos] = await Promise.all([
      fetchTourismHistoricPoints(preScored, TOWN_CENTER_RADIUS_M, locale),
      fetchAreaFeatures(start, searchRadiusM, false, locale),
      Promise.all(preScored.map((c) => fetchWikipediaInfo(c.name))),
    ]);

    const ranked = preScored
      .map((c, i) => ({
        candidate: c,
        wiki: wikiInfos[i],
        score: scoreCandidate(
          c,
          wikiInfos[i],
          start,
          priorities,
          windInfo,
          tourismPoints,
          areaFeatures.waterPoints
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);

    const suggestions = await Promise.all(
      ranked.map(({ candidate, wiki }) => buildSuggestion(candidate, wiki, start, locale))
    );

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : t("destinationsFailed"),
      },
      { status: 502 }
    );
  }
}

function distanceFitScore(distFromStart: number, targetDistanceM: number): number {
  return 1 - Math.min(1, Math.abs(distFromStart - targetDistanceM) / targetDistanceM);
}

function tourismHistoricScore(candidate: LatLon, tourismPoints: LatLon[]): number {
  const count = tourismPoints.filter(
    (p) => distance(candidate, p) <= TOWN_CENTER_RADIUS_M
  ).length;
  return Math.min(1, count / 8);
}

function waterProximityScore(candidate: LatLon, waterPoints: LatLon[]): number {
  if (waterPoints.length === 0) return 0;
  const nearestM = Math.min(...waterPoints.map((p) => distance(candidate, p)));
  return 1 / (1 + nearestM / 1000);
}

function wikipediaScore(info: WikipediaInfo | null): number {
  if (!info) return 0;
  const lengthScore = Math.min(1, info.extract.length / 500);
  const languageScore = Math.min(1, info.languageCount / 40);
  return (lengthScore + languageScore) / 2;
}

/**
 * Attractiveness score replacing the old pure place=city/town size filter:
 * distance fit + tailwind alignment (as before), plus tourism/historic
 * density, water proximity, and a Wikipedia-based fame proxy. Weighted so a
 * small village can still win if it scores well on these.
 */
function scoreCandidate(
  candidate: Candidate & { distanceFit: number },
  wiki: WikipediaInfo | null,
  start: LatLon,
  priorities: Priorities,
  windInfo: { directionDeg: number; speedKmh: number } | null,
  tourismPoints: LatLon[],
  waterPoints: LatLon[]
): number {
  let tailwindScore = 0;
  if (windInfo) {
    tailwindScore = tailwindComponent(bearing(start, candidate), windInfo.directionDeg);
  }

  const attractiveness =
    0.8 * tourismHistoricScore(candidate, tourismPoints) +
    0.6 * waterProximityScore(candidate, waterPoints) +
    0.6 * wikipediaScore(wiki);

  return candidate.distanceFit + priorities.tailwind * tailwindScore + attractiveness;
}

async function buildSuggestion(
  town: Candidate,
  wiki: WikipediaInfo | null,
  start: LatLon,
  locale: AppLocale
): Promise<DestinationSuggestion> {
  const [station, preview] = await Promise.all([
    isNsConfigured() ? findNearestStation(town, locale).catch(() => null) : Promise.resolve(null),
    routeLeg(start, town, locale).catch(() => null),
  ]);

  const hasNearbyStation = Boolean(
    station && distance(town, station) <= NEARBY_STATION_THRESHOLD_M
  );
  const distanceKm = town.distFromStart / 1000;

  const parts = [truncate(wiki?.extract ?? null, 140), `${distanceKm.toFixed(0)} km`];
  if (hasNearbyStation) parts.push(DESTINATION_STRINGS[locale].stationOnSite);
  const reason = `${town.name} – ${parts.filter(Boolean).join(", ")}`;

  return {
    name: town.name,
    lat: town.lat,
    lon: town.lon,
    distanceKm,
    description: wiki?.extract ?? null,
    imageUrl: wiki?.imageUrl ?? null,
    hasNearbyStation,
    reason,
    previewGeometry: preview ? decimate(preview.geometry, PREVIEW_MAX_POINTS) : [],
  };
}

function decimate(points: LatLon[], maxPoints: number): LatLon[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0);
}

function truncate(text: string | null, maxLength: number): string | null {
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() + "…" : text;
}
