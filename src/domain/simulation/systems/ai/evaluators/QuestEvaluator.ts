import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { Quest } from "../../../../types/simulation/quests";
import { GoalType, ActionType } from "../../../../../shared/constants/AIEnums";
import {
  QuestObjectiveType,
  QuestStatus,
} from "../../../../../shared/constants/QuestEnums";

export interface QuestEvaluatorDependencies {
  getActiveQuests: () => Quest[];
  getAvailableQuests: () => Quest[];
  getEntityPosition: (id: string) => { x: number; y: number } | null;
}

export function evaluateQuestGoals(
  deps: QuestEvaluatorDependencies,
  _aiState: AIState,
): AIGoal[] {
  const goals: AIGoal[] = [];
  const now = Date.now();

  const activeQuests = deps.getActiveQuests();
  for (const quest of activeQuests) {
    if (quest.status !== QuestStatus.ACTIVE) continue;

    for (const objective of quest.objectives) {
      if (objective.isCompleted) continue;

      let goalType: GoalType = GoalType.WORK;
      let targetZoneId: string | undefined;
      let targetPosition: { x: number; y: number } | undefined;

      switch (objective.type) {
        case QuestObjectiveType.COLLECT_RESOURCE:
          goalType = GoalType.GATHER;
          break;
        case QuestObjectiveType.BUILD_STRUCTURE:
          goalType = GoalType.WORK;
          break;
        case QuestObjectiveType.REACH_LOCATION:
          goalType = GoalType.EXPLORE;
          break;
        case QuestObjectiveType.KILL_ENTITY:
          goalType = GoalType.COMBAT;
          break;
      }

      if (goalType !== GoalType.WORK || targetZoneId) {
        goals.push({
          id: `quest_${quest.id}_${objective.id}_${now}`,
          type: goalType,
          priority: 0.6,
          targetZoneId,
          targetPosition,
          data: {
            questId: quest.id,
            objectiveId: objective.id,
          },
          createdAt: now,
          expiresAt: now + 30000,
        });
      }
    }
  }

  if (activeQuests.length === 0) {
    const availableQuests = deps.getAvailableQuests();
    if (availableQuests.length > 0) {
      const quest = availableQuests[0];
      goals.push({
        id: `start_quest_${quest.id}_${now}`,
        type: GoalType.SOCIAL,
        priority: 0.5,
        data: {
          questId: quest.id,
          action: ActionType.START_QUEST,
        },
        createdAt: now,
        expiresAt: now + 10000,
      });
    }
  }

  return goals;
}
