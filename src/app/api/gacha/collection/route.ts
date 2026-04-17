import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/game/gacha-service";
import type { GachaQuality } from "@/lib/game/gacha-constants";

export async function GET(request: NextRequest) {
  try {
    const playerId = getPlayerId(request);
    if (!playerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
    const quality = searchParams.get("quality") as GachaQuality | null;
    const sort = searchParams.get("sort") || "recent";

    const validQualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];
    const filterQuality = quality && validQualities.includes(quality) ? quality : undefined;

    const result = await getCollection(playerId, page, limit, filterQuality);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Collection] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

function getPlayerId(request: NextRequest): string | null {
  // Authorization header takes priority (logged-in user)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  // Fallback to guest session cookie
  const guestSession = request.cookies.get("guest_session")?.value;
  if (guestSession) return guestSession;
  return null;
}
