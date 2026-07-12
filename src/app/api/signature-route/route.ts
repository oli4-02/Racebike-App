import { NextRequest, NextResponse } from "next/server";
import { SIGNATURE_ROUTES } from "@/lib/signatureRoutes";
import { planRoute } from "@/lib/routePlanner";
import { buildTrainInfo, findNearestStation, isNsConfigured } from "@/lib/ns";
import { distance } from "@/lib/geo";
import { DEFAULT_PRIORITIES } from "@/lib/types";
import type { LatLon, Priorities, StationInfo } from "@/lib/types";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body?.routeId || !body?.start || !body?.distanceKm || !body?.date) {
    return NextResponse.json(
      { error: "routeId, start, distanceKm und date erforderlich." },
      { status: 400 }
    );
  }

  const signatureRoute = SIGNATURE_ROUTES.find((r) => r.id === body.routeId);
  if (!signatureRoute) {
    return NextResponse.json({ error: "Unbekannte Signature-Route." }, { status: 404 });
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
          ? findNearestStation(signatureRoute.center).catch(() => null)
          : Promise.resolve(null),
        nsConfigured ? findNearestStation(body.start).catch(() => null) : Promise.resolve(null),
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
        buildTrainInfo(homeStation, station, `${body.date}T08:30:00`, nsConfigured),
        buildTrainInfo(station, homeStation, `${body.date}T16:00:00`, nsConfigured),
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
        error:
          err instanceof Error ? err.message : "Signature-Route fehlgeschlagen.",
      },
      { status: 502 }
    );
  }
}
