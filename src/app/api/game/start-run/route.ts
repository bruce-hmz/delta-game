import { NextRequest, NextResponse } from "next/server";
import { startRun, getActiveRun } from "@/lib/game/extraction/extraction-service";
import { computeFogOfWar } from "@/lib/game/extraction/extraction-service";
import { ZONES } from "@/lib/game/extraction/zone-config";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function POST(request: NextRequest) {
  try {
    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { zoneId } = body;

    if (!zoneId || !ZONES[zoneId]) {
      return NextResponse.json({ error: "invalid_zone" }, { status: 400 });
    }

    const runState = await startRun(auth.playerId, zoneId);

    // Return fog-of-war filtered map
    const { runs } = await import("@/storage/database/shared/schema");
    const { eq } = await import("drizzle-orm");
    const db = (await import("@/storage/database/drizzle-client")).getDrizzleClient();
    const runRows = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runState.runId))
      .limit(1);
    const map = runRows[0].mapData as any;
    const visited = (runRows[0].visitedNodeIds as string[]) || [];
    const fogMap = computeFogOfWar(map, visited);

    return NextResponse.json({
      runId: runState.runId,
      zoneId: runState.zoneId,
      currentNodeId: runState.currentNodeId,
      hp: runState.hp,
      maxHp: runState.maxHp,
      backpackCapacity: runState.backpackCapacity,
      evacWaitTurns: runState.evacWaitTurns,
      map: fogMap,
    });
  } catch (error: any) {
    if (error.message === "active_run_exists") {
      return NextResponse.json(
        { error: "active_run_exists" },
        { status: 409 }
      );
    }
    if (error.message === "invalid_zone") {
      return NextResponse.json({ error: "invalid_zone" }, { status: 400 });
    }
    console.error("[StartRun] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
