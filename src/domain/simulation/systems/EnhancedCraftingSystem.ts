import { InventorySystem } from "./InventorySystem";
import type { GameState } from "../../types/game-types";
import type {
  WeaponId,
  CraftingRecipe,
  CraftingJob,
} from "../../types/simulation/crafting";
import { RecipesCatalog } from "../../../simulation/data/RecipesCatalog";
import { simulationEvents, GameEventNames } from "../core/events";
import type { ResourceType } from "../../types/simulation/economy";

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

const BASE_WEAPONS: WeaponId[] = ["stone_dagger", "wooden_club"];

const BASIC_RECIPE_IDS = [
  "wood_to_plank",
  "make_rope",
  "cook_meat",
  "cook_fish",
  "wooden_club",
];

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class EnhancedCraftingSystem {
  private readonly config: EnhancedCraftingConfig;
  private readonly now: () => number;
  private readonly knownRecipes = new Map<
    string,
    Map<string, AgentRecipeState>
  >();
  private readonly activeJobs = new Map<string, CraftingJob>();
  private readonly equippedWeapons = new Map<string, WeaponId>();

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem) private readonly inventorySystem: InventorySystem,
  ) {
    this.config = DEFAULT_CONFIG;
    this.now = () => Date.now();
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

    simulationEvents.emit(GameEventNames.CRAFTING_JOB_STARTED, {
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

    if (success) {
      this.applyOutput(job.agentId, recipe);
    }

    this.registerRecipeUsage(job.agentId, recipe.id, success);

    simulationEvents.emit(GameEventNames.CRAFTING_JOB_COMPLETED, {
      agentId: job.agentId,
      recipeId: recipe.id,
      success,
    });
  }

  private applyOutput(agentId: string, recipe: CraftingRecipe): void {
    const output = recipe.output.itemId;
    if (
      output === "wood" ||
      output === "stone" ||
      output === "food" ||
      output === "water"
    ) {
      this.inventorySystem.addResource(agentId, output, recipe.output.quantity);
      return;
    }

    if (BASE_WEAPONS.includes(output as WeaponId)) {
      this.equippedWeapons.set(agentId, output as WeaponId);
    }
  }

  private hasIngredients(agentId: string, recipe: CraftingRecipe): boolean {
    const inventory = this.inventorySystem.getAgentInventory(agentId);
    if (!inventory) return false;

    for (const ingredient of recipe.ingredients) {
      const key = this.mapToResourceKey(ingredient.itemId);
      // Si el ingrediente no está mapeado, no podemos verificar si lo tenemos
      // Por lo tanto, no podemos craftar
      if (!key) return false;
      if ((inventory[key] ?? 0) < ingredient.quantity) {
        return false;
      }
    }

    return true;
  }

  private consumeIngredients(agentId: string, recipe: CraftingRecipe): void {
    for (const ingredient of recipe.ingredients) {
      const key = this.mapToResourceKey(ingredient.itemId);
      if (!key) continue;
      this.inventorySystem.removeFromAgent(agentId, key, ingredient.quantity);
    }
  }

  private mapToResourceKey(itemId: string): ResourceType | null {
    // Mapeo directo
    if (
      itemId === "wood" ||
      itemId === "stone" ||
      itemId === "food" ||
      itemId === "water"
    ) {
      return itemId;
    }
    // Mapeo de recursos procesados a recursos base
    if (itemId === "wood_log") {
      return "wood";
    }
    // fiber no está en el inventario básico, así que retornamos null
    // Esto significa que no podemos craftar recetas que requieren fiber
    // hasta que se extienda el sistema de inventario
    return null;
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
