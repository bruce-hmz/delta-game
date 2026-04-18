import { rollQuality, generateItem } from "@/lib/game/gacha-service";
import type { ZoneConfig, RunItem } from "./types";

/**
 * Generate loot items for a node in the extraction game.
 * Wraps existing gacha rollQuality + generateItem with zone-specific drop rates.
 *
 * Item count distribution:
 *  15% chance: 0 items
 *  40% chance: 1 item
 *  30% chance: 2 items
 *  15% chance: 3 items
 */
export function generateLootForNode(
  zone: ZoneConfig,
  nodeId: string,
  rng: () => number
): RunItem[] {
  // Roll item count
  const countRoll = rng();
  let count: number;
  if (countRoll < 0.15) count = 0;
  else if (countRoll < 0.55) count = 1;
  else if (countRoll < 0.85) count = 2;
  else count = 3;

  const items: RunItem[] = [];
  for (let i = 0; i < count; i++) {
    const quality = rollQuality(zone.dropRates, rng);
    const { name, value, affixes } = generateItem(quality, rng);

    items.push({
      id: `${nodeId}-${i}`,
      itemName: name,
      quality,
      value,
      affixes,
    });
  }

  return items;
}
