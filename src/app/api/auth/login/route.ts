import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/validation";
import { getSupabaseAdminClient } from "@/storage/database/supabase-client";
import { db } from "@/storage/database/drizzle-client";
import { playerStreaks } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证输入
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "输入验证失败", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // 使用 Supabase Auth 登录
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return NextResponse.json(
        { success: false, error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json(
        { success: false, error: "登录失败" },
        { status: 500 }
      );
    }

    const supabaseUid = authData.user.id;

    // 查询玩家数据
    const streaks = await db.query.playerStreaks.findFirst({
      where: eq(playerStreaks.playerId, supabaseUid)
    });

    return NextResponse.json({
      success: true,
      accessToken: authData.session.access_token,
      user: {
        id: supabaseUid,
        email: authData.user.email
      },
      playerId: supabaseUid,
      streaks: streaks ? {
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        pityCount: streaks.pityCount,
        totalPulls: streaks.totalPulls,
        pullsToday: streaks.pullsToday,
        dailyLimit: streaks.dailyLimit
      } : null
    });

  } catch (error) {
    console.error("[Login] Error:", error);
    return NextResponse.json(
      { success: false, error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
