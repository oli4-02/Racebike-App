import { NextRequest, NextResponse } from "next/server";
import {
  NS_NOT_CONFIGURED_MESSAGE,
  buildTrainInfo,
  findNearestStation,
  isNsConfigured,
} from "@/lib/ns";

export async function GET(req: NextRequest) {
  const nsConfigured = isNsConfigured();
  if (!nsConfigured) {
    return NextResponse.json({ configured: false, message: NS_NOT_CONFIGURED_MESSAGE });
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

    const trainInfo = await buildTrainInfo(destStation, homeStation, dateTime, nsConfigured);
    return NextResponse.json(trainInfo);
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
