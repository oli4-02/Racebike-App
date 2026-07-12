import { NextRequest, NextResponse } from "next/server";
import { signatureRoutesForLocale } from "@/lib/signatureRoutes";
import { resolveLocale } from "@/lib/resolveLocale";

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.nextUrl.searchParams.get("locale"));
  return NextResponse.json({ routes: signatureRoutesForLocale(locale) });
}
