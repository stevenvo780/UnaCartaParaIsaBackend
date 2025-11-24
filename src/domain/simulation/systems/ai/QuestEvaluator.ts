import type { AIState, AIGoal } from "../../../types/simulation/ai";
import type { Quest } from "../../../types/simulation/quests";

export interface QuestEvaluatorDependencies {
  getActiveQuests: () => Quest[];
  getAvailableQuests: () => Quest[];
  getEntityPosition: (id: string) => { x: number; y: number } | null;
}

export function evaluateQuestGoals(
  deps: QuestEvaluatorDependencies,
  aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

  // Check active quests first
  const activeQuests = deps.getActiveQuests();
  for (const quest of activeQuests) {
    if (quest.status !== "active") continue;

    // Find incomplete objectives
    for (const objective of quest.objectives) {
      if (objective.isCompleted) continue;

      let goalType: string = "work";
      let targetZoneId: string | undefined;
      let targetPosition: { x: number; y: number } | undefined;

      switch (objective.type) {
        case "collect_resource":
          goalType = "gather";
          // Will be handled by resource finding in main planner
          break;
        case "build_structure":
          goalType = "work";
          // Find zone with matching building type
          // This is simplified - in practice would need building system
          break;
        case "reach_location":
          goalType = "explore";
          // Would need location data from quest
          break;
        case "kill_entity":
          goalType = "combat";
          // Would need target entity ID
          break;
      }

      if (goalType !== "work" || targetZoneId) {
        goals.push({
          id: `quest_${quest.id}_${objective.id}_${now}`,
          type: goalType as AIGoal["type"],
          priority: 0.6, // Medium-high priority for quests
          targetZoneId,
          targetPosition,
          data: {
            questId: quest.id,
            objectiveId: objective.id,
          },
          createdAt: now,
          expiresAt: now + 30000, // 30 seconds
        });
      }
    }
  }

  // Check available quests - start one if none active
  if (activeQuests.length === 0) {
    const availableQuests = deps.getAvailableQuests();
    if (availableQuests.length > 0) {
      // Start the first available quest
      const quest = availableQuests[0];
      goals.push({
        id: `start_quest_${quest.id}_${now}`,
        type: "social", // Quest acceptance is a social action
        priority: 0.5,
        data: {
          questId: quest.id,
          action: "start_quest",
        },
        createdAt: now,
        expiresAt: now + 10000,
      });
    }
  }

  return goals;
}
