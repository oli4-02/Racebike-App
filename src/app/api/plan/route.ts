import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { applyWindEvaluation, planRoute } from "@/lib/routePlanner";
import { resolveLocale } from "@/lib/resolveLocale";
import { fetchWindForecast, isWithinForecastRange, representativeDaytimeWind } from "@/lib/wind";
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
        route = await applyWindEvaluation(
          route,
          body.start,
          wind,
          priorities.tailwind,
          body.tailwindTiming,
          body.avgSpeedKmh,
          locale
        );
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
