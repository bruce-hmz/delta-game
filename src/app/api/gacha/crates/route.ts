import { NextResponse } from "next/server";
import { getCrates } from "@/lib/game/gacha-service";

export async function GET() {
  try {
    const crates = await getCrates();
    return NextResponse.json({ crates });
  } catch (error) {
    console.error("[Crates] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
