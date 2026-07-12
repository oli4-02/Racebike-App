import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/nominatim";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ error: "Suchbegriff zu kurz." }, { status: 400 });
  }

  try {
    const results = await geocodeAddress(q.trim());
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Adresssuche fehlgeschlagen." },
      { status: 502 }
    );
  }
}
