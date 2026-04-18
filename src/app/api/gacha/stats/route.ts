import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/game/gacha-service";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function GET(request: NextRequest) {
  try {
    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const stats = await getStats(auth.playerId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Stats] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
