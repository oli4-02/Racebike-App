import { NextRequest, NextResponse } from "next/server";
import { SCENIC_CORRIDORS } from "@/lib/scenicCorridors";
import { fetchAreaFeatures, fetchTowns, type AreaFeatures } from "@/lib/overpass";
import { planRoute } from "@/lib/routePlanner";
import { buildTrainInfo, findNearestStation, isNsConfigured } from "@/lib/ns";
import { bearing, distance } from "@/lib/geo";
import {
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
  tailwindComponent,
} from "@/lib/wind";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { LatLon, Priorities, StationInfo } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: {
    corridorId: string;
    start: LatLon;
    distanceKm: number;
    date: string;
    priorities?: Priorities;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body?.corridorId || !body?.start || !body?.distanceKm || !body?.date) {
    return NextResponse.json(
      { error: "corridorId, start, distanceKm und date erforderlich." },
      { status: 400 }
    );
  }

  const corridor = SCENIC_CORRIDORS.find((c) => c.id === body.corridorId);
  if (!corridor) {
    return NextResponse.json({ error: "Unbekannter Korridor." }, { status: 404 });
  }

  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };
  const targetDistanceM = body.distanceKm * 1000;
  const searchRadiusM = corridor.radiusKm * 1000;
  const nsConfigured = isNsConfigured();

  try {
    const [entryStationRaw, homeStationRaw, windInfo, towns, areaFeatures] = await Promise.all([
      nsConfigured ? findNearestStation(corridor.center).catch(() => null) : Promise.resolve(null),
      nsConfigured ? findNearestStation(body.start).catch(() => null) : Promise.resolve(null),
      isWithinForecastRange(body.date)
        ? fetchWindForecast(corridor.center, body.date)
            .then((f) => (f.length > 0 ? representativeDaytimeWind(f) : null))
            .catch(() => null)
        : Promise.resolve(null),
      fetchTowns(corridor.center, searchRadiusM),
      fetchAreaFeatures(corridor.center, searchRadiusM),
    ]);

    const entryPoint: LatLon = entryStationRaw ?? corridor.center;
    const entryStation: StationInfo = entryStationRaw ?? {
      name: corridor.entryStationName,
      lat: corridor.center.lat,
      lon: corridor.center.lon,
    };
    const homeStation: StationInfo = homeStationRaw ?? {
      name: "Start",
      lat: body.start.lat,
      lon: body.start.lon,
    };

    const exitTown = pickExitCandidate(
      corridor.center,
      searchRadiusM,
      entryPoint,
      towns,
      targetDistanceM,
      priorities,
      areaFeatures,
      windInfo
    );
    if (!exitTown) {
      return NextResponse.json(
        {
          error:
            "Kein geeigneter Zielort innerhalb des Korridors gefunden. Bitte einen anderen Korridor oder eine andere Distanz wählen.",
        },
        { status: 502 }
      );
    }

    const route = await planRoute({
      start: entryPoint,
      mode: "oneway",
      distanceKm: body.distanceKm,
      date: body.date,
      priorities,
      destination: exitTown,
    });
    if (windInfo) route.windInfo = windInfo;

    const exitStationRaw = nsConfigured
      ? await findNearestStation(exitTown).catch(() => null)
      : null;
    const exitStation: StationInfo = exitStationRaw ?? {
      name: exitTown.name,
      lat: exitTown.lat,
      lon: exitTown.lon,
    };

    const [outboundTrain, returnTrain] = await Promise.all([
      buildTrainInfo(homeStation, entryStation, `${body.date}T08:30:00`, nsConfigured),
      buildTrainInfo(exitStation, homeStation, `${body.date}T16:00:00`, nsConfigured),
    ]);

    return NextResponse.json({
      corridor,
      route,
      entryStation,
      exitStation,
      outboundTrain,
      returnTrain,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Landschafts-Route fehlgeschlagen.",
      },
      { status: 502 }
    );
  }
}

/**
 * Scores candidate settlements within the corridor as a bike-route
 * endpoint: distance fit against the requested ride length, the same
 * priority-weighted traffic/nature/POI signals used elsewhere, and tailwind
 * alignment from the entry point. Requires the candidate to be reasonably
 * far from the entry point so the ride actually traverses the corridor.
 */
function pickExitCandidate(
  corridorCenter: LatLon,
  searchRadiusM: number,
  entryPoint: LatLon,
  towns: (LatLon & { name: string })[],
  targetDistanceM: number,
  priorities: Priorities,
  features: AreaFeatures,
  windInfo: { directionDeg: number; speedKmh: number } | null
): (LatLon & { name: string }) | null {
  const withinCorridor = towns.filter((t) => distance(corridorCenter, t) <= searchRadiusM);

  const minTraverseM = searchRadiusM * 0.5;
  let candidates = withinCorridor.filter((t) => distance(entryPoint, t) >= minTraverseM);
  if (candidates.length === 0) candidates = withinCorridor;
  if (candidates.length === 0) return null;

  const scored = candidates.map((t) => {
    const distFromEntry = distance(entryPoint, t);
    const distanceFit =
      1 - Math.min(1, Math.abs(distFromEntry - targetDistanceM) / targetDistanceM);

    const trafficCount = features.trafficPoints.filter((p) => distance(t, p) <= 300).length;
    const natureCount = [...features.waterPoints, ...features.greenPoints].filter(
      (p) => distance(t, p) <= 600
    ).length;
    const poiCount = features.poiPoints.filter((p) => distance(t, p) <= 500).length;

    const featureScore =
      priorities.fewTrafficLights * (1 / (1 + trafficCount)) +
      priorities.nature * Math.min(1, natureCount / 3) +
      priorities.poiDensity * Math.min(1, poiCount / 3);

    const tailwindScore = windInfo
      ? tailwindComponent(bearing(entryPoint, t), windInfo.directionDeg)
      : 0;

    const score =
      distanceFit * (1 + priorities.shortestTime) +
      featureScore +
      priorities.tailwind * tailwindScore;

    return { town: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].town;
}
