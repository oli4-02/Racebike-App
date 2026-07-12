import { NextRequest, NextResponse } from "next/server";
import {
  fetchWindForecast,
  isWithinForecastRange,
  representativeDaytimeWind,
} from "@/lib/wind";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const date = params.get("date");

  if (Number.isNaN(lat) || Number.isNaN(lon) || !date) {
    return NextResponse.json(
      { error: "lat, lon und date erforderlich." },
      { status: 400 }
    );
  }

  if (!isWithinForecastRange(date)) {
    return NextResponse.json({
      available: false,
      message: "Wind-Prognose ist nur bis ca. 15 Tage im Voraus verfügbar.",
    });
  }

  try {
    const forecast = await fetchWindForecast({ lat, lon }, date);
    if (forecast.length === 0) {
      return NextResponse.json({
        available: false,
        message: "Keine Wetterdaten für dieses Datum gefunden.",
      });
    }
    const wind = representativeDaytimeWind(forecast);
    return NextResponse.json({ available: true, ...wind });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Wetterabfrage fehlgeschlagen." },
      { status: 502 }
    );
  }
}
