import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchRoadTypeBreakdown } from "@/lib/overpass";
import { resolveLocale } from "@/lib/resolveLocale";
import type { LatLon } from "@/lib/types";

// See /api/geocode/route.ts -- safety margin above Vercel's default timeout.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { geometry: LatLon[]; locale?: string };
  try {
    body = await req.json();
  } catch {
    const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
    const t = await getTranslations({ locale, namespace: "api" });
    return NextResponse.json({ error: t("invalidBody") }, { status: 400 });
  }

  const locale = resolveLocale(body.locale);
  const t = await getTranslations({ locale, namespace: "api" });

  if (!Array.isArray(body?.geometry) || body.geometry.length < 2) {
    return NextResponse.json({ error: t("geometryRequired") }, { status: 400 });
  }

  // Best-effort: Overpass failures here shouldn't read as a route-planning
  // error, just as "no breakdown available" for this ride.
  const result = await fetchRoadTypeBreakdown(body.geometry, locale).catch(() => null);
  return NextResponse.json({ breakdown: result?.breakdown ?? null, segments: result?.segments ?? [] });
}
