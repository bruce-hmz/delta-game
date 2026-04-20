import { NextRequest, NextResponse } from "next/server";
import { startRun, getActiveRun } from "@/lib/game/extraction/extraction-service";
import { computeFogOfWar } from "@/lib/game/extraction/extraction-service";
import { ZONES } from "@/lib/game/extraction/zone-config";
import { getPlayerId } from "@/lib/auth/get-player-id";
import { runs } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";
import { getDrizzleClient } from "@/storage/database/drizzle-client";

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
    const db = getDrizzleClient();
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
      // Resume: return the existing active run instead of erroring
      try {
        const auth2 = await getPlayerId(request);
        if (auth2) {
          const activeRun = await getActiveRun(auth2.playerId);
          if (activeRun) {
            const db = getDrizzleClient();
            const runRows = await db
              .select()
              .from(runs)
              .where(eq(runs.id, activeRun.runId))
              .limit(1);
            const map2 = runRows[0].mapData as any;
            const visited2 = (runRows[0].visitedNodeIds as string[]) || [];
            const fogMap2 = computeFogOfWar(map2, visited2);

            return NextResponse.json({
              runId: activeRun.runId,
              zoneId: activeRun.zoneId,
              currentNodeId: activeRun.currentNodeId,
              hp: activeRun.hp,
              maxHp: activeRun.maxHp,
              backpackCapacity: activeRun.backpackCapacity,
              evacWaitTurns: activeRun.evacWaitTurns,
              backpack: activeRun.backpack,
              map: fogMap2,
            });
          }
        }
      } catch {
        // fall through to 409
      }
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
