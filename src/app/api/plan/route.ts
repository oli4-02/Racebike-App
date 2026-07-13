import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { combineGeometry, durationFromSpeed, planRoute, toRouteLegs } from "@/lib/routePlanner";
import { routeChain } from "@/lib/osrm";
import { resolveLocale } from "@/lib/resolveLocale";
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
    const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
    const t = await getTranslations({ locale, namespace: "api" });
    return NextResponse.json({ error: t("invalidBody") }, { status: 400 });
  }

  const locale = resolveLocale(body.locale);
  const t = await getTranslations({ locale, namespace: "api" });

  if (!body?.start || !body?.mode || !body?.distanceKm || !body?.date) {
    return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });
  }
  if (body.mode === "oneway" && !body.destination) {
    return NextResponse.json(
      { error: t("onewayDestinationRequired") },
      { status: 400 }
    );
  }

  const priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };

  try {
    // The wind forecast only depends on the start point/date, not on the
    // route itself, so it can be fetched at the same time as planRoute()
    // runs its own Overpass/OSRM calls instead of waiting for it to finish
    // first -- one fewer network round trip on the critical path.
    const [route0, forecast] = await Promise.all([
      planRoute({ ...body, priorities, locale }),
      isWithinForecastRange(body.date) ? fetchWindForecast(body.start, body.date) : Promise.resolve([]),
    ]);
    let route = route0;

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
          priorities.tailwind,
          locale
        );

        // evaluateWindDirection() only reports "reverse" when it's
        // meaningfully better (not a coin-flip-close call), since re-routing
        // the reversed sequence costs another OSRM round trip.
        if (evaluation.chosenDirection === "reverse") {
          const reversedNodes = [...route.knooppunten].reverse();
          const sequence = [body.start, ...reversedNodes, body.start];
          const osrmLegs = await routeChain(sequence, locale);
          const reversedDistanceM = osrmLegs.reduce((s, l) => s + l.distanceM, 0);
          const reversedDurationS = osrmLegs.reduce((s, l) => s + l.durationS, 0);
          route = {
            ...route,
            knooppunten: reversedNodes,
            legs: toRouteLegs(sequence, osrmLegs),
            geometry: combineGeometry(osrmLegs),
            totalDistanceM: reversedDistanceM,
            totalDurationS: durationFromSpeed(reversedDistanceM, body.avgSpeedKmh, reversedDurationS),
          };
        }

        route = { ...route, wind: evaluation };
      }
    }

    return NextResponse.json(route);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : t("routePlanningFailed"),
      },
      { status: 502 }
    );
  }
}
