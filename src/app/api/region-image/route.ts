import { NextRequest, NextResponse } from "next/server";
import { resolveLocale } from "@/lib/resolveLocale";
import { fetchNearbyRegionImage } from "@/lib/wikipedia";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = resolveLocale(params.get("locale"));

  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ image: null }, { status: 400 });
  }

  // Best-effort only -- a missing region photo is not an error state for the
  // caller, just an empty result, so this never returns a failure status.
  const image = await fetchNearbyRegionImage(lat, lon, locale);
  return NextResponse.json({ image });
}
