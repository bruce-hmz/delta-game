import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing route
vi.mock("@/storage/database/supabase-client", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/storage/database/drizzle-client", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock("@/lib/auth/migration-service", () => ({
  migrateGuestData: vi.fn(() =>
    Promise.resolve({ success: true, migratedPulls: 0 })
  ),
}));

import { POST } from "@/app/api/auth/register/route";
import { getSupabaseAdminClient } from "@/storage/database/supabase-client";
import { migrateGuestData } from "@/lib/auth/migration-service";
import { db } from "@/storage/database/drizzle-client";

function makeRequest(body: object) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid email", async () => {
    const res = await POST(makeRequest({ email: "bad", password: "abc12345" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("输入验证失败");
  });

  it("rejects password shorter than 8 characters", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", password: "ab1" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects password without a number", async () => {
    const res = await POST(
      makeRequest({ email: "a@b.com", password: "abcdefgh" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("returns error when Supabase user creation fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "email rate limit exceeded" },
          }),
        },
        signInWithPassword: vi.fn(),
      },
    } as any);

    const res = await POST(
      makeRequest({ email: "a@b.com", password: "abc12345" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("email rate limit exceeded");
  });

  it("registers user successfully and returns access token", async () => {
    const mockUser = { id: "user-123" };
    const mockSession = { access_token: "token-abc" };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    } as any);

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "abc12345",
        guestSessionId: "guest-1",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.accessToken).toBe("token-abc");
    expect(data.user).toEqual({ id: "user-123", email: "test@example.com" });
    expect(data.playerId).toBe("user-123");

    // Verify admin.createUser was called (not signUp)
    const adminClient = getSupabaseAdminClient();
    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "abc12345",
      email_confirm: true,
    });

    // Verify playerStreaks was inserted
    expect(db.insert).toHaveBeenCalled();

    // Verify migration was called with guest session
    expect(migrateGuestData).toHaveBeenCalledWith(db, "guest-1", "user-123");
  });

  it("registers without guest session migration", async () => {
    const mockUser = { id: "user-456" };
    const mockSession = { access_token: "token-def" };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    } as any);

    const res = await POST(
      makeRequest({ email: "test2@example.com", password: "abc12345" })
    );
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(migrateGuestData).not.toHaveBeenCalled();
  });

  it("returns 500 when user is null but no error", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        signInWithPassword: vi.fn(),
      },
    } as any);

    const res = await POST(
      makeRequest({ email: "a@b.com", password: "abc12345" })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("用户创建失败");
  });

  it("returns 500 when session creation fails", async () => {
    const mockUser = { id: "user-789" };

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: "login failed" },
        }),
      },
    } as any);

    const res = await POST(
      makeRequest({ email: "a@b.com", password: "abc12345" })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("登录失败");
  });
});
