import { NextRequest, NextResponse } from "next/server";
import { ensurePlayerStreak } from "@/lib/game/gacha-service";
import { PLAYER_DAILY_LIMIT } from "@/lib/game/gacha-constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, wechatId } = body;

    if (!phone && !wechatId) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    // Get guest session to identify the upgrading player
    const guestSession = request.cookies.get("guest_session")?.value;
    if (!guestSession) {
      return NextResponse.json({ error: "no_guest_session" }, { status: 400 });
    }

    // TODO: Implement actual registration (phone OTP or WeChat auth)
    // For now, the guest session ID becomes the player ID
    // The sync endpoint handles migrating pulls from guest to player
    const playerId = guestSession;

    // Upgrade daily limit from guest (3) to player (5)
    await ensurePlayerStreak(playerId, PLAYER_DAILY_LIMIT);

    const response = NextResponse.json({
      playerId,
      ticketsRemaining: PLAYER_DAILY_LIMIT,
      dailyLimit: PLAYER_DAILY_LIMIT,
    });

    // Clear guest cookie — player now uses auth header
    response.cookies.set("guest_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Upgrade] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
