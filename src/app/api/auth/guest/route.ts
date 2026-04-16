import { NextRequest, NextResponse } from "next/server";
import { createGuestSession, ensurePlayerStreak } from "@/lib/game/gacha-service";

export async function POST(request: NextRequest) {
  try {
    // Check if guest already has a session cookie
    const existingSession = request.cookies.get("guest_session")?.value;
    if (existingSession) {
      return NextResponse.json(
        { error: "session_exists", sessionId: existingSession },
        { status: 409 }
      );
    }

    // Create new guest session
    const result = await createGuestSession();

    // Create player_streaks row for this guest
    await ensurePlayerStreak(result.sessionId, 3);

    // Set httpOnly cookie with HMAC signature
    const response = NextResponse.json({
      sessionId: result.sessionId,
      ticketsRemaining: result.ticketsRemaining,
      dailyLimit: result.dailyLimit,
    });

    response.cookies.set("guest_session", result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Guest Auth] Error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
