import type { GameState, Zone } from "../../types/game-types";
import type { WeaponId } from "../../types/simulation/crafting";
import { EnhancedCraftingSystem } from "./EnhancedCraftingSystem";

interface CraftingSystemConfig {
  requireCraftingStation: boolean;
}

export interface CraftingMetadata {
  craftingStation?: boolean;
  craftingType?: string;
  efficiency?: number;
  [key: string]: string | number | boolean | undefined;
}

type MutableZone = Zone & {
  metadata?: CraftingMetadata;
};

const DEFAULT_CONFIG: CraftingSystemConfig = {
  requireCraftingStation: true,
};

export class CraftingSystem {
  private readonly config: CraftingSystemConfig;

  constructor(
    private readonly state: GameState,
    private readonly enhancedCrafting: EnhancedCraftingSystem,
    config?: Partial<CraftingSystemConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public canCraftWeapon(agentId: string, weaponId: WeaponId): boolean {
    if (this.config.requireCraftingStation && !this.hasAvailableStation()) {
      return false;
    }
    return this.enhancedCrafting.canCraftWeapon(agentId, weaponId);
  }

  public craftBestWeapon(agentId: string): WeaponId | null {
    if (this.config.requireCraftingStation && !this.hasAvailableStation()) {
      return null;
    }
    return this.enhancedCrafting.craftBestWeapon(agentId);
  }

  public getSuggestedCraftZone(): string | undefined {
    const zone = this.findCraftingStation();
    return zone?.id;
  }

  private hasAvailableStation(): boolean {
    return Boolean(this.findCraftingStation());
  }

  private findCraftingStation(): MutableZone | undefined {
    return (this.state.zones as MutableZone[] | undefined)?.find(
      (zone) => zone.metadata?.craftingStation === true,
    );
  }
}
