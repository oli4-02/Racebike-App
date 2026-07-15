import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { NS_STRINGS } from "@/lib/i18nStrings";
import {
  buildTrainInfo,
  findNearestStation,
  isNsConfigured,
  nsNotConfiguredMessage,
} from "@/lib/ns";
import { resolveLocale } from "@/lib/resolveLocale";

// See /api/geocode/route.ts -- safety margin above Vercel's default timeout.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = resolveLocale(params.get("locale"));
  const t = await getTranslations({ locale, namespace: "api" });

  const nsConfigured = isNsConfigured();
  if (!nsConfigured) {
    return NextResponse.json({ configured: false, message: nsNotConfiguredMessage(locale) });
  }

  const destLat = Number(params.get("destLat"));
  const destLon = Number(params.get("destLon"));
  const homeLat = Number(params.get("homeLat"));
  const homeLon = Number(params.get("homeLon"));
  const dateTime = params.get("dateTime") ?? new Date().toISOString();

  if ([destLat, destLon, homeLat, homeLon].some((n) => Number.isNaN(n))) {
    return NextResponse.json(
      { error: t("stationFieldsRequired") },
      { status: 400 }
    );
  }

  try {
    const [destStation, homeStation] = await Promise.all([
      findNearestStation({ lat: destLat, lon: destLon }, locale),
      findNearestStation({ lat: homeLat, lon: homeLon }, locale),
    ]);

    if (!destStation || !homeStation) {
      return NextResponse.json({ error: NS_STRINGS[locale].noStationNearby }, { status: 404 });
    }

    const trainInfo = await buildTrainInfo(destStation, homeStation, dateTime, nsConfigured, locale);
    return NextResponse.json(trainInfo);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : NS_STRINGS[locale].queryFailed,
      },
      { status: 502 }
    );
  }
}
