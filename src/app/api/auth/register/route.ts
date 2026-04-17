import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/auth/validation";
import { migrateGuestData } from "@/lib/auth/migration-service";
import { getSupabaseAdminClient } from "@/storage/database/supabase-client";
import { db } from "@/storage/database/drizzle-client";
import { playerStreaks } from "@/storage/database/shared/schema";

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

    const { email, password, guestSessionId } = validation.data;

    // 使用 Supabase Admin API 直接创建用户（绕过 signUp 限流）
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 自动确认邮箱，无需验证
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

    // 创建 playerStreaks 记录
    await db.insert(playerStreaks).values({
      playerId: supabaseUid,
      email,
      supabaseUid,
      isRegistered: true,
      dailyLimit: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 如果有游客会话，迁移数据
    let migratedData = null;
    if (guestSessionId) {
      const migrationResult = await migrateGuestData(db, guestSessionId, supabaseUid);
      if (migrationResult.success) {
        migratedData = { pullsMigrated: migrationResult.migratedPulls };
      }
    }

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

    return NextResponse.json({
      success: true,
      accessToken: sessionData.session.access_token,
      user: {
        id: supabaseUid,
        email
      },
      playerId: supabaseUid,
      migratedData
    });

  } catch (error) {
    console.error("[Register] Error:", error);
    const message = error instanceof Error ? error.message : "注册失败，请稍后重试";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
