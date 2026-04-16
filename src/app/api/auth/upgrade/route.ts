import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/auth/validation";
import { migrateGuestData } from "@/lib/auth/migration-service";
import { getSupabaseAdminClient } from "@/storage/database/supabase-client";
import { db } from "@/storage/database/drizzle-client";
import { playerStreaks } from "@/storage/database/shared/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证输入
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "输入验证失败", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // 获取游客会话
    const guestSessionId = request.cookies.get("guest_session")?.value;
    if (!guestSessionId) {
      return NextResponse.json(
        { success: false, error: "未找到游客会话" },
        { status: 400 }
      );
    }

    // 使用 Supabase Auth 创建用户
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined
      }
    });

    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: "用户创建失败" },
        { status: 500 }
      );
    }

    const supabaseUid = authData.user.id;

    // 迁移游客数据
    const migrationResult = await migrateGuestData(db, guestSessionId, supabaseUid);
    if (!migrationResult.success) {
      // 迁移失败，删除已创建的 Auth 用户
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      return NextResponse.json(
        { success: false, error: "数据迁移失败: " + migrationResult.error },
        { status: 500 }
      );
    }

    // 更新 playerStreaks 记录
    await db.update(playerStreaks)
      .set({
        email,
        supabaseUid,
        isRegistered: true,
        dailyLimit: 5,
        updatedAt: new Date()
      })
      .where(eq(playerStreaks.playerId, supabaseUid));

    // 获取 session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (sessionError || !sessionData.session) {
      return NextResponse.json(
        { success: false, error: "登录失败" },
        { status: 500 }
      );
    }

    // 清除游客 cookie
    const response = NextResponse.json({
      success: true,
      accessToken: sessionData.session.access_token,
      user: {
        id: supabaseUid,
        email
      },
      playerId: supabaseUid,
      migratedData: {
        pullsMigrated: migrationResult.migratedPulls
      }
    });

    response.cookies.set("guest_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/"
    });

    return response;

  } catch (error) {
    console.error("[Upgrade] Error:", error);
    return NextResponse.json(
      { success: false, error: "升级失败，请稍后重试" },
      { status: 500 }
    );
  }
}
