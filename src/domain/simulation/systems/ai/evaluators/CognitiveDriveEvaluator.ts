import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import { GoalType, WorkEthic } from "../../../../../shared/constants/AIEnums";
import { ExplorationType } from "../../../../../shared/constants/AgentEnums";
import type { RoleType } from "../../../../types/simulation/roles";
import { RoleType as RoleTypeEnum } from "../../../../../shared/constants/RoleEnums";
import { TimeOfDayPhase } from "../../../../../shared/constants/TimeEnums";

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

  let workDrive = 0.3;

  if (personality.workEthic === WorkEthic.WORKAHOLIC) workDrive += 0.3;
  if (personality.workEthic === WorkEthic.LAZY) workDrive -= 0.2;

  const role = deps.getAgentRole?.(aiState.entityId);
  if (role && role.roleType !== RoleTypeEnum.IDLE) {
    workDrive += 0.2;
  }

  const timeOfDay = deps.getCurrentTimeOfDay?.() || "day";
  if (timeOfDay === TimeOfDayPhase.NIGHT || timeOfDay === TimeOfDayPhase.DEEP_NIGHT) {
    workDrive -= 0.5;
  }

  if (workDrive > 0.5) {
    goals.push({
      id: `cognitive_work_${aiState.entityId}_${now}`,
      type: GoalType.WORK,
      priority: workDrive,
      createdAt: now,
      expiresAt: now + 30000,
    });
  }

  let exploreDrive = 0.2;

  if (personality.explorationType === ExplorationType.ADVENTUROUS)
    exploreDrive += 0.3;
  if (personality.explorationType === ExplorationType.CAUTIOUS)
    exploreDrive -= 0.1;

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
