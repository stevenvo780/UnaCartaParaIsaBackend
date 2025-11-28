/**
 * Equipment System - Manages equipped items for agents.
 *
 * Handles equipping, unequipping, and querying equipment bonuses.
 * Equipment provides combat bonuses (attack range, damage) and
 * gathering bonuses (speed, yield).
 *
 * @module simulation/systems/EquipmentSystem
 */

import { EquipmentSlot } from "../../shared/constants/EquipmentEnums";
import {
  getEquipmentStats,
  getBestWeapon,
  ROLE_RECOMMENDED_TOOLS,
  type EquipmentStats,
} from "../data/EquipmentStats";

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
 * Equipment System for managing agent equipment.
 */
export class EquipmentSystem {
  /** Equipment state per agent */
  private equipmentByAgent: Map<string, AgentEquipment> = new Map();

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

    // Find the first recommended tool that the agent has
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
}

/**
 * Singleton instance of the equipment system.
 */
export const equipmentSystem = new EquipmentSystem();
