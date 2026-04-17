import { NextRequest, NextResponse } from "next/server";
import { executePull } from "@/lib/game/gacha-service";

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

    // Get player ID from guest session cookie or auth header
    const playerId = getPlayerId(request);
    if (!playerId) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const isGuest = !request.headers.get("authorization");

    const result = await executePull({
      playerId,
      crateId,
      idempotencyKey,
      isGuest,
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

function getPlayerId(request: NextRequest): string | null {
  // Authorization header takes priority (logged-in user)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fallback to guest session cookie
  const guestSession = request.cookies.get("guest_session")?.value;
  if (guestSession) return guestSession;

  return null;
}
