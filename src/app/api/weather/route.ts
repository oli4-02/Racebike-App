import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveLocale } from "@/lib/resolveLocale";
import {
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
} from "@/lib/wind";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = resolveLocale(params.get("locale"));
  const t = await getTranslations({ locale, namespace: "api" });

  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const date = params.get("date");

  if (Number.isNaN(lat) || Number.isNaN(lon) || !date) {
    return NextResponse.json(
      { error: t("latLonDateRequired") },
      { status: 400 }
    );
  }

  if (!isWithinForecastRange(date)) {
    return NextResponse.json({
      available: false,
      message: t("windForecastLimited"),
    });
  }

  try {
    const forecast = await fetchWindForecast({ lat, lon }, date);
    if (forecast.length === 0) {
      return NextResponse.json({
        available: false,
        message: t("noWeatherData"),
      });
    }
    const wind = representativeDaytimeWind(forecast);
    return NextResponse.json({ available: true, ...wind });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: t("weatherQueryFailed") },
      { status: 502 }
    );
  }
}
