import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { GameState } from "../../../../types/game-types";
import { GoalType, ActionType } from "../../../../../shared/constants/AIEnums";
import { BuildingType } from "../../../../../shared/constants/BuildingEnums";

export interface BuildingContributionDependencies {
  gameState: GameState;
  getEntityPosition: (id: string) => { x: number; y: number } | null;
  getAgentInventory: (id: string) =>
    | {
        wood?: number;
        stone?: number;
        food?: number;
        water?: number;
      }
    | undefined;
}

export function evaluateBuildingContributionGoals(
  deps: BuildingContributionDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

  const constructionZones =
    deps.gameState.zones?.filter(
      (z) =>
        z.metadata &&
        typeof z.metadata === "object" &&
        "underConstruction" in z.metadata &&
        (z.metadata as { underConstruction?: boolean }).underConstruction ===
          true,
    ) || [];

  if (constructionZones.length === 0) return goals;

  const myPos = deps.getEntityPosition(aiState.entityId);
  if (!myPos) return goals;

  const myInventory = deps.getAgentInventory(aiState.entityId);
  const hasResources =
    myInventory &&
    ((myInventory.wood || 0) > 5 || (myInventory.stone || 0) > 5);

  const ranked = constructionZones
    .map((zone) => {
      if (!zone.bounds) return null;

      const cx = zone.bounds.x + zone.bounds.width / 2;
      const cy = zone.bounds.y + zone.bounds.height / 2;
      const dist = Math.hypot(cx - myPos.x, cy - myPos.y);

      const buildingType =
        zone.metadata &&
        typeof zone.metadata === "object" &&
        "building" in zone.metadata
          ? (zone.metadata as { building?: string }).building
          : undefined;

      const needsWood =
        buildingType === BuildingType.HOUSE ||
        buildingType === BuildingType.WORKBENCH;
      const needsStone = buildingType === BuildingType.MINE;

      const canContribute =
        hasResources &&
        ((needsWood && (myInventory?.wood || 0) > 5) ||
          (needsStone && (myInventory?.stone || 0) > 5));

      if (!canContribute) return null;

      return {
        zone,
        score: 1.0 / (1.0 + dist / 100),
        distance: dist,
      };
    })
    .filter(Boolean) as Array<{
    zone: (typeof constructionZones)[0];
    score: number;
    distance: number;
  }>;

  if (ranked.length === 0) return goals;

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];

  goals.push({
    id: `contribute_build_${best.zone.id}_${now}`,
    type: GoalType.WORK,
    priority: 0.5,
    targetZoneId: best.zone.id,
    data: {
      action: ActionType.CONTRIBUTE_RESOURCES,
      buildingType:
        best.zone.metadata &&
        typeof best.zone.metadata === "object" &&
        "building" in best.zone.metadata
          ? (best.zone.metadata as { building?: string }).building
          : undefined,
    },
    createdAt: now,
    expiresAt: now + 15000,
  });

  return goals;
}
