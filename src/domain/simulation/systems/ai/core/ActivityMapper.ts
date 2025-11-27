import type { AIGoal } from "../../../../types/simulation/ai";
import { ActivityType } from "../../../../../shared/constants/MovementEnums";

export function mapGoalToActivity(goal: AIGoal): ActivityType {
  if (goal.type === "satisfy_need") {
    const needToActivity: Record<string, ActivityType> = {
      hunger: ActivityType.EATING,
      thirst: ActivityType.DRINKING,
      energy: ActivityType.RESTING,
      hygiene: ActivityType.CLEANING,
      social: ActivityType.SOCIALIZING,
      fun: ActivityType.PLAYING,
      mentalHealth: ActivityType.MEDITATING,
    };
    const need = goal.data?.need;
    if (typeof need === "string") {
      return needToActivity[need] || ActivityType.IDLE;
    }
    return ActivityType.IDLE;
  }

  const goalToActivity: Partial<Record<AIGoal["type"], ActivityType>> = {
    explore: ActivityType.MOVING,
    work: ActivityType.WORKING,
    social: ActivityType.SOCIALIZING,
    rest: ActivityType.RESTING,
    inspect: ActivityType.INSPECTING,
    flee: ActivityType.FLEEING,
    attack: ActivityType.ATTACKING,
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
