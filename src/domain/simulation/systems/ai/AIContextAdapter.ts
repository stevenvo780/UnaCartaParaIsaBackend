/**
 * @fileoverview AIContext implementation that adapts AISystem to the IAIContext interface.
 *
 * This is a thin adapter that delegates to the various systems already available
 * in AISystem, providing a unified API for all AI operations.
 */

import type {
  IAIContext,
  Position,
  ResourceLocation,
  AnimalLocation,
  AgentLocation,
  AIContextCacheConfig,
  ResourceType,
} from "./AIContext";
import { DEFAULT_CACHE_CONFIG } from "./AIContext";
import type { GameState } from "../../../types/game-types";
import type { EntityNeedsData } from "../../../types/simulation/needs";
import type { AgentRole } from "../../../types/simulation/roles";
import type { Inventory, Stockpile } from "../../../types/simulation/economy";
import type { Task } from "../../../types/simulation/tasks";
import type { SettlementDemand } from "../../../types/simulation/governance";
import type { Quest } from "../../../types/simulation/quests";
import type { NeedsSystem } from "../needs/NeedsSystem";
import type { RoleSystem } from "../RoleSystem";
import type { WorldResourceSystem } from "../WorldResourceSystem";
import type { InventorySystem } from "../InventorySystem";
import type { SocialSystem } from "../SocialSystem";
import type { EnhancedCraftingSystem } from "../EnhancedCraftingSystem";
import type { HouseholdSystem } from "../HouseholdSystem";
import type { TaskSystem } from "../TaskSystem";
import type { CombatSystem } from "../CombatSystem";
import type { AnimalSystem } from "../animals/AnimalSystem";
import type { MovementSystem } from "../movement/MovementSystem";
import type { QuestSystem } from "../QuestSystem";
import type { TimeSystem } from "../TimeSystem";
import type { SharedKnowledgeSystem } from "./SharedKnowledgeSystem";
import type { AgentRegistry } from "../../core/AgentRegistry";
import { equipmentSystem, type EquipmentSystem } from "../EquipmentSystem";
import { EquipmentSlot } from "../../../../shared/constants/EquipmentEnums";

/**
 * Systems that can be injected into AIContextAdapter.
 */
export interface AIContextSystems {
  gameState: GameState;
  agentRegistry: AgentRegistry;
  equipmentSystem: EquipmentSystem;
  needsSystem?: NeedsSystem;
  roleSystem?: RoleSystem;
  worldResourceSystem?: WorldResourceSystem;
  inventorySystem?: InventorySystem;
  socialSystem?: SocialSystem;
  craftingSystem?: EnhancedCraftingSystem;
  householdSystem?: HouseholdSystem;
  taskSystem?: TaskSystem;
  combatSystem?: CombatSystem;
  animalSystem?: AnimalSystem;
  movementSystem?: MovementSystem;
  questSystem?: QuestSystem;
  timeSystem?: TimeSystem;
  sharedKnowledgeSystem?: SharedKnowledgeSystem;
}

/**
 * Callbacks that AISystem needs to provide for resource finding.
 */
export interface AIContextCallbacks {
  findNearestResourceForEntity: (
    agentId: string,
    resourceType: string,
  ) => ResourceLocation | null;
  findNearestHuntableAnimal: (
    agentId: string,
    excludeIds?: Set<string>,
  ) => AnimalLocation | null;
  findAgentWithResource?: (
    agentId: string,
    resourceType: ResourceType,
    minAmount: number,
  ) => AgentLocation | null;
  findPotentialMate?: (agentId: string) => AgentLocation | null;
  findNearbyAgent?: (agentId: string) => AgentLocation | null;
  getEnemiesForAgent?: (agentId: string, threshold?: number) => string[];
  getNearbyPredators?: (
    pos: Position,
    range: number,
  ) => Array<{ id: string; position: Position }>;
}

/**
 * Implementation of IAIContext that adapts existing systems.
 */
export class AIContextAdapter implements IAIContext {
  private readonly systems: AIContextSystems;
  private readonly callbacks: AIContextCallbacks;
  private readonly config: AIContextCacheConfig;

  // Caches
  private activeAgentIdsCache: string[] | null = null;
  private activeAgentIdsCacheTime = 0;
  private suggestedCraftZoneCache: string | null = null;
  private suggestedCraftZoneCacheTime = 0;

  constructor(
    systems: AIContextSystems,
    callbacks: AIContextCallbacks,
    config: AIContextCacheConfig = DEFAULT_CACHE_CONFIG,
  ) {
    this.systems = systems;
    this.callbacks = callbacks;
    this.config = config;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core State
  // ─────────────────────────────────────────────────────────────────────────

  get gameState(): GameState {
    return this.systems.gameState;
  }

  get now(): number {
    return Date.now();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Queries
  // ─────────────────────────────────────────────────────────────────────────

  getPosition(agentId: string): Position | null {
    return this.systems.agentRegistry.getPosition(agentId) ?? null;
  }

  getNeeds(agentId: string): EntityNeedsData | null {
    return this.systems.needsSystem?.getNeeds(agentId) ?? null;
  }

  getInventory(agentId: string): Inventory | null {
    return this.systems.inventorySystem?.getAgentInventory(agentId) ?? null;
  }

  getRole(agentId: string): AgentRole | null {
    return this.systems.roleSystem?.getAgentRole(agentId) ?? null;
  }

  getStrategy(_agentId: string): "peaceful" | "tit_for_tat" | "bully" {
    // Default strategy - can be overridden by AISystem
    return "tit_for_tat";
  }

  isWarrior(agentId: string): boolean {
    const role = this.getRole(agentId);
    return role?.roleType === "hunter" || role?.roleType === "guard";
  }

  getActiveAgentIds(): string[] {
    const now = Date.now();
    if (
      this.activeAgentIdsCache &&
      now - this.activeAgentIdsCacheTime < this.config.agentListCacheTTL
    ) {
      return this.activeAgentIdsCache;
    }

    const agents = this.systems.gameState.agents ?? [];
    this.activeAgentIdsCache = agents.filter((a) => !a.isDead).map((a) => a.id);
    this.activeAgentIdsCacheTime = now;
    return this.activeAgentIdsCache;
  }

  async getNearbyAgents(
    agentId: string,
    radius: number,
  ): Promise<AgentLocation[]> {
    const pos = this.getPosition(agentId);
    if (!pos) return [];

    const result: AgentLocation[] = [];
    const activeIds = this.getActiveAgentIds();

    for (const id of activeIds) {
      if (id === agentId) continue;
      const otherPos = this.getPosition(id);
      if (!otherPos) continue;

      const dist = Math.hypot(otherPos.x - pos.x, otherPos.y - pos.y);
      if (dist <= radius) {
        result.push({ id, x: otherPos.x, y: otherPos.y });
      }
    }

    return result;
  }

  getStats(_agentId: string): Record<string, number> | null {
    // Could be extended to pull from a stats system
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Queries
  // ─────────────────────────────────────────────────────────────────────────

  findNearestResource(
    agentId: string,
    resourceType: string,
  ): ResourceLocation | null {
    return this.callbacks.findNearestResourceForEntity(agentId, resourceType);
  }

  findNearestHuntableAnimal(
    agentId: string,
    excludeIds?: Set<string>,
  ): AnimalLocation | null {
    return this.callbacks.findNearestHuntableAnimal(agentId, excludeIds);
  }

  findAgentWithResource(
    agentId: string,
    resourceType: ResourceType,
    minAmount: number,
  ): AgentLocation | null {
    return (
      this.callbacks.findAgentWithResource?.(
        agentId,
        resourceType,
        minAmount,
      ) ?? null
    );
  }

  findPotentialMate(agentId: string): AgentLocation | null {
    return this.callbacks.findPotentialMate?.(agentId) ?? null;
  }

  findNearbyAgent(agentId: string): AgentLocation | null {
    return this.callbacks.findNearbyAgent?.(agentId) ?? null;
  }

  getAllStockpiles(): Stockpile[] {
    return this.systems.inventorySystem?.getAllStockpiles() ?? [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone Queries
  // ─────────────────────────────────────────────────────────────────────────

  getCurrentZone(entityId: string): string | null {
    const pos = this.getPosition(entityId);
    if (!pos) return null;

    const zones = this.systems.gameState.zones ?? [];
    for (const zone of zones) {
      if (!zone.bounds) continue;
      if (
        pos.x >= zone.bounds.x &&
        pos.x <= zone.bounds.x + zone.bounds.width &&
        pos.y >= zone.bounds.y &&
        pos.y <= zone.bounds.y + zone.bounds.height
      ) {
        return zone.id;
      }
    }
    return null;
  }

  getSuggestedCraftZone(): string | null {
    const now = Date.now();
    if (
      this.suggestedCraftZoneCache !== null &&
      now - this.suggestedCraftZoneCacheTime < this.config.zoneCacheTTL
    ) {
      return this.suggestedCraftZoneCache;
    }

    // Find first work zone (used for crafting)
    const zones = this.systems.gameState.zones ?? [];
    const craftZone = zones.find(
      (z) => z.type === "work" || String(z.type) === "crafting",
    );
    this.suggestedCraftZoneCache = craftZone?.id ?? null;
    this.suggestedCraftZoneCacheTime = now;
    return this.suggestedCraftZoneCache;
  }

  getZonesByType(types: string[]): string[] {
    const zones = this.systems.gameState.zones ?? [];
    return zones.filter((z) => types.includes(z.type)).map((z) => z.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Equipment & Crafting
  // ─────────────────────────────────────────────────────────────────────────

  getEquipped(agentId: string): string | null {
    return (
      this.systems.equipmentSystem.getEquippedItem(
        agentId,
        EquipmentSlot.MAIN_HAND,
      ) ?? null
    );
  }

  canCraftWeapon(agentId: string, weaponId: string): boolean {
    const cs = this.systems.craftingSystem;
    if (!cs) return false;
    // Use type assertion for dynamic method access
    const maybeCraft = cs as unknown as {
      canCraftWeapon?: (id: string, wid: string) => boolean;
    };
    return maybeCraft.canCraftWeapon?.(agentId, weaponId) ?? false;
  }

  hasAvailableWeapons(): boolean {
    return equipmentSystem.findToolForRole("hunter") !== undefined;
  }

  getAttackRange(agentId: string): number {
    return this.systems.equipmentSystem.getAttackRange(agentId);
  }

  hasWeapon(agentId: string): boolean {
    return (
      this.systems.equipmentSystem.getEquippedItem(
        agentId,
        EquipmentSlot.MAIN_HAND,
      ) !== undefined
    );
  }

  tryClaimWeapon(agentId: string): boolean {
    const weapon = equipmentSystem.findToolForRole("hunter");
    if (weapon && equipmentSystem.claimTool(agentId, weapon)) {
      this.systems.equipmentSystem.equipItem(
        agentId,
        EquipmentSlot.MAIN_HAND,
        weapon,
      );
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Combat
  // ─────────────────────────────────────────────────────────────────────────

  getEnemies(agentId: string, threshold?: number): string[] {
    return this.callbacks.getEnemiesForAgent?.(agentId, threshold) ?? [];
  }

  getNearbyPredators(pos: Position, range: number): AnimalLocation[] {
    const predators = this.callbacks.getNearbyPredators?.(pos, range) ?? [];
    return predators.map((p) => ({
      id: p.id,
      x: p.position.x,
      y: p.position.y,
      type: "predator",
    }));
  }

  getAnimalPosition(animalId: string): Position | null {
    const animal = this.systems.animalSystem?.getAnimal(animalId);
    if (animal && !animal.isDead) {
      return { x: animal.position.x, y: animal.position.y };
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tasks & Quests
  // ─────────────────────────────────────────────────────────────────────────

  getAvailableTasks(): Task[] {
    return this.systems.taskSystem?.getAvailableCommunityTasks() ?? [];
  }

  claimTask(taskId: string, agentId: string): boolean {
    return this.systems.taskSystem?.claimTask(taskId, agentId) ?? false;
  }

  getActiveQuests(): Quest[] {
    return this.systems.questSystem?.getActiveQuests() ?? [];
  }

  getAvailableQuests(): Quest[] {
    return this.systems.questSystem?.getAvailableQuests() ?? [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Colony & Time
  // ─────────────────────────────────────────────────────────────────────────

  getTimeOfDay():
    | "dawn"
    | "morning"
    | "midday"
    | "afternoon"
    | "dusk"
    | "night"
    | "deep_night" {
    const tod = this.systems.timeSystem?.getCurrentTimeOfDay();
    // Map TimeSystem values to our expected values
    if (tod === "morning") return "morning";
    if (tod === "afternoon") return "midday";
    if (tod === "evening") return "dusk";
    if (tod === "night") return "night";
    if (tod === "rest") return "deep_night";
    return "midday";
  }

  getPopulation(): number {
    return this.getActiveAgentIds().length;
  }

  getActiveDemands(): SettlementDemand[] {
    // Could be implemented via governance system
    return [];
  }

  getCollectiveResourceState(): {
    foodPerCapita: number;
    waterPerCapita: number;
    stockpileFillRatio: number;
  } | null {
    const stockpiles = this.getAllStockpiles();
    if (stockpiles.length === 0) return null;

    const pop = this.getPopulation();
    if (pop === 0) return null;

    let totalFood = 0;
    let totalWater = 0;
    let totalCapacity = 0;
    let totalStored = 0;

    for (const sp of stockpiles) {
      totalFood += sp.inventory?.food ?? 0;
      totalWater += sp.inventory?.water ?? 0;
      totalCapacity += sp.capacity ?? 0;
      totalStored +=
        (sp.inventory?.food ?? 0) +
        (sp.inventory?.water ?? 0) +
        (sp.inventory?.wood ?? 0) +
        (sp.inventory?.stone ?? 0);
    }

    return {
      foodPerCapita: totalFood / pop,
      waterPerCapita: totalWater / pop,
      stockpileFillRatio: totalCapacity > 0 ? totalStored / totalCapacity : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Knowledge
  // ─────────────────────────────────────────────────────────────────────────

  getKnownResourceAlerts(agentId: string): Array<{
    id: string;
    resourceId: string;
    resourceType: string;
    position: Position;
  }> {
    return (
      this.systems.sharedKnowledgeSystem?.getKnownResourceAlerts(agentId) ?? []
    );
  }

  getKnownThreatAlerts(agentId: string): Array<{
    id: string;
    threatId: string;
    threatType: "predator" | "hostile_agent" | "danger_zone";
    position: Position;
    severity: number;
  }> {
    return (
      this.systems.sharedKnowledgeSystem?.getKnownThreatAlerts(agentId) ?? []
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Invalidates all caches. Call when significant state changes occur.
   */
  invalidateCaches(): void {
    this.activeAgentIdsCache = null;
    this.suggestedCraftZoneCache = null;
  }
}
