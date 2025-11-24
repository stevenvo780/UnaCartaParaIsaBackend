import type { AIGoal } from "../../../types/simulation/ai";

export type ActivityType =
  | "idle"
  | "moving"
  | "eating"
  | "drinking"
  | "cleaning"
  | "playing"
  | "meditating"
  | "working"
  | "resting"
  | "socializing"
  | "inspecting"
  | "fleeing"
  | "attacking";

/**
 * Maps an AIGoal to a corresponding activity type
 */
export function mapGoalToActivity(goal: AIGoal): ActivityType {
  if (goal.type === "satisfy_need") {
    const needToActivity: Record<string, ActivityType> = {
      hunger: "eating",
      thirst: "drinking",
      energy: "resting",
      hygiene: "cleaning",
      social: "socializing",
      fun: "playing",
      mentalHealth: "meditating",
    };
    return needToActivity[goal.data?.need || ""] || "idle";
  }

  const goalToActivity: Partial<Record<AIGoal["type"], ActivityType>> = {
    explore: "moving",
    work: "working",
    social: "socializing",
    rest: "resting",
    inspect: "inspecting",
    flee: "fleeing",
    attack: "attacking",
  };

  return goalToActivity[goal.type] || "idle";
}

/**
 * Returns the expected duration for an activity in milliseconds
 */
export function getActivityDuration(activity: ActivityType): number {
  const durations: Record<ActivityType, number> = {
    idle: 0,
    moving: 0,
    eating: 5000,
    drinking: 3000,
    cleaning: 6000,
    playing: 12000,
    meditating: 10000,
    working: 15000,
    resting: 8000,
    socializing: 8000,
    inspecting: 5000,
    fleeing: 0,
    attacking: 2000,
  };
  return durations[activity];
}

/**
 * Determines if an activity requires a specific zone to be performed
 */
export function activityRequiresZone(activity: ActivityType): boolean {
  const requiresZone = new Set<ActivityType>([
    "eating",
    "drinking",
    "cleaning",
    "playing",
    "meditating",
    "working",
    "resting",
    "socializing",
  ]);
  return requiresZone.has(activity);
}
