import { NextRequest, NextResponse } from "next/server";
import { combineGeometry, planRoute, toRouteLegs } from "@/lib/routePlanner";
import { routeChain } from "@/lib/osrm";
import {
  evaluateWindDirection,
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
} from "@/lib/wind";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { PlanRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: PlanRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  if (!body?.start || !body?.mode || !body?.distanceKm || !body?.date) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (body.mode === "oneway" && !body.destination) {
    return NextResponse.json(
      { error: "Für eine One-Way-Tour wird ein Ziel benötigt." },
      { status: 400 }
    );
  }

  const priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };

  try {
    let route = await planRoute({ ...body, priorities });

    if (isWithinForecastRange(body.date)) {
      const forecast = await fetchWindForecast(body.start, body.date);
      if (forecast.length > 0) {
        const wind = representativeDaytimeWind(forecast);
        route = { ...route, windInfo: wind };

        if (body.mode === "roundtrip") {
          const windLegs = route.legs.map((l) => ({
            from: l.from,
            to: l.to,
            distanceM: l.distanceM,
          }));
          const evaluation = evaluateWindDirection(
            windLegs,
            wind.directionDeg,
            wind.speedKmh,
            priorities.tailwind
          );

          if (evaluation.chosenDirection === "reverse") {
            const reversedNodes = [...route.knooppunten].reverse();
            const sequence = [body.start, ...reversedNodes, body.start];
            const osrmLegs = await routeChain(sequence);
            route = {
              ...route,
              knooppunten: reversedNodes,
              legs: toRouteLegs(sequence, osrmLegs),
              geometry: combineGeometry(osrmLegs),
              totalDistanceM: osrmLegs.reduce((s, l) => s + l.distanceM, 0),
              totalDurationS: osrmLegs.reduce((s, l) => s + l.durationS, 0),
            };
          }

          route = { ...route, wind: evaluation };
        }
      }
    }

    return NextResponse.json(route);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Routenplanung fehlgeschlagen.",
      },
      { status: 502 }
    );
  }
}
