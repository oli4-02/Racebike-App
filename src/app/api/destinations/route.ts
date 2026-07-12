import { NextRequest, NextResponse } from "next/server";
import { fetchTowns, type TownCandidate } from "@/lib/overpass";
import { fetchWikipediaSummary } from "@/lib/wikipedia";
import { findNearestStation, isNsConfigured } from "@/lib/ns";
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

export async function POST(req: NextRequest) {
  let body: { start: LatLon; distanceKm: number; date?: string; priorities?: Priorities };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body?.start || !body?.distanceKm) {
    return NextResponse.json(
      { error: "start und distanceKm erforderlich." },
      { status: 400 }
    );
  }

  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };
  const targetDistanceM = body.distanceKm * 1000;

  try {
    const windInfo =
      body.date && isWithinForecastRange(body.date)
        ? await fetchWindForecast(body.start, body.date)
            .then((f) => (f.length > 0 ? representativeDaytimeWind(f) : null))
            .catch(() => null)
        : null;

    const towns = await fetchTowns(body.start, targetDistanceM * 1.3);
    const inRange = towns
      .map((t) => ({ ...t, distFromStart: distance(body.start, t) }))
      .filter(
        (t) =>
          t.distFromStart >= targetDistanceM * 0.5 &&
          t.distFromStart <= targetDistanceM * 1.3
      );

    if (inRange.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const scored = inRange
      .map((t) => ({
        ...t,
        score: scoreTown(t, body.start, targetDistanceM, priorities, windInfo),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);

    const suggestions = await Promise.all(scored.map((t) => buildSuggestion(t)));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Zielvorschläge fehlgeschlagen.",
      },
      { status: 502 }
    );
  }
}

function scoreTown(
  town: TownCandidate & { distFromStart: number },
  start: LatLon,
  targetDistanceM: number,
  priorities: Priorities,
  windInfo: { directionDeg: number; speedKmh: number } | null
): number {
  const distanceFit =
    1 - Math.min(1, Math.abs(town.distFromStart - targetDistanceM) / targetDistanceM);

  let tailwindScore = 0;
  if (windInfo) {
    const travelBearing = bearing(start, town);
    tailwindScore = tailwindComponent(travelBearing, windInfo.directionDeg);
  }

  return distanceFit + priorities.tailwind * tailwindScore;
}

async function buildSuggestion(
  town: TownCandidate & { distFromStart: number }
): Promise<DestinationSuggestion> {
  const [summary, station] = await Promise.all([
    fetchWikipediaSummary(town.name),
    isNsConfigured()
      ? findNearestStation(town).catch(() => null)
      : Promise.resolve(null),
  ]);

  const hasNearbyStation = Boolean(
    station && distance(town, station) <= NEARBY_STATION_THRESHOLD_M
  );
  const distanceKm = town.distFromStart / 1000;

  const parts = [truncate(summary?.extract ?? null, 140), `${distanceKm.toFixed(0)} km`];
  if (hasNearbyStation) parts.push("Bahnhof vor Ort");
  const reason = `${town.name} – ${parts.filter(Boolean).join(", ")}`;

  return {
    name: town.name,
    lat: town.lat,
    lon: town.lon,
    distanceKm,
    description: summary?.extract ?? null,
    imageUrl: summary?.imageUrl ?? null,
    hasNearbyStation,
    reason,
  };
}

function truncate(text: string | null, maxLength: number): string | null {
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() + "…" : text;
}
