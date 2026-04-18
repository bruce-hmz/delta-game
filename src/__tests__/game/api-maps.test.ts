import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the extraction service for API route tests
vi.mock("@/lib/game/extraction/extraction-service", () => ({
  startRun: vi.fn(),
  moveNode: vi.fn(),
  evacuateRun: vi.fn(),
  getActiveRun: vi.fn(),
  computeFogOfWar: vi.fn(),
}));

// Mock DB
vi.mock("@/storage/database/drizzle-client", () => ({
  getDrizzleClient: vi.fn(),
}));

import { GET } from "@/app/api/game/maps/route";
import { ZONES, ZONE_IDS } from "@/lib/game/extraction/zone-config";

describe("GET /api/game/maps", () => {
  it("returns all zone configurations", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.zones).toHaveLength(4);
    expect(data.zones[0].id).toBe("hawkeye_power");
  });

  it("each zone has required fields", async () => {
    const response = await GET();
    const data = await response.json();

    for (const zone of data.zones) {
      expect(zone).toHaveProperty("id");
      expect(zone).toHaveProperty("name");
      expect(zone).toHaveProperty("difficulty");
      expect(zone).toHaveProperty("nodeCountRange");
      expect(zone).toHaveProperty("dropRates");
    }
  });
});
