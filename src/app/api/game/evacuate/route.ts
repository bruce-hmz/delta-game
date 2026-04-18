import { NextRequest, NextResponse } from "next/server";
import { evacuateRun } from "@/lib/game/extraction/extraction-service";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function POST(request: NextRequest) {
  try {
    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const result = await evacuateRun(auth.playerId);

    if (!result.success) {
      return NextResponse.json(
        { error: "evacuation_failed", reason: "Not on evac node or wait not met" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "no_active_run") {
      return NextResponse.json({ error: "no_active_run" }, { status: 404 });
    }
    console.error("[Evacuate] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
