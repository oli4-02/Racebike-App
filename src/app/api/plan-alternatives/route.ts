import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { planRoundTripAlternatives } from "@/lib/routePlanner";
import { resolveLocale } from "@/lib/resolveLocale";
import {
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
} from "@/lib/wind";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { PlanRequest, RoundTripAlternative } from "@/lib/types";

const ALTERNATIVE_COUNT = 5;

const DIRECTION_LABEL_KEYS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

function directionLabelKey(direction: number): (typeof DIRECTION_LABEL_KEYS)[number] {
  const index = Math.round(((direction % 360) / 45)) % 8;
  return DIRECTION_LABEL_KEYS[index];
}

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
  const tDirections = await getTranslations({ locale, namespace: "planner.form.directions" });

  if (!body?.start || !body?.distanceKm || !body?.date) {
    return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });
  }

  const priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };

  try {
    const windInfo =
      isWithinForecastRange(body.date)
        ? await fetchWindForecast(body.start, body.date)
            .then((f) => (f.length > 0 ? representativeDaytimeWind(f) : null))
            .catch(() => null)
        : null;

    const results = await planRoundTripAlternatives(
      { ...body, mode: "roundtrip", priorities, locale },
      ALTERNATIVE_COUNT
    );

    const alternatives: RoundTripAlternative[] = results.map(({ direction, route }) => ({
      direction,
      directionLabel:
        direction === null ? tDirections("any") : tDirections(directionLabelKey(direction)),
      route: windInfo ? { ...route, windInfo } : route,
    }));

    return NextResponse.json({ alternatives });
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
