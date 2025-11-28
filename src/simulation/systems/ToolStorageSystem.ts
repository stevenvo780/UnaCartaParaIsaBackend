/**
 * Tool Storage System - Simple shared storage for crafted tools.
 *
 * A lightweight system that manages a global pool of available tools.
 * Craftsmen deposit tools here, and agents that need them can claim them.
 *
 * Design goals:
 * - O(1) operations for checking/claiming tools
 * - Minimal memory footprint
 * - No complex dependencies
 *
 * @module simulation/systems/ToolStorageSystem
 */

import { ItemId } from "../../shared/constants/ItemEnums";
import { logger } from "../../infrastructure/utils/logger";

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
 * Simple global tool storage system.
 */
export class ToolStorageSystem {
  /** Available tools: itemId -> quantity */
  private storage = new Map<string, StoredTool>();

  /** Track who has claimed tools: agentId -> itemId */
  private claimedTools = new Map<string, string>();

  /**
   * Deposits a tool into storage.
   * @param itemId - The tool item ID
   * @param quantity - Number to deposit (default 1)
   */
  depositTool(itemId: string, quantity: number = 1): void {
    const existing = this.storage.get(itemId);
    if (existing) {
      existing.quantity += quantity;
      existing.lastAdded = Date.now();
    } else {
      this.storage.set(itemId, {
        itemId,
        quantity,
        lastAdded: Date.now(),
      });
    }
    logger.debug(`🔧 [ToolStorage] Deposited ${quantity}x ${itemId}`);
  }

  /**
   * Checks if a specific tool is available.
   * @param itemId - The tool item ID
   * @returns true if at least one is available
   */
  hasTool(itemId: string): boolean {
    const stored = this.storage.get(itemId);
    return stored !== undefined && stored.quantity > 0;
  }

  /**
   * Gets available quantity of a tool.
   * @param itemId - The tool item ID
   * @returns Available quantity
   */
  getToolQuantity(itemId: string): number {
    return this.storage.get(itemId)?.quantity ?? 0;
  }

  /**
   * Claims a tool from storage for an agent.
   * @param agentId - The agent claiming the tool
   * @param itemId - The tool item ID
   * @returns true if successfully claimed
   */
  claimTool(agentId: string, itemId: string): boolean {
    const stored = this.storage.get(itemId);
    if (!stored || stored.quantity <= 0) {
      return false;
    }

    stored.quantity--;
    if (stored.quantity <= 0) {
      this.storage.delete(itemId);
    }

    this.claimedTools.set(agentId, itemId);

    logger.info(`🔧 [ToolStorage] ${agentId} claimed ${itemId}`);
    return true;
  }

  /**
   * Returns a tool to storage (when agent no longer needs it).
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
   * Finds the best available tool for a role.
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
      if (this.hasTool(toolId)) {
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
   * Checks if any weapon is available in storage.
   * Useful to determine if agents should craft more weapons.
   * @returns true if at least one weapon is available
   */
  hasAnyWeapon(): boolean {
    for (const weaponId of TOOL_CATEGORIES.HUNTING_WEAPONS) {
      if (this.hasTool(weaponId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets what tool an agent has claimed.
   * @param agentId - The agent to check
   * @returns The claimed tool itemId, or undefined
   */
  getAgentTool(agentId: string): string | undefined {
    return this.claimedTools.get(agentId);
  }

  /**
   * Gets all available tools in storage.
   * @returns Array of [itemId, quantity] pairs
   */
  getAllTools(): Array<[string, number]> {
    return Array.from(this.storage.entries()).map(([id, tool]) => [
      id,
      tool.quantity,
    ]);
  }

  /**
   * Gets storage statistics.
   */
  getStats(): {
    totalTools: number;
    uniqueTypes: number;
    claimedCount: number;
  } {
    let totalTools = 0;
    for (const tool of this.storage.values()) {
      totalTools += tool.quantity;
    }
    return {
      totalTools,
      uniqueTypes: this.storage.size,
      claimedCount: this.claimedTools.size,
    };
  }

  /**
   * Clears all storage (for testing or reset).
   */
  clear(): void {
    this.storage.clear();
    this.claimedTools.clear();
  }
}

/**
 * Singleton instance of tool storage.
 */
export const toolStorage = new ToolStorageSystem();
