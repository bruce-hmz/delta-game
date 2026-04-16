import { eq } from 'drizzle-orm';
import { playerStreaks, guestSessions, pullHistory } from '@/storage/database/shared/schema';

export interface MigrationResult {
  success: boolean;
  migratedPulls: number;
  error?: string;
}

export async function migrateGuestData(
  db: any,
  guestSessionId: string,
  newPlayerId: string
): Promise<MigrationResult> {
  try {
    // 1. 迁移抽卡历史
    const pullResult = await db.update(pullHistory)
      .set({ playerId: newPlayerId })
      .where(eq(pullHistory.playerId, guestSessionId))
      .returning({ id: pullHistory.id });

    const migratedPulls = pullResult?.length || 0;

    // 2. 迁移玩家状态
    const guestStreaksData = await db.query.playerStreaks.findFirst({
      where: eq(playerStreaks.playerId, guestSessionId)
    });

    if (guestStreaksData) {
      await db.update(playerStreaks)
        .set({
          playerId: newPlayerId,
          isRegistered: true,
          upgradedAt: new Date(),
          dailyLimit: 5, // 从游客3次提升到5次
          updatedAt: new Date()
        })
        .where(eq(playerStreaks.playerId, guestSessionId));
    } else {
      // 创建新的 playerStreaks 记录
      await db.insert(playerStreaks).values({
        playerId: newPlayerId,
        isRegistered: true,
        dailyLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 3. 清理游客会话
    await db.delete(guestSessions)
      .where(eq(guestSessions.id, guestSessionId));

    return {
      success: true,
      migratedPulls
    };
  } catch (error) {
    console.error('[Migration] Error:', error);
    return {
      success: false,
      migratedPulls: 0,
      error: error instanceof Error ? error.message : '迁移失败'
    };
  }
}
