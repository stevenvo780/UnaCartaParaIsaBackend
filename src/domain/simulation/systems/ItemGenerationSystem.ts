import { logger } from "@/infrastructure/utils/logger";
import type { GameState, Zone } from "../../types/game-types";
import type {
  GenerationRule,
  GeneratedItem,
  ItemGenerationConfig,
} from "../../types/simulation/itemGeneration";
import { simulationEvents, GameEventType } from "../core/events";
import { BaseMaterialsCatalog } from "../../data/BaseMaterialsCatalog";
import type { Item } from "../../types/simulation/items";

const DEFAULT_CONFIG: ItemGenerationConfig = {
  enableAutoGeneration: true,
  generationIntervalSec: 60,
  maxItemsPerZone: 10,
};

import { injectable, inject, unmanaged } from "inversify";
import { TYPES } from "../../../config/Types";

/**
 * Generates spawn rules based on the base materials catalog.
 *
 * Materials with metadata.biome are generated in specific zones.
 * Higher value materials have longer respawn times to maintain rarity.
 *
 * @returns Array of generation rules for item spawning
 */
function generateDefaultRulesFromCatalog(): GenerationRule[] {
  const rules: GenerationRule[] = [];
  const materials = BaseMaterialsCatalog.getAllMaterials();

  const biomeToZoneType: Record<string, string> = {
    mystical: "mystical",
    wetland: "water",
    mountainous: "work",
    forest: "food",
    grassland: "food",
    village: "storage",
  };

  for (const material of materials) {
    const biome = material.metadata?.biome as string | undefined;
    if (biome && biomeToZoneType[biome]) {
      const value = material.properties?.value || 1;
      const rarity = Math.max(0.1, 1 - value / 100);

      rules.push({
        zoneType: biomeToZoneType[biome],
        itemId: material.id,
        spawnChance: Math.min(0.8, rarity),
        minQuantity: 1,
        maxQuantity: Math.max(1, Math.floor(10 / value)),
        respawnTime: 30000 + value * 5000,
      });
    }
  }

  const basicMaterials = ["wood_log", "stone", "fiber", "water"];
  for (const itemId of basicMaterials) {
    rules.push({
      zoneType: "food",
      itemId,
      spawnChance: 0.6,
      minQuantity: 2,
      maxQuantity: 8,
      respawnTime: 45000,
    });
    rules.push({
      zoneType: "work",
      itemId,
      spawnChance: 0.7,
      minQuantity: 3,
      maxQuantity: 10,
      respawnTime: 30000,
    });
  }

  return rules;
}

/**
 * System for automatically generating items in zones based on biome and rules.
 *
 * Features:
 * - Automatic item generation at configurable intervals
 * - Biome-based spawn rules from BaseMaterialsCatalog
 * - Respawn mechanics for collected items
 * - Zone capacity limits to prevent overcrowding
 * - Support for custom generation rules
 *
 * @see BaseMaterialsCatalog for material definitions
 */
@injectable()
export class ItemGenerationSystem {
  private gameState: GameState;
  private config: ItemGenerationConfig;
  private zoneItems = new Map<string, Map<string, GeneratedItem>>();
  private generationRules: GenerationRule[] = [];
  private lastGeneration = new Map<string, number>();
  private nextItemId = 1;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @unmanaged() config?: Partial<ItemGenerationConfig>,
  ) {
    this.gameState = gameState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.generationRules = generateDefaultRulesFromCatalog();
    logger.info(
      `🎁 ItemGenerationSystem initialized with ${this.generationRules.length} rules from BaseMaterialsCatalog`,
    );
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

    const quantity =
      rule.minQuantity +
      Math.floor(Math.random() * (rule.maxQuantity - rule.minQuantity + 1));

    const item: GeneratedItem = {
      id: `item_gen_${this.nextItemId++}`,
      itemId: rule.itemId,
      quantity,
      zoneId: zone.id,
      generatedAt: Date.now(),
    };

    if (!this.zoneItems.has(zone.id)) {
      this.zoneItems.set(zone.id, new Map());
    }
    this.zoneItems.get(zone.id)!.set(rule.itemId, item);

    simulationEvents.emit(GameEventType.ITEM_GENERATED, {
      itemId: item.id,
      type: item.itemId,
      quantity: item.quantity,
      zoneId: zone.id,
      position: zone.bounds,
    });

    logger.info(`🎁 Generated ${quantity}x ${rule.itemId} in zone ${zone.id}`);
  }

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
        item.collectedBy = agentId;
        item.collectedAt = now;

        collected.push({
          itemId: item.itemId,
          quantity: item.quantity,
        });

        simulationEvents.emit(GameEventType.ITEM_COLLECTED, {
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
   * Forces spawning of a specific item in a zone.
   *
   * @param zoneId - Target zone ID
   * @param itemId - Item ID to spawn
   * @param quantity - Quantity to spawn
   * @returns True if spawn was successful, false if zone not found
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

    simulationEvents.emit(GameEventType.ITEM_GENERATED, {
      itemId: item.id,
      type: itemId,
      quantity,
      zoneId,
      position: zone.bounds,
    });

    return true;
  }

  /**
   * Adds a custom generation rule to the system.
   *
   * @param rule - Generation rule to add
   */
  public addGenerationRule(rule: GenerationRule): void {
    this.generationRules.push(rule);
    logger.info(
      `Added generation rule: ${rule.itemId} in ${rule.zoneType} zones`,
    );
  }

  /**
   * Clears all items from a zone.
   *
   * @param zoneId - Zone ID to clear
   */
  public clearZoneItems(zoneId: string): void {
    this.zoneItems.delete(zoneId);
  }

  /**
   * Gets generation statistics across all zones.
   *
   * @returns Statistics including total zones with items, total items, and items by type
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
   * Gets all uncollected items in a specific zone.
   *
   * @param zoneId - Zone ID to query
   * @returns Array of uncollected generated items
   */
  public getZoneItems(zoneId: string): GeneratedItem[] {
    const zoneMap = this.zoneItems.get(zoneId);
    if (!zoneMap) return [];

    return Array.from(zoneMap.values()).filter((item) => !item.collectedBy);
  }

  /**
   * Gets material information from the catalog.
   *
   * @param itemId - Item ID to look up
   * @returns Item definition or null if not found
   */
  public getMaterialInfo(itemId: string): Item | null {
    return BaseMaterialsCatalog.getMaterialById(itemId);
  }

  /**
   * Gets all materials in a specific category.
   *
   * @param category - Category name to filter by
   * @returns Array of items in the category
   */
  public getMaterialsByCategory(category: string): Item[] {
    return BaseMaterialsCatalog.getMaterialsByCategory(category);
  }

  /**
   * Gets the current number of generation rules.
   *
   * @returns Number of active generation rules
   */
  public getRulesCount(): number {
    return this.generationRules.length;
  }
}
