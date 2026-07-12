import { NextRequest, NextResponse } from "next/server";
import { findNearestStation, isNsConfigured, ovFietsAvailability, planTrip } from "@/lib/ns";

export async function GET(req: NextRequest) {
  if (!isNsConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "Zugrückfahrt ist noch nicht aktiv: NS_API_KEY fehlt. Kostenlosen Key auf apiportal.ns.nl registrieren und als Umgebungsvariable NS_API_KEY setzen.",
    });
  }

  const params = req.nextUrl.searchParams;
  const destLat = Number(params.get("destLat"));
  const destLon = Number(params.get("destLon"));
  const homeLat = Number(params.get("homeLat"));
  const homeLon = Number(params.get("homeLon"));
  const dateTime = params.get("dateTime") ?? new Date().toISOString();

  if ([destLat, destLon, homeLat, homeLon].some((n) => Number.isNaN(n))) {
    return NextResponse.json(
      { error: "destLat, destLon, homeLat, homeLon erforderlich." },
      { status: 400 }
    );
  }

  try {
    const [destStation, homeStation] = await Promise.all([
      findNearestStation({ lat: destLat, lon: destLon }),
      findNearestStation({ lat: homeLat, lon: homeLon }),
    ]);

    if (!destStation || !homeStation) {
      return NextResponse.json(
        { error: "Kein Bahnhof in der Nähe gefunden." },
        { status: 404 }
      );
    }

    const [trips, ovFiets] = await Promise.all([
      planTrip(destStation.code, homeStation.code, dateTime),
      ovFietsAvailability(destStation.code),
    ]);

    return NextResponse.json({
      configured: true,
      fromStation: destStation,
      toStation: homeStation,
      trips,
      ovFiets,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        configured: true,
        error:
          err instanceof Error ? err.message : "NS-Abfrage fehlgeschlagen.",
      },
      { status: 502 }
    );
  }
}
