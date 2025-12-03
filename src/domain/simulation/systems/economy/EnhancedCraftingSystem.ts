import { InventorySystem } from "./InventorySystem";
import type { GameState } from "@/shared/types/game-types";
import { WeaponId } from "../../../../shared/constants/CraftingEnums";
import type {
  CraftingRecipe,
  CraftingJob,
} from "@/shared/types/simulation/crafting";
import { RecipesCatalog } from "../../../data/RecipesCatalog";
import { simulationEvents, GameEventType } from "../../core/events";
import type { ResourceType } from "@/shared/types/simulation/economy";
import { itemToInventoryResource } from "@/shared/types/simulation/resourceMapping";
import { logger } from "../../../../infrastructure/utils/logger";
import { equipmentSystem } from "../agents/EquipmentSystem";
import { EquipmentSlot } from "../../../../shared/constants/EquipmentEnums";
import type { HandlerResult, ICraftingSystem } from "../agents/SystemRegistry";

interface EnhancedCraftingConfig {
  requireWorkstation: boolean;
  minSuccessRate: number;
}

const DEFAULT_CONFIG: EnhancedCraftingConfig = {
  requireWorkstation: false,
  minSuccessRate: 0.4,
};

type AgentRecipeState = {
  successRate: number;
  timesUsed: number;
};

const BASE_WEAPONS: WeaponId[] = [WeaponId.STONE_DAGGER, WeaponId.WOODEN_CLUB];

const BASIC_RECIPE_IDS = [
  "wood_to_plank",
  "make_rope",
  "cook_meat",
  "cook_fish",
  "wooden_club",
];

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import { QuestStatus } from "../../../../shared/constants/QuestEnums";
import { RecipeDiscoverySystem } from "./RecipeDiscoverySystem";

@injectable()
export class EnhancedCraftingSystem implements ICraftingSystem {
  public readonly name = "crafting";
  private readonly config: EnhancedCraftingConfig;
  private readonly now: () => number;
  /**
   * Deprecated local state. Recipe knowledge is centralized in RecipeDiscoverySystem.
   * Kept only for backward compatibility if discovery system is unavailable in tests.
   */
  private readonly knownRecipes = new Map<string, Map<string, AgentRecipeState>>();
  private readonly activeJobs = new Map<string, CraftingJob>();
  private readonly equippedWeapons = new Map<string, WeaponId>();

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
    @inject(TYPES.RecipeDiscoverySystem)
    @optional()
    private readonly recipeDiscovery?: RecipeDiscoverySystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.now = (): number => Date.now();
  }

  public update(): void {
    const now = this.now();
    for (const job of this.activeJobs.values()) {
      if (job.finishesAt <= now) {
        this.finishJob(job);
      }
    }
  }

  public canCraftWeapon(agentId: string, weaponId: WeaponId): boolean {
    const recipe = RecipesCatalog.getRecipeById(weaponId);
    if (!recipe) return false;

    if (this.config.requireWorkstation && !this.hasCraftingStation()) {
      return false;
    }

    return this.hasIngredients(agentId, recipe);
  }

  public craftBestWeapon(agentId: string): WeaponId | null {
    for (const weapon of BASE_WEAPONS) {
      if (this.canCraftWeapon(agentId, weapon)) {
        const crafted = this.startCrafting(agentId, weapon);
        if (crafted) {
          return weapon;
        }
      }
    }
    return null;
  }

  public getEquippedWeapon(agentId: string): WeaponId | undefined {
    return this.equippedWeapons.get(agentId);
  }

  private startCrafting(agentId: string, recipeId: string): boolean {
    const recipe = RecipesCatalog.getRecipeById(recipeId);
    if (!recipe) return false;
    if (!this.hasIngredients(agentId, recipe)) return false;

    this.consumeIngredients(agentId, recipe);

    const job: CraftingJob = {
      agentId,
      recipeId,
      startedAt: this.now(),
      finishesAt: this.now() + recipe.craftingTime,
    };

    this.activeJobs.set(agentId, job);

    simulationEvents.emit(GameEventType.CRAFTING_JOB_STARTED, {
      agentId,
      recipeId,
      duration: recipe.craftingTime,
    });

    return true;
  }

  private finishJob(job: CraftingJob): void {
    this.activeJobs.delete(job.agentId);
    const recipe = RecipesCatalog.getRecipeById(job.recipeId);
    if (!recipe) return;

    const successRate =
      this.getRecipeState(job.agentId, recipe.id)?.successRate ??
      recipe.successRate ??
      0.5;
    const success =
      Math.random() < Math.max(this.config.minSuccessRate, successRate);

    logger.info(
      `⚒️ [finishJob] ${job.agentId}: Recipe=${recipe.id}, success=${success}`,
    );

    if (success) {
      this.applyOutput(job.agentId, recipe);
    }

    this.registerRecipeUsage(job.agentId, recipe.id, success);

    simulationEvents.emit(GameEventType.CRAFTING_JOB_COMPLETED, {
      agentId: job.agentId,
      recipeId: recipe.id,
      success,
    });
  }

  /**
   * Applies the output of a completed crafting recipe.
   * Due to the simplified inventory system (ResourceType only),
   * crafted items are converted to their base resource type.
   *
   * For weapons: If agent already has a weapon equipped, deposit to shared storage.
   * This enables Craftsmen to make tools for the community.
   */
  private applyOutput(agentId: string, recipe: CraftingRecipe): void {
    const output = recipe.output.itemId;
    logger.info(`⚒️ [applyOutput] ${agentId}: Output=${output}`);

    if (BASE_WEAPONS.includes(output as WeaponId)) {
      const currentWeapon = this.equippedWeapons.get(agentId);
      if (currentWeapon) {
        logger.info(
          `⚒️ [applyOutput] ${agentId}: Already has ${currentWeapon}, depositing ${output}`,
        );
        equipmentSystem.depositTool(output, recipe.output.quantity);
        simulationEvents.emit(GameEventType.ITEM_CRAFTED, {
          agentId,
          itemId: output,
          quantity: recipe.output.quantity,
          deposited: true,
        });
        return;
      }

      logger.info(`⚒️ [applyOutput] ${agentId}: Equipping weapon ${output}`);
      this.equippedWeapons.set(agentId, output as WeaponId);

      equipmentSystem.equipItem(agentId, EquipmentSlot.MAIN_HAND, output);
      logger.info(
        `⚒️ [applyOutput] ${agentId}: Weapon registered in equipmentSystem`,
      );
      return;
    }

    const resourceKey = this.mapToResourceKey(output);
    if (resourceKey) {
      this.inventorySystem.addResource(
        agentId,
        resourceKey,
        recipe.output.quantity,
      );
    }
  }

  /**
   * Checks if ingredients are available either in agent's inventory or stockpiles.
   * First checks agent inventory, then falls back to settlement stockpiles.
   */
  private hasIngredients(agentId: string, recipe: CraftingRecipe): boolean {
    const inventory = this.inventorySystem.getAgentInventory(agentId);

    const stockpileResources =
      this.inventorySystem.getTotalStockpileResources();
    const allStockpiles = this.inventorySystem.getAllStockpiles();

    logger.debug(
      `🔨 [Craft] ${agentId}: Checking ingredients - stockpiles=${allStockpiles.length}, wood=${stockpileResources.wood}, stone=${stockpileResources.stone}, inv.wood=${inventory?.wood ?? 0}, inv.stone=${inventory?.stone ?? 0}`,
    );

    for (const ingredient of recipe.ingredients) {
      const key = this.mapToResourceKey(ingredient.itemId);
      if (!key) {
        return false;
      }

      const haveInInventory = inventory?.[key] ?? 0;
      const haveInStockpile = stockpileResources[key] ?? 0;
      const totalAvailable = haveInInventory + haveInStockpile;

      if (totalAvailable < ingredient.quantity) {
        logger.debug(
          `🔨 [Craft] ${agentId}: Missing ${ingredient.itemId} (inv=${haveInInventory}, stockpile=${haveInStockpile}, need=${ingredient.quantity})`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Consumes ingredients from agent inventory first, then from stockpiles.
   */
  private consumeIngredients(agentId: string, recipe: CraftingRecipe): void {
    for (const ingredient of recipe.ingredients) {
      const key = this.mapToResourceKey(ingredient.itemId);
      if (!key) continue;

      let remaining = ingredient.quantity;

      const inventory = this.inventorySystem.getAgentInventory(agentId);
      if (inventory) {
        const fromAgent = Math.min(inventory[key] ?? 0, remaining);
        if (fromAgent > 0) {
          this.inventorySystem.removeFromAgent(agentId, key, fromAgent);
          remaining -= fromAgent;
        }
      }

      if (remaining > 0) {
        const stockpiles = this.inventorySystem.getAllStockpiles();
        for (const stockpile of stockpiles) {
          const available = stockpile.inventory[key] ?? 0;
          const fromStockpile = Math.min(available, remaining);
          if (fromStockpile > 0) {
            this.inventorySystem.consumeFromStockpile(stockpile.id, {
              [key]: fromStockpile,
            });
            remaining -= fromStockpile;
            if (remaining <= 0) break;
          }
        }
      }
    }
  }

  /**
   * Maps item IDs to base resource types.
   * This is a workaround for the architectural mismatch between:
   * - RecipesCatalog (uses specific item IDs like "fiber", "iron_ore", "wheat")
   * - Inventory system (uses only ResourceType: wood|stone|food|water|rare_materials)
   *
   * Items are collapsed into their closest resource category.
   */
  private mapToResourceKey(itemId: string): ResourceType | null {
    return itemToInventoryResource(itemId);
  }

  private registerRecipeUsage(
    agentId: string,
    recipeId: string,
    success: boolean,
  ): void {
    const recipes = this.getOrCreateRecipeMap(agentId);
    const state = recipes.get(recipeId) ?? {
      successRate: RecipesCatalog.getRecipeById(recipeId)?.successRate ?? 0.6,
      timesUsed: 0,
    };

    state.timesUsed += 1;
    if (success) {
      state.successRate = Math.min(0.99, state.successRate + 0.02);
    }

    recipes.set(recipeId, state);
  }

  private hasCraftingStation(): boolean {
    return (this.state.zones || []).some(
      (zone) => (zone as ZoneWithMetadata).metadata?.craftingStation,
    );
  }

  public getKnownRecipes(agentId: string): Map<string, AgentRecipeState> | undefined {
    if (this.recipeDiscovery) {
      const map = new Map<string, AgentRecipeState>();
      const known = this.recipeDiscovery.getAgentRecipes(agentId);
      for (const rec of known) {
        map.set(rec.recipeId, {
          successRate: rec.successRate,
          timesUsed: rec.timesUsed,
        });
      }
      return map;
    }
    return this.knownRecipes.get(agentId);
  }

  /**
   * Returns all active crafting jobs as an array for snapshot serialization.
   */
  public getActiveJobs(): Array<{
    id: string;
    agentId: string;
    recipeId: string;
    finishesAt: number;
    progress: number;
  }> {
    const now = this.now();
    return Array.from(this.activeJobs.entries()).map(([agentId, job]) => {
      const duration = job.finishesAt - job.startedAt;
      const elapsed = now - job.startedAt;
      const progress = Math.min(1, elapsed / duration);
      return {
        id: `${agentId}_${job.recipeId}`,
        agentId,
        recipeId: job.recipeId,
        finishesAt: job.finishesAt,
        progress,
      };
    });
  }

  /**
   * Returns all known recipes for all agents as a Record for snapshot serialization.
   * Initializes basic recipes for all agents if not yet initialized.
   */
  public getAllKnownRecipes(): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    if (this.recipeDiscovery) {
      const agents = this.state.agents || [];
      for (const agent of agents) {
        const known = this.recipeDiscovery.getAgentRecipes(agent.id);
        result[agent.id] = known.map((r) => r.recipeId);
      }
      return result;
    }

    const agents = this.state.agents || [];
    for (const agent of agents) {
      if (!this.knownRecipes.has(agent.id)) {
        this.getOrCreateRecipeMap(agent.id);
      }
      const map = this.knownRecipes.get(agent.id)!;
      result[agent.id] = Array.from(map.keys());
    }
    return result;
  }

  /**
   * Returns crafting snapshot data for the frontend.
   */
  public getCraftingSnapshot(): {
    activeJobs: Array<{
      id: string;
      agentId: string;
      recipeId: string;
      finishesAt: number;
      progress: number;
    }>;
    knownRecipes: Record<string, string[]>;
    equippedWeapons: Record<string, string>;
  } {
    const equippedWeapons: Record<string, string> = {};
    for (const [agentId, weaponId] of this.equippedWeapons.entries()) {
      equippedWeapons[agentId] = weaponId;
    }

    return {
      activeJobs: this.getActiveJobs(),
      knownRecipes: this.getAllKnownRecipes(),
      equippedWeapons,
    };
  }

  private getRecipeState(
    agentId: string,
    recipeId: string,
  ): AgentRecipeState | undefined {
    return this.knownRecipes.get(agentId)?.get(recipeId);
  }

  private getOrCreateRecipeMap(agentId: string): Map<string, AgentRecipeState> {
    let map = this.knownRecipes.get(agentId);
    if (!map) {
      map = new Map();
      BASIC_RECIPE_IDS.forEach((recipeId) => {
        const recipe = RecipesCatalog.getRecipeById(recipeId);
        if (recipe) {
          map!.set(recipe.id, {
            successRate: recipe.successRate ?? 0.6,
            timesUsed: 0,
          });
        }
      });
      this.knownRecipes.set(agentId, map);
    }
    return map;
  }



  /**
   * Verifica si un agente puede craftear una receta.
   * @param agentId - ID del agente
   * @param recipeId - ID de la receta
   */
  public canCraft(agentId: string, recipeId: string): boolean {
    const recipe = RecipesCatalog.getRecipeById(recipeId);
    if (!recipe) return false;

    if (this.config.requireWorkstation && !this.hasCraftingStation()) {
      return false;
    }

    // Agent must know the recipe (from RecipeDiscovery), unless it is a basic one
    const isBasic = BASIC_RECIPE_IDS.includes(recipeId);
    const knowsRecipe = this.recipeDiscovery
      ? this.recipeDiscovery.agentKnowsRecipe(agentId, recipeId)
      : this.getOrCreateRecipeMap(agentId).has(recipeId);

    if (!isBasic && !knowsRecipe) return false;

    return this.hasIngredients(agentId, recipe);
  }

  /**
   * Solicita el crafteo de una receta.
   * @param agentId - ID del agente que crafteará
   * @param recipeId - ID de la receta a craftear
   */
  public requestCraft(agentId: string, recipeId: string): HandlerResult {

    if (!this.canCraft(agentId, recipeId)) {
      return {
        status: QuestStatus.FAILED,
        system: "crafting",
        message: `Cannot craft ${recipeId}: missing ingredients or workstation`,
      };
    }


    const started = this.startCrafting(agentId, recipeId);
    if (!started) {
      return {
        status: QuestStatus.FAILED,
        system: "crafting",
        message: `Failed to start crafting ${recipeId}`,
      };
    }

    const job = this.activeJobs.get(agentId);
    if (job) {
      return {
        status: "in_progress",
        system: "crafting",
        message: `Started crafting ${recipeId}`,
        data: {
          agentId: job.agentId,
          finishesAt: job.finishesAt,
          recipeId: job.recipeId,
        },
      };
    }

    return {
      status: "completed",
      system: "crafting",
      message: `Instant crafting of ${recipeId} completed`,
    };
  }
}

export interface CraftingMetadata {
  craftingStation?: boolean;
  craftingType?: string;
  efficiency?: number;
  [key: string]: string | number | boolean | undefined;
}

type ZoneWithMetadata = GameState["zones"][number] & {
  metadata?: CraftingMetadata;
};
