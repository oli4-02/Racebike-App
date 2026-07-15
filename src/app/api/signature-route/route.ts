import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { signatureRoutesForLocale } from "@/lib/signatureRoutes";
import { planRoute } from "@/lib/routePlanner";
import { buildTrainInfo, findNearestStation, isNsConfigured } from "@/lib/ns";
import { resolveLocale } from "@/lib/resolveLocale";
import { distance } from "@/lib/geo";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { LatLon, Priorities, StationInfo } from "@/lib/types";

// See /api/plan/route.ts -- chains NS lookups with planRoute()'s own
// Overpass/OSRM/refine work, which can add up past Vercel's default timeout.
export const maxDuration = 60;

// Beyond this distance from the signature route's own region, riding there
// directly stops being reasonable and an NS connection to the route's
// nearest station is suggested instead; within it, the user just starts
// pedaling from their own location.
const FAR_THRESHOLD_M = 25000;

export async function POST(req: NextRequest) {
  let body: {
    routeId: string;
    start: LatLon;
    distanceKm: number;
    date: string;
    priorities?: Priorities;
    avgSpeedKmh?: number;
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

  if (!body?.routeId || !body?.start || !body?.distanceKm || !body?.date) {
    return NextResponse.json(
      { error: t("routeFieldsRequired") },
      { status: 400 }
    );
  }

  const signatureRoute = signatureRoutesForLocale(locale).find((r) => r.id === body.routeId);
  if (!signatureRoute) {
    return NextResponse.json({ error: t("unknownSignatureRoute") }, { status: 404 });
  }

  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...body.priorities };
  const nsConfigured = isNsConfigured();
  const useStation = distance(body.start, signatureRoute.center) > FAR_THRESHOLD_M;

  try {
    let anchor: LatLon;
    let station: StationInfo | null = null;
    let outboundTrain = null;
    let returnTrain = null;

    if (useStation) {
      const [stationRaw, homeStationRaw] = await Promise.all([
        nsConfigured
          ? findNearestStation(signatureRoute.center, locale).catch(() => null)
          : Promise.resolve(null),
        nsConfigured
          ? findNearestStation(body.start, locale).catch(() => null)
          : Promise.resolve(null),
      ]);

      station = stationRaw ?? {
        name: signatureRoute.startRegionName,
        lat: signatureRoute.center.lat,
        lon: signatureRoute.center.lon,
      };
      const homeStation: StationInfo = homeStationRaw ?? {
        name: "Start",
        lat: body.start.lat,
        lon: body.start.lon,
      };
      anchor = station;

      [outboundTrain, returnTrain] = await Promise.all([
        buildTrainInfo(homeStation, station, `${body.date}T08:30:00`, nsConfigured, locale),
        buildTrainInfo(station, homeStation, `${body.date}T16:00:00`, nsConfigured, locale),
      ]);
    } else {
      anchor = body.start;
    }

    const route = await planRoute({
      start: anchor,
      mode: "roundtrip",
      distanceKm: body.distanceKm,
      date: body.date,
      priorities,
      avgSpeedKmh: body.avgSpeedKmh,
      locale,
    });

    return NextResponse.json({
      signatureRoute,
      route,
      usedStation: useStation,
      station,
      outboundTrain,
      returnTrain,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : t("signatureRouteFailed"),
      },
      { status: 502 }
    );
  }
}
