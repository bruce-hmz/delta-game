import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/game/gacha-service";
import type { GachaQuality } from "@/lib/game/gacha-constants";
import { getPlayerId } from "@/lib/auth/get-player-id";

export async function GET(request: NextRequest) {
  try {
    const auth = await getPlayerId(request);
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
    const quality = searchParams.get("quality") as GachaQuality | null;
    const sort = searchParams.get("sort") || "recent";

    const validQualities: GachaQuality[] = ["white", "blue", "purple", "red", "gold"];
    const filterQuality = quality && validQualities.includes(quality) ? quality : undefined;

    const result = await getCollection(auth.playerId, page, limit, filterQuality);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Collection] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
