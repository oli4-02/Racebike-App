import { NextRequest, NextResponse } from "next/server";
import { fetchPOIsNearRoute } from "@/lib/overpass";
import type { LatLon, POICategory } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { geometry: LatLon[]; categories: POICategory[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  if (!Array.isArray(body?.geometry) || body.geometry.length === 0) {
    return NextResponse.json({ error: "geometry erforderlich." }, { status: 400 });
  }
  const categories =
    Array.isArray(body.categories) && body.categories.length > 0
      ? body.categories
      : (["fuel", "supermarket", "ice_cream", "cafe"] as POICategory[]);

  try {
    const pois = await fetchPOIsNearRoute(body.geometry, categories);
    return NextResponse.json({ pois });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "POI-Suche fehlgeschlagen." },
      { status: 502 }
    );
  }
}
