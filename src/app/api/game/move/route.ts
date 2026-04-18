import { NextRequest, NextResponse } from "next/server";
import { moveNode } from "@/lib/game/extraction/extraction-service";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function POST(request: NextRequest) {
  try {
    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetNodeId } = body;

    if (!targetNodeId) {
      return NextResponse.json(
        { error: "missing_target_node" },
        { status: 400 }
      );
    }

    const result = await moveNode(auth.playerId, targetNodeId);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "no_active_run") {
      return NextResponse.json({ error: "no_active_run" }, { status: 404 });
    }
    if (
      error.message === "invalid_move" ||
      error.message.includes("adjacent") ||
      error.message.includes("dead") ||
      error.message.includes("not found")
    ) {
      return NextResponse.json(
        { error: "invalid_move", reason: error.message },
        { status: 400 }
      );
    }
    console.error("[Move] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
