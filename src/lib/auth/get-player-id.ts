import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/storage/database/supabase-client";
import * as crypto from "crypto";

const GUEST_HMAC_SECRET =
  process.env.GUEST_HMAC_SECRET || "delta-game-guest-hmac-change-in-prod";

/**
 * Verify a Supabase JWT access token and return the user ID.
 * Returns null if the token is invalid, expired, or malformed.
 */
async function verifyBearerToken(
  token: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * Sign a guest session ID with HMAC.
 * Format: {sessionId}.{hmac}
 */
export function signGuestSession(sessionId: string): string {
  const hmac = crypto
    .createHmac("sha256", GUEST_HMAC_SECRET)
    .update(sessionId)
    .digest("hex");
  return `${sessionId}.${hmac}`;
}

/**
 * Verify a guest session HMAC. Returns the session ID if valid, null otherwise.
 */
function verifyGuestSession(cookieValue: string): string | null {
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) {
    // Legacy unsigned sessions: accept during migration window
    // TODO: Remove this fallback after migration period
    return cookieValue;
  }
  const sessionId = cookieValue.substring(0, dotIndex);
  const hmac = cookieValue.substring(dotIndex + 1);
  const expectedHmac = crypto
    .createHmac("sha256", GUEST_HMAC_SECRET)
    .update(sessionId)
    .digest("hex");
  const hmacBuf = Buffer.from(hmac);
  const expectedBuf = Buffer.from(expectedHmac);
  if (hmacBuf.length !== expectedBuf.length) {
    return null;
  }
  if (crypto.timingSafeEqual(hmacBuf, expectedBuf)) {
    return sessionId;
  }
  return null;
}

/**
 * Extract and verify player ID from the request.
 *
 * 1. Bearer token → JWT verification via Supabase
 * 2. guest_session cookie → HMAC verification
 *
 * Returns { playerId, isGuest } or null if unauthorized.
 */
export async function getPlayerId(
  request: NextRequest
): Promise<{ playerId: string; isGuest: boolean } | null> {
  // Check Bearer token first (registered users)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await verifyBearerToken(token);
    if (userId) {
      return { playerId: userId, isGuest: false };
    }
    return null;
  }

  // Check guest session cookie
  const guestCookie = request.cookies.get("guest_session")?.value;
  if (guestCookie) {
    const sessionId = verifyGuestSession(guestCookie);
    if (sessionId) {
      return { playerId: sessionId, isGuest: true };
    }
    return null;
  }

  return null;
}
