import { logger } from "@/infrastructure/utils/logger";
import type { GameState, Zone } from "../../types/game-types";
import type {
  GenerationRule,
  GeneratedItem,
  ItemGenerationConfig,
} from "../../types/simulation/itemGeneration";
import { simulationEvents, GameEventNames } from "../core/events";

const DEFAULT_CONFIG: ItemGenerationConfig = {
  enableAutoGeneration: true,
  generationIntervalSec: 60,
  maxItemsPerZone: 10,
};

export class ItemGenerationSystem {
  private gameState: GameState;
  private config: ItemGenerationConfig;
  private zoneItems = new Map<string, Map<string, GeneratedItem>>();
  private generationRules: GenerationRule[] = [];
  private lastGeneration = new Map<string, number>();
  private nextItemId = 1;

  constructor(gameState: GameState, config?: Partial<ItemGenerationConfig>) {
    this.gameState = gameState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info("🎁 ItemGenerationSystem (Backend) initialized");
  }

  public update(_deltaMs: number): void {
    if (!this.config.enableAutoGeneration) return;

    const now = Date.now();
    const intervalMs = this.config.generationIntervalSec * 1000;

    const zones = this.gameState.zones || [];
    for (const zone of zones) {
      const lastGen = this.lastGeneration.get(zone.id) || 0;

      if (now - lastGen >= intervalMs) {
        this.processZoneGeneration(zone);
        this.lastGeneration.set(zone.id, now);
      }
    }
  }

  private processZoneGeneration(zone: Zone): void {
    const applicableRules = this.generationRules.filter(
      (rule) => rule.zoneType === zone.type,
    );

    if (applicableRules.length === 0) return;

    const currentItems = this.zoneItems.get(zone.id);
    const itemCount = currentItems ? currentItems.size : 0;

    if (itemCount >= this.config.maxItemsPerZone) return;

    for (const rule of applicableRules) {
      this.tryGenerateItem(zone, rule);
    }
  }

  private tryGenerateItem(zone: Zone, rule: GenerationRule): void {
    if (Math.random() > rule.spawnChance) return;

    const zoneItemMap = this.zoneItems.get(zone.id);
    if (zoneItemMap?.has(rule.itemId)) {
      const existingItem = zoneItemMap.get(rule.itemId)!;
      const now = Date.now();

      if (existingItem.collectedAt) {
        const timeSinceCollected = now - existingItem.collectedAt;
        if (timeSinceCollected < rule.respawnTime) {
          return;
        }
      } else {
        return;
      }
    }

    // Generate quantity
    const quantity =
      rule.minQuantity +
      Math.floor(Math.random() * (rule.maxQuantity - rule.minQuantity + 1));

    // Create generated item
    const item: GeneratedItem = {
      id: `item_gen_${this.nextItemId++}`,
      itemId: rule.itemId,
      quantity,
      zoneId: zone.id,
      generatedAt: Date.now(),
    };

    // Store item
    if (!this.zoneItems.has(zone.id)) {
      this.zoneItems.set(zone.id, new Map());
    }
    this.zoneItems.get(zone.id)!.set(rule.itemId, item);

    // Emit event
    simulationEvents.emit(GameEventNames.ITEM_GENERATED, {
      itemId: item.id,
      type: item.itemId,
      quantity: item.quantity,
      zoneId: zone.id,
      position: zone.bounds,
    });

    logger.info(`🎁 Generated ${quantity}x ${rule.itemId} in zone ${zone.id}`);
  }

  /**
   * Collect items from a zone (called by agent/player)
   */
  public collectItemsFromZone(
    zoneId: string,
    agentId: string,
  ): Array<{ itemId: string; quantity: number }> {
    const zoneItemMap = this.zoneItems.get(zoneId);
    if (!zoneItemMap || zoneItemMap.size === 0) {
      return [];
    }

    const collected: Array<{ itemId: string; quantity: number }> = [];
    const now = Date.now();

    zoneItemMap.forEach((item, _key) => {
      if (!item.collectedBy) {
        // Mark as collected
        item.collectedBy = agentId;
        item.collectedAt = now;

        collected.push({
          itemId: item.itemId,
          quantity: item.quantity,
        });

        simulationEvents.emit(GameEventNames.ITEM_COLLECTED, {
          itemId: item.id,
          type: item.itemId,
          quantity: item.quantity,
          zoneId,
          collectorId: agentId,
        });
      }
    });

    return collected;
  }

  /**
   * Force spawn a specific item in a zone
   */
  public forceSpawnItem(
    zoneId: string,
    itemId: string,
    quantity: number,
  ): boolean {
    const zone = this.gameState.zones?.find((z: Zone) => z.id === zoneId);
    if (!zone) return false;

    const item: GeneratedItem = {
      id: `item_force_${this.nextItemId++}`,
      itemId,
      quantity,
      zoneId,
      generatedAt: Date.now(),
    };

    if (!this.zoneItems.has(zoneId)) {
      this.zoneItems.set(zoneId, new Map());
    }
    this.zoneItems.get(zoneId)!.set(itemId, item);

    simulationEvents.emit(GameEventNames.ITEM_GENERATED, {
      itemId: item.id,
      type: itemId,
      quantity,
      zoneId,
      position: zone.bounds,
    });

    return true;
  }

  /**
   * Add a generation rule
   */
  public addGenerationRule(rule: GenerationRule): void {
    this.generationRules.push(rule);
    logger.info(
      `Added generation rule: ${rule.itemId} in ${rule.zoneType} zones`,
    );
  }

  /**
   * Clear items from a zone
   */
  public clearZoneItems(zoneId: string): void {
    this.zoneItems.delete(zoneId);
  }

  /**
   * Get generation statistics
   */
  public getGenerationStats(): {
    totalZonesWithItems: number;
    totalItems: number;
    itemsByType: Record<string, number>;
  } {
    let totalItems = 0;
    const itemsByType: Record<string, number> = {};

    this.zoneItems.forEach((zoneMap) => {
      zoneMap.forEach((item) => {
        if (!item.collectedBy) {
          totalItems += item.quantity;
          itemsByType[item.itemId] =
            (itemsByType[item.itemId] || 0) + item.quantity;
        }
      });
    });

    return {
      totalZonesWithItems: this.zoneItems.size,
      totalItems,
      itemsByType,
    };
  }

  /**
   * Get items in a specific zone
   */
  public getZoneItems(zoneId: string): GeneratedItem[] {
    const zoneMap = this.zoneItems.get(zoneId);
    if (!zoneMap) return [];

    return Array.from(zoneMap.values()).filter((item) => !item.collectedBy);
  }
}
