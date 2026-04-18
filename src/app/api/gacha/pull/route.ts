import { NextRequest, NextResponse } from "next/server";
import { executePull } from "@/lib/game/gacha-service";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crateId, idempotencyKey } = body;

    if (!crateId || !idempotencyKey) {
      return NextResponse.json(
        { error: "missing_params" },
        { status: 400 }
      );
    }

    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const result = await executePull({
      playerId: auth.playerId,
      crateId,
      idempotencyKey,
      isGuest: auth.isGuest,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "no_tickets") {
      return NextResponse.json(
        { error: "no_tickets", ticketsRemaining: 0, dailyLimit: 3 },
        { status: 402 }
      );
    }
    if (error.message === "crate_not_found") {
      return NextResponse.json(
        { error: "crate_not_found" },
        { status: 404 }
      );
    }
    console.error("[Pull] Error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}

