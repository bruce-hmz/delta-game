import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/game/gacha-service";

export async function GET(request: NextRequest) {
  try {
    const playerId = getPlayerId(request);
    if (!playerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const stats = await getStats(playerId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Stats] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

function getPlayerId(request: NextRequest): string | null {
  const guestSession = request.cookies.get("guest_session")?.value;
  if (guestSession) return guestSession;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}
