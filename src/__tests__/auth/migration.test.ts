import { describe, it, expect, vi } from 'vitest';
import { migrateGuestData } from '@/lib/auth/migration-service';

describe('migrateGuestData', () => {
  it('should migrate guest data to registered user', async () => {
    const mockPullHistory = {
      playerId: 'playerId'
    };
    
    const mockPlayerStreaks = {
      playerId: 'playerId',
      isRegistered: 'isRegistered',
      upgradedAt: 'upgradedAt',
      dailyLimit: 'dailyLimit',
      updatedAt: 'updatedAt'
    };
    
    const mockGuestSessions = {
      id: 'id'
    };

    // Create chainable mock
    const createChainableMock = (returnValue: any) => {
      const chain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returnValue),
        values: vi.fn().mockReturnThis(),
        then: vi.fn((cb: any) => Promise.resolve(cb(returnValue)))
      };
      return chain;
    };

    const mockDb = {
      update: vi.fn().mockReturnValue(createChainableMock([{ id: 'pull-1' }, { id: 'pull-2' }])),
      query: {
        playerStreaks: {
          findFirst: vi.fn().mockResolvedValue({
            playerId: 'guest-123',
            pullsToday: 2,
            pityCount: 10
          })
        }
      },
      insert: vi.fn().mockReturnValue(createChainableMock({})),
      delete: vi.fn().mockReturnValue(createChainableMock({}))
    };

    const result = await migrateGuestData(mockDb as any, 'guest-123', 'user-456');
    expect(result.success).toBe(true);
    expect(result.migratedPulls).toBe(2);
  });

  it('should handle guest with no streaks record', async () => {
    const createChainableMock = (returnValue: any) => {
      return {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returnValue),
        values: vi.fn().mockReturnThis()
      };
    };

    const mockDb = {
      update: vi.fn().mockReturnValue(createChainableMock([])),
      query: {
        playerStreaks: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      },
      insert: vi.fn().mockReturnValue(createChainableMock({})),
      delete: vi.fn().mockReturnValue(createChainableMock({}))
    };

    const result = await migrateGuestData(mockDb as any, 'guest-123', 'user-456');
    expect(result.success).toBe(true);
    expect(result.migratedPulls).toBe(0);
  });

  it('should handle database errors', async () => {
    const mockDb = {
      update: vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      })
    };

    const result = await migrateGuestData(mockDb as any, 'guest-123', 'user-456');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
