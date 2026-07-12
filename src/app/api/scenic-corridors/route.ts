import { NextResponse } from "next/server";
import { SCENIC_CORRIDORS } from "@/lib/scenicCorridors";

export async function GET() {
  return NextResponse.json({ corridors: SCENIC_CORRIDORS });
}
