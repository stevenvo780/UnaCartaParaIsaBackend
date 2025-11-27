import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import {
  GoalType,
  WorkEthic,
  ExplorationType,
} from "../../../../../shared/constants/AIEnums";
import type { RoleType } from "../../../../types/simulation/roles";

import type { Inventory } from "../../../../types/simulation/economy";

export interface CognitiveDriveDeps {
  getAgentRole?: (entityId: string) => { roleType: RoleType } | undefined;
  getAgentInventory?: (entityId: string) => Inventory | undefined;
  getCurrentTimeOfDay?: () => string;
}

export function evaluateCognitiveDrives(
  deps: CognitiveDriveDeps,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();
  const personality = aiState.personality;

  // --- Work Drive ---
  // Influenced by WorkEthic and Role
  let workDrive = 0.3; // Base drive

  if (personality.workEthic === WorkEthic.WORKAHOLIC) workDrive += 0.3;
  if (personality.workEthic === WorkEthic.LAZY) workDrive -= 0.2;

  const role = deps.getAgentRole?.(aiState.entityId);
  if (role && role.roleType !== "idle") {
    workDrive += 0.2; // Having a role increases drive
  }

  // Time of day influence
  const timeOfDay = deps.getCurrentTimeOfDay?.() || "day";
  if (timeOfDay === "night" || timeOfDay === "deep_night") {
    workDrive -= 0.5; // Don't work at night usually
  }

  if (workDrive > 0.5) {
    // Generate generic work goal - specific work logic (farming, etc)
    // will be handled by specific evaluators (OpportunitiesEvaluator)
    // but we can boost their priority or add a generic "find work" goal.
    // For now, we'll let OpportunitiesEvaluator handle specific work,
    // but we could add a "boredom" check here to force work if idle.
  }

  // --- Exploration Drive (Curiosity) ---
  let exploreDrive = 0.2;

  if (personality.explorationType === ExplorationType.ADVENTUROUS)
    exploreDrive += 0.3;
  if (personality.explorationType === ExplorationType.CAUTIOUS)
    exploreDrive -= 0.1;

  // Boredom: Increase drive if haven't explored recently
  const lastExplore = aiState.memory.lastExplorationTime || 0;
  const timeSinceExplore = now - lastExplore;

  if (timeSinceExplore > 60000) {
    // 1 minute
    exploreDrive += 0.2;
  }
  if (timeSinceExplore > 300000) {
    // 5 minutes
    exploreDrive += 0.4;
  }

  if (exploreDrive > 0.6) {
    goals.push({
      id: `drive_explore_${aiState.entityId}_${now}`,
      type: GoalType.EXPLORE,
      priority: exploreDrive,
      data: {
        explorationType: "curiosity",
        reason: "cognitive_drive",
      },
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  return goals;
}
