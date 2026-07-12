import { NextResponse } from "next/server";
import { SIGNATURE_ROUTES } from "@/lib/signatureRoutes";

export async function GET() {
  return NextResponse.json({ routes: SIGNATURE_ROUTES });
}
