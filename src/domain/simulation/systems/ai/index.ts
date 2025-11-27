/**
 * AI Subsystem Module Exports
 *
 * This directory contains modular components extracted from the main AISystem
 * to improve maintainability and reduce file size.
 *
 * Structure:
 * - core/: Core AI components (state, planning, validation, execution)
 * - evaluators/: Goal evaluators for different agent behaviors
 * - handlers/: Zone and event handlers (future use)
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
 *
 * Evaluators:
 * - NeedsEvaluator, CraftingEvaluator, DepositEvaluator, etc.
 */

export { AIStateManager } from "./core/AIStateManager";
export {
  AIGoalValidator,
  type AIGoalValidatorDeps,
} from "./core/AIGoalValidator";
export {
  AIActionPlanner,
  type AIActionPlannerDeps,
} from "./core/AIActionPlanner";
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

export { planGoals, type AgentGoalPlannerDeps } from "./core/AgentGoalPlanner";
export { PriorityManager } from "./core/PriorityManager";

export * from "./core/ActivityMapper";

export * from "./evaluators/NeedsEvaluator";
export * from "./evaluators/CraftingEvaluator";
export * from "./evaluators/DepositEvaluator";
export * from "./evaluators/AssistEvaluator";
export * from "./evaluators/AttentionEvaluator";
export * from "./evaluators/BuildingContributionEvaluator";
export * from "./evaluators/CombatEvaluator";
export * from "./evaluators/ConstructionEvaluator";
export * from "./evaluators/ExpansionEvaluator";
export * from "./evaluators/OpportunitiesEvaluator";
export * from "./evaluators/QuestEvaluator";
export * from "./evaluators/TradeEvaluator";

export {
  selectBestZone,
  getUnexploredZones,
  prioritizeGoals,
  getGoalTier,
  getRecommendedZoneIdsForNeed,
} from "./core/utils";
