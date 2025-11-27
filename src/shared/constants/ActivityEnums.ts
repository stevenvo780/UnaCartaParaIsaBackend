/**
 * Activity type enumerations for the simulation system.
 *
 * @deprecated ActivityType has been moved to MovementEnums.ts to avoid duplication.
 * Please use ActivityType from MovementEnums instead.
 *
 * @module shared/constants/ActivityEnums
 */

// Re-export ActivityType from MovementEnums for backward compatibility
export {
  ActivityType,
  type ActivityTypeValue,
  ALL_ACTIVITY_TYPES,
  isActivityType,
} from "./MovementEnums";
