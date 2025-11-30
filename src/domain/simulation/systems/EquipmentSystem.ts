/**
 * Equipment System - Manages equipped items and shared tool storage for agents.
 *
 * Handles:
 * - Equipping, unequipping, and querying equipment bonuses
 * - Shared tool pool for craftsmen to deposit and agents to claim
 * - Equipment provides combat bonuses (attack range, damage) and gathering bonuses (speed, yield)
 *
 * Merged from:
 * - EquipmentSystem: Personal equipment management
 * - ToolStorageSystem: Global tool pool
 *
 * @module simulation/systems/EquipmentSystem
 */

import { EquipmentSlot } from "../../../shared/constants/EquipmentEnums";
import { ItemId } from "../../../shared/constants/ItemEnums";
import { logger } from "../../../infrastructure/utils/logger";
import {
  getEquipmentStats,
  getBestWeapon,
  ROLE_RECOMMENDED_TOOLS,
  type EquipmentStats,
} from "../../data/EquipmentStats";





/**
 * A stored tool with quantity tracking.
 */
interface StoredTool {
  itemId: string;
  quantity: number;
  /** Timestamp when last tool was added */
  lastAdded: number;
}

/**
 * Tool categories for quick lookup by role needs.
 */
export const TOOL_CATEGORIES = {
  /** Weapons for hunting/combat */
  HUNTING_WEAPONS: [
    ItemId.BOW,
    ItemId.STONE_DAGGER,
    ItemId.IRON_SWORD,
    ItemId.WOODEN_CLUB,
  ],
  /** Tools for wood gathering */
  WOODCUTTING: [ItemId.STONE_AXE, ItemId.IRON_AXE],
  /** Tools for mining */
  MINING: [ItemId.STONE_PICKAXE, ItemId.IRON_PICKAXE],
  /** Combat weapons for guards */
  COMBAT_WEAPONS: [
    ItemId.IRON_SWORD,
    ItemId.STONE_DAGGER,
    ItemId.WOODEN_CLUB,
    ItemId.BOW,
  ],
} as const;

/**
 * Maps roles to the tool categories they need.
 */
export const ROLE_TOOL_NEEDS: Record<string, readonly string[]> = {
  hunter: TOOL_CATEGORIES.HUNTING_WEAPONS,
  guard: TOOL_CATEGORIES.COMBAT_WEAPONS,
  logger: TOOL_CATEGORIES.WOODCUTTING,
  lumberjack: TOOL_CATEGORIES.WOODCUTTING,
  quarryman: TOOL_CATEGORIES.MINING,
  miner: TOOL_CATEGORIES.MINING,
};

/**
 * Agent equipment state.
 * Tracks what items are equipped in each slot.
 */
export interface AgentEquipment {
  /** Equipped item ID per slot */
  slots: Partial<Record<EquipmentSlot, string>>;
  /** Timestamp of last equipment change */
  lastChanged: number;
}

/**
 * Equipment System for managing agent equipment and shared tool storage.
 */
export class EquipmentSystem {
  /** Equipment state per agent */
  private equipmentByAgent: Map<string, AgentEquipment> = new Map();


  /** Available tools: itemId -> quantity */
  private toolStorage = new Map<string, StoredTool>();
  /** Track who has claimed tools: agentId -> itemId */
  private claimedTools = new Map<string, string>();





  /**
   * Initializes equipment for an agent.
   * @param agentId - Agent unique identifier
   */
  initializeAgent(agentId: string): void {
    if (!this.equipmentByAgent.has(agentId)) {
      this.equipmentByAgent.set(agentId, {
        slots: {},
        lastChanged: Date.now(),
      });
    }
  }

  /**
   * Equips an item in a specific slot.
   * @param agentId - Agent unique identifier
   * @param slot - Equipment slot to use
   * @param itemId - Item ID to equip
   * @returns Previously equipped item ID, or undefined if slot was empty
   */
  equipItem(
    agentId: string,
    slot: EquipmentSlot,
    itemId: string,
  ): string | undefined {
    this.initializeAgent(agentId);
    const equipment = this.equipmentByAgent.get(agentId)!;

    const previousItem = equipment.slots[slot];
    equipment.slots[slot] = itemId;
    equipment.lastChanged = Date.now();

    return previousItem;
  }

  /**
   * Unequips an item from a specific slot.
   * @param agentId - Agent unique identifier
   * @param slot - Equipment slot to clear
   * @returns Previously equipped item ID, or undefined if slot was empty
   */
  unequipItem(agentId: string, slot: EquipmentSlot): string | undefined {
    const equipment = this.equipmentByAgent.get(agentId);
    if (!equipment) return undefined;

    const previousItem = equipment.slots[slot];
    delete equipment.slots[slot];
    equipment.lastChanged = Date.now();

    return previousItem;
  }

  /**
   * Gets the equipped item in a specific slot.
   * @param agentId - Agent unique identifier
   * @param slot - Equipment slot to check
   * @returns Item ID or undefined if slot is empty
   */
  getEquippedItem(agentId: string, slot: EquipmentSlot): string | undefined {
    return this.equipmentByAgent.get(agentId)?.slots[slot];
  }

  /**
   * Gets all equipped items for an agent.
   * @param agentId - Agent unique identifier
   * @returns Map of slot to item ID
   */
  getAllEquipment(agentId: string): Partial<Record<EquipmentSlot, string>> {
    return this.equipmentByAgent.get(agentId)?.slots ?? {};
  }

  /**
   * Gets the stats of the equipped main hand item.
   * @param agentId - Agent unique identifier
   * @returns Equipment stats, or unarmed stats if nothing equipped
   */
  getMainHandStats(agentId: string): EquipmentStats {
    const itemId = this.getEquippedItem(agentId, EquipmentSlot.MAIN_HAND);
    return getEquipmentStats(itemId);
  }

  /**
   * Gets the attack range for an agent based on equipped weapon.
   * @param agentId - Agent unique identifier
   * @returns Attack range in world units
   */
  getAttackRange(agentId: string): number {
    return this.getMainHandStats(agentId).attackRange;
  }

  /**
   * Gets the damage multiplier for an agent based on equipped weapon.
   * @param agentId - Agent unique identifier
   * @returns Damage multiplier (1.0 = base damage)
   */
  getDamageMultiplier(agentId: string): number {
    return this.getMainHandStats(agentId).damageMultiplier;
  }

  /**
   * Gets the attack speed for an agent based on equipped weapon.
   * @param agentId - Agent unique identifier
   * @returns Attack speed multiplier (1.0 = base speed)
   */
  getAttackSpeed(agentId: string): number {
    return this.getMainHandStats(agentId).attackSpeed;
  }

  /**
   * Auto-equips the best tool for a role from available items.
   * @param agentId - Agent unique identifier
   * @param role - Agent's current role
   * @param availableItems - List of item IDs the agent has in inventory
   * @returns Item ID that was equipped, or undefined if no suitable tool
   */
  autoEquipForRole(
    agentId: string,
    role: string,
    availableItems: string[],
  ): string | undefined {
    const recommendedTools = ROLE_RECOMMENDED_TOOLS[role.toLowerCase()];
    if (!recommendedTools) return undefined;

    for (const toolId of recommendedTools) {
      if (availableItems.includes(toolId)) {
        this.equipItem(agentId, EquipmentSlot.MAIN_HAND, toolId);
        return toolId;
      }
    }

    return undefined;
  }

  /**
   * Auto-equips the best weapon for combat/hunting.
   * @param agentId - Agent unique identifier
   * @param availableItems - List of item IDs the agent has in inventory
   * @param preferRanged - Whether to prefer ranged weapons
   * @returns Item ID that was equipped, or undefined if no weapons available
   */
  autoEquipBestWeapon(
    agentId: string,
    availableItems: string[],
    preferRanged: boolean = false,
  ): string | undefined {
    const bestWeapon = getBestWeapon(availableItems, preferRanged);
    if (bestWeapon) {
      this.equipItem(agentId, EquipmentSlot.MAIN_HAND, bestWeapon);
    }
    return bestWeapon;
  }

  /**
   * Removes all equipment data for an agent.
   * @param agentId - Agent unique identifier
   */
  removeAgent(agentId: string): void {
    this.equipmentByAgent.delete(agentId);
  }

  /**
   * Gets all agents with equipment.
   * @returns Array of agent IDs
   */
  getAllAgentIds(): string[] {
    return Array.from(this.equipmentByAgent.keys());
  }

  /**
   * Serializes equipment state for persistence.
   * @returns Serialized equipment data
   */
  serialize(): Record<string, AgentEquipment> {
    const data: Record<string, AgentEquipment> = {};
    for (const [agentId, equipment] of this.equipmentByAgent) {
      data[agentId] = {
        slots: { ...equipment.slots },
        lastChanged: equipment.lastChanged,
      };
    }
    return data;
  }

  /**
   * Restores equipment state from serialized data.
   * @param data - Serialized equipment data
   */
  deserialize(data: Record<string, AgentEquipment>): void {
    this.equipmentByAgent.clear();
    for (const [agentId, equipment] of Object.entries(data)) {
      this.equipmentByAgent.set(agentId, {
        slots: { ...equipment.slots },
        lastChanged: equipment.lastChanged,
      });
    }
  }





  /**
   * Deposits a tool into shared storage.
   * @param itemId - The tool item ID
   * @param quantity - Number to deposit (default 1)
   */
  depositTool(itemId: string, quantity: number = 1): void {
    const existing = this.toolStorage.get(itemId);
    if (existing) {
      existing.quantity += quantity;
      existing.lastAdded = Date.now();
    } else {
      this.toolStorage.set(itemId, {
        itemId,
        quantity,
        lastAdded: Date.now(),
      });
    }
    logger.debug(`🔧 [ToolStorage] Deposited ${quantity}x ${itemId}`);
  }

  /**
   * Checks if a specific tool is available in shared storage.
   * @param itemId - The tool item ID
   * @returns true if at least one is available
   */
  hasToolInStorage(itemId: string): boolean {
    const stored = this.toolStorage.get(itemId);
    return stored !== undefined && stored.quantity > 0;
  }

  /**
   * Gets available quantity of a tool in shared storage.
   * @param itemId - The tool item ID
   * @returns Available quantity
   */
  getToolQuantity(itemId: string): number {
    return this.toolStorage.get(itemId)?.quantity ?? 0;
  }

  /**
   * Claims a tool from shared storage for an agent.
   * @param agentId - The agent claiming the tool
   * @param itemId - The tool item ID
   * @returns true if successfully claimed
   */
  claimTool(agentId: string, itemId: string): boolean {
    const stored = this.toolStorage.get(itemId);
    if (!stored || stored.quantity <= 0) {
      return false;
    }

    stored.quantity--;
    if (stored.quantity <= 0) {
      this.toolStorage.delete(itemId);
    }

    this.claimedTools.set(agentId, itemId);

    logger.info(`🔧 [ToolStorage] ${agentId} claimed ${itemId}`);
    return true;
  }

  /**
   * Returns a tool to shared storage (when agent no longer needs it).
   * @param agentId - The agent returning the tool
   */
  returnTool(agentId: string): void {
    const itemId = this.claimedTools.get(agentId);
    if (itemId) {
      this.depositTool(itemId, 1);
      this.claimedTools.delete(agentId);
      logger.debug(`🔧 [ToolStorage] ${agentId} returned ${itemId}`);
    }
  }

  /**
   * Finds the best available tool for a role in shared storage.
   * Tools are prioritized by their order in the category array.
   * @param role - The role needing a tool
   * @returns The best available tool itemId, or undefined if none
   */
  findToolForRole(role: string): string | undefined {
    const neededTools = ROLE_TOOL_NEEDS[role.toLowerCase()];
    if (!neededTools) {
      return undefined;
    }

    for (const toolId of neededTools) {
      if (this.hasToolInStorage(toolId)) {
        return toolId;
      }
    }

    return undefined;
  }

  /**
   * Checks if a role requires a tool to perform its primary task.
   * @param role - The role to check
   * @returns true if the role needs a tool for its main activity
   */
  roleRequiresTool(role: string): boolean {
    const key = role.toLowerCase();
    return key === "hunter" || key === "guard";
  }

  /**
   * Checks if any weapon is available in shared storage.
   * Useful to determine if agents should craft more weapons.
   * @returns true if at least one weapon is available
   */
  hasAnyWeapon(): boolean {
    for (const weaponId of TOOL_CATEGORIES.HUNTING_WEAPONS) {
      if (this.hasToolInStorage(weaponId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets what tool an agent has claimed from shared storage.
   * @param agentId - The agent to check
   * @returns The claimed tool itemId, or undefined
   */
  getAgentClaimedTool(agentId: string): string | undefined {
    return this.claimedTools.get(agentId);
  }

  /**
   * Gets all available tools in shared storage.
   * @returns Array of [itemId, quantity] pairs
   */
  getAllStoredTools(): Array<[string, number]> {
    return Array.from(this.toolStorage.entries()).map(([id, tool]) => [
      id,
      tool.quantity,
    ]);
  }

  /**
   * Gets storage statistics.
   */
  getStorageStats(): {
    totalTools: number;
    uniqueTypes: number;
    claimedCount: number;
  } {
    let totalTools = 0;
    for (const tool of this.toolStorage.values()) {
      totalTools += tool.quantity;
    }
    return {
      totalTools,
      uniqueTypes: this.toolStorage.size,
      claimedCount: this.claimedTools.size,
    };
  }

  /**
   * Clears all shared tool storage (for testing or reset).
   */
  clearStorage(): void {
    this.toolStorage.clear();
    this.claimedTools.clear();
  }
}

/**
 * Singleton instance of the equipment system.
 * Includes both personal equipment and shared tool storage.
 */
export const equipmentSystem = new EquipmentSystem();

/**
 * @deprecated Use equipmentSystem instead. Kept for backward compatibility.
 */
export const toolStorage = equipmentSystem;
