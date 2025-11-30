/**
 * AI Subsystem Module Exports
 *
 * This directory contains modular components extracted from the main AISystem
 * to improve maintainability and reduce file size.
 *
 * Structure:
 * - core/: Core AI components (state, planning, validation, execution)
 * - evaluators/: Goal evaluators for different agent behaviors
 * - AIContext.ts: Unified interface for AI dependencies
 * - AIContextAdapter.ts: Implementation adapting AISystem to IAIContext
 *
 * Components:
 * - AIStateManager: Manages AI state creation, personality, and memory
 * - AIGoalValidator: Validates and checks goal completion/expiration
 * - AIActionPlanner: Plans actions based on current goals
 * - AIActionExecutor: Executes planned actions
 * - AIUrgentGoals: Creates urgent goals for critical needs
 * - AIZoneHandler: Handles zone arrival and resource deposits
 * - AgentGoalPlanner: High-level goal planning and evaluation
 * - PriorityManager: Manages priority queue for agent processing
 * - IAIContext: Unified dependency interface
 * - AIContextAdapter: Bridges AISystem to IAIContext
 *
 * Evaluators:
 * - NeedsEvaluator, CraftingEvaluator, DepositEvaluator, etc.
 */

// Unified AI Context (replaces multiple *Deps interfaces)
export type {
  IAIContext,
  Position,
  ResourceLocation,
  AnimalLocation,
  AgentLocation,
  AIContextCacheConfig,
} from "./AIContext";
export { DEFAULT_CACHE_CONFIG } from "./AIContext";
export {
  AIContextAdapter,
  type AIContextSystems,
  type AIContextCallbacks,
} from "./AIContextAdapter";

// Work goal generation helper
export {
  generateRoleBasedWorkGoal,
  type FindResourceFn,
} from "./core/WorkGoalGenerator";

export { AIStateManager } from "./core/AIStateManager";
export {
  AIGoalValidator,
  type AIGoalValidatorDeps,
} from "./core/AIGoalValidator";
export {
  SimpleActionPlanner,
  type SimpleActionPlannerDeps,
} from "./core/SimpleActionPlanner";
export {
  AIActionExecutor,
  type AIActionExecutorDeps,
} from "./core/AIActionExecutor";
export { AIUrgentGoals, type AIUrgentGoalsDeps } from "./core/AIUrgentGoals";
export {
  AIZoneHandler,
  type AIZoneHandlerDeps,
  type AIZoneInventoryPort,
  type AIZoneCraftingPort,
  type AIZoneQuestPort,
  type AIZoneRolePort,
  type AIZoneSocialPort,
  type AIZoneHouseholdPort,
  type AIZoneNeedsPort,
} from "./core/AIZoneHandler";

export { PriorityManager } from "./core/PriorityManager";

// NEW: Simplified Goal Planning System (declarative rules)
export type { GoalRule, GoalContext } from "./core/GoalRule";
export {
  evaluateRules,
  needUtility,
  socialNeedUtility,
  personalityFactor,
} from "./core/GoalRule";
export {
  coreRules,
  extendedRules,
  fullRules,
  hungerRule,
  thirstRule,
  energyRule,
  socialRule,
  funRule,
  mentalHealthRule,
  workDriveRule,
  exploreDriveRule,
  defaultExplorationRule,
  reproductionRule,
  gatherExpansionRule,
  territoryExpansionRule,
  fleeFromEnemyRule,
  fleeFromPredatorRule,
  attackPredatorRule,
  constructionRule,
  depositRule,
  craftWeaponRule,
  assistRule,
  tradeRule,
  roleWorkRule,
  huntingRule,
  inspectionRule,
  buildingContributionRule,
  questRule,
} from "./core/GoalRules";
export {
  planGoalsSimplified,
  planGoalsFull,
  type SimplifiedGoalPlannerDeps,
} from "./core/SimplifiedGoalPlanner";

export * from "./core/ActivityMapper";

// Legacy evaluators - Only keeping the most complex ones
export * from "./evaluators/NeedsEvaluator";
export * from "./evaluators/CollectiveNeedsEvaluator";

export {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getGoalTier,
  getRecommendedZoneIdsForNeed,
} from "./core/utils";
