import { NextResponse } from "next/server";
import { ZONES, ZONE_IDS } from "@/lib/game/extraction/zone-config";

export async function GET() {
  const zones = ZONE_IDS.map((id) => ZONES[id]);
  return NextResponse.json({ zones });
}
