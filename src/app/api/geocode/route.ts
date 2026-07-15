import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/nominatim";
import { resolveLocale } from "@/lib/resolveLocale";

// A modest safety margin above Vercel's default serverless timeout (10s) --
// see /api/plan/route.ts for the full reasoning; this route only makes one
// external call, but a slow Nominatim response shouldn't hard-crash it.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
  const t = await getTranslations({ locale, namespace: "api" });

  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ error: t("searchTermTooShort") }, { status: 400 });
  }

  try {
    const results = await geocodeAddress(q.trim());
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: t("addressSearchFailed") },
      { status: 502 }
    );
  }
}
