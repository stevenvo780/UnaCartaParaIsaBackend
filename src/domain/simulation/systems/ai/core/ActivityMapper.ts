import type { AIGoal } from "../../../../types/simulation/ai";
import { ActivityType } from "../../../../../shared/constants/MovementEnums";
import { GoalType, NeedType } from "../../../../../shared/constants/AIEnums";

export function mapGoalToActivity(goal: AIGoal): ActivityType {
  if (goal.type === GoalType.SATISFY_NEED) {
    const needToActivity: Record<string, ActivityType> = {
      [NeedType.HUNGER]: ActivityType.EATING,
      [NeedType.THIRST]: ActivityType.DRINKING,
      [NeedType.ENERGY]: ActivityType.RESTING,
      [NeedType.HYGIENE]: ActivityType.CLEANING,
      [NeedType.SOCIAL]: ActivityType.SOCIALIZING,
      [NeedType.FUN]: ActivityType.PLAYING,
      [NeedType.MENTAL_HEALTH]: ActivityType.MEDITATING,
    };
    const need = goal.data?.need;
    if (typeof need === "string") {
      return needToActivity[need] || ActivityType.IDLE;
    }
    return ActivityType.IDLE;
  }

  const goalToActivity: Partial<Record<GoalType, ActivityType>> = {
    [GoalType.EXPLORE]: ActivityType.MOVING,
    [GoalType.WORK]: ActivityType.WORKING,
    [GoalType.SOCIAL]: ActivityType.SOCIALIZING,
    [GoalType.REST]: ActivityType.RESTING,
    [GoalType.INSPECT]: ActivityType.INSPECTING,
    [GoalType.FLEE]: ActivityType.FLEEING,
    [GoalType.ATTACK]: ActivityType.ATTACKING,
  };

  return goalToActivity[goal.type] || ActivityType.IDLE;
}

export function getActivityDuration(activity: ActivityType): number {
  const durations: Record<ActivityType, number> = {
    [ActivityType.IDLE]: 0,
    [ActivityType.MOVING]: 0,
    [ActivityType.EATING]: 5000,
    [ActivityType.DRINKING]: 3000,
    [ActivityType.CLEANING]: 6000,
    [ActivityType.PLAYING]: 12000,
    [ActivityType.MEDITATING]: 10000,
    [ActivityType.WORKING]: 15000,
    [ActivityType.RESTING]: 8000,
    [ActivityType.SOCIALIZING]: 8000,
    [ActivityType.INSPECTING]: 5000,
    [ActivityType.FLEEING]: 0,
    [ActivityType.ATTACKING]: 2000,
  };
  return durations[activity];
}

export function activityRequiresZone(activity: ActivityType): boolean {
  const requiresZone = new Set<ActivityType>([
    ActivityType.EATING,
    ActivityType.DRINKING,
    ActivityType.CLEANING,
    ActivityType.PLAYING,
    ActivityType.MEDITATING,
    ActivityType.WORKING,
    ActivityType.RESTING,
    ActivityType.SOCIALIZING,
  ]);
  return requiresZone.has(activity);
}
