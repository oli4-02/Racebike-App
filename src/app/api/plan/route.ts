import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { applyWindEvaluation, planRoute } from "@/lib/routePlanner";
import { resolveLocale } from "@/lib/resolveLocale";
import { fetchWindForecast, isWithinForecastRange, representativeDaytimeWind } from "@/lib/wind";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { PlanRequest } from "@/lib/types";

// Vercel's default serverless function limit (10s) is well under what a
// route plan can take once you count the Overpass pool/feature fetch, the
// OSRM routing + up to 3 refine-loop reroutes, and the wind evaluation's
// own possible reroute -- without raising this, a genuinely slow plan gets
// killed mid-request by the platform itself, which the browser then shows
// as a bare network failure ("Load failed"/"Failed to fetch"/a bodyless
// 504) with none of this app's own, more helpful error messages, since the
// connection never got a response body at all. 120s (up from an initial,
// too-tight 60s) since this project has Fluid Compute enabled, which raises
// Vercel's own ceiling to 300s -- confirmed after a 504 with no app-level
// error body surfaced in production even after the Overpass/OSRM
// reliability fixes below made the underlying calls themselves succeed;
// their combined worst-case latency still occasionally exceeded the old 60s
// budget.
export const maxDuration = 120;

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
