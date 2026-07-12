import { NextRequest, NextResponse } from "next/server";
import { scenicCorridorsForLocale } from "@/lib/scenicCorridors";
import { resolveLocale } from "@/lib/resolveLocale";

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
  return NextResponse.json({ corridors: scenicCorridorsForLocale(locale) });
}
