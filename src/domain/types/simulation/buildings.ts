import {
  BuildingType,
  BuildingCondition,
} from "../../../shared/constants/BuildingEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

export { BuildingType as BuildingLabel };

export interface BuildingState {
  zoneId: string;
  durability: number;
  maxDurability: number;
  condition: BuildingCondition;
  lastMaintenanceTime: number;
  lastUsageTime: number;
  usageCount: number;
  isAbandoned: boolean;
  timeSinceLastUse: number;
  deteriorationRate: number;
  isUpgrading?: boolean;
  upgradeStartTime?: number;
}

export interface BuildingMaintenanceConfig {
  usageDegradationRate: number;
  usageDegradationInterval: number;
  abandonmentThreshold: number;
  normalDeteriorationRate: number;
  abandonedDeteriorationRate: number;
  repairEfficiency: number;
  maxDurabilityDecay: number;
  perfectRepairCostMultiplier: number;
  criticalDurabilityThreshold: number;
  ruinedDurabilityThreshold: number;
  destructionThreshold: number;
}

export interface RepairAction {
  zoneId: string;
  agentId: string;
  perfectRepair: boolean;
  durabilityRestored: number;
  resourcesUsed: Partial<Record<ResourceType, number>>;
  timestamp: number;
}

export interface BuildingConstructionCost {
  wood: number;
  stone: number;
  time: number;
}

export const BUILDING_COSTS: Record<BuildingType, BuildingConstructionCost> = {
  [BuildingType.HOUSE]: { wood: 12, stone: 4, time: 25_000 },
  [BuildingType.MINE]: { wood: 6, stone: 10, time: 30_000 },
  [BuildingType.WORKBENCH]: { wood: 8, stone: 4, time: 20_000 },
  [BuildingType.FARM]: { wood: 8, stone: 2, time: 35_000 },
};

export function getBuildingCondition(durability: number): BuildingCondition {
  if (durability >= 90) return BuildingCondition.PRISTINE;
  if (durability >= 70) return BuildingCondition.GOOD;
  if (durability >= 50) return BuildingCondition.FAIR;
  if (durability >= 30) return BuildingCondition.POOR;
  if (durability >= 10) return BuildingCondition.CRITICAL;
  return BuildingCondition.RUINED;
}

export function calculateRepairCost(
  currentDurability: number,
  perfectRepair: boolean,
): Partial<Record<ResourceType, number>> {
  const damagePercent = Math.max(0, 100 - currentDurability) / 100;
  const baseWood = 10;
  const baseStone = 6;

  const multiplier = perfectRepair ? 3 : 1;

  return {
    wood: Math.ceil(baseWood * damagePercent * multiplier),
    stone: Math.ceil(baseStone * damagePercent * multiplier),
  };
}
