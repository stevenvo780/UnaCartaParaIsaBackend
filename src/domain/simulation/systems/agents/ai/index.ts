/**
 * AI Subsystem Module Exports
 *
 * ARQUITECTURA v3 (2024-11-30):
 * =============================
 *
 * Flujo simplificado:
 * ```
 * Sistemas externos → emitTask() → TaskQueue → AISystem.update() → Handler
 * ```
 *
 * Los sistemas (NeedsSystem, CombatSystem, etc.) emiten tareas cuando
 * detectan condiciones. Las tareas duplicadas ACUMULAN prioridad,
 * garantizando que eventos urgentes/repetidos se atiendan primero.
 *
 * @module domain/simulation/systems/agents/ai
 */

export { AISystem, type AISystemDeps, type AISystemConfig } from "./AISystem";

export type {
  AgentTask,
  TaskTarget,
  TaskParams,
} from "@/shared/types/simulation/unifiedTasks";

export {
  TaskType,
  TaskStatus,
  TASK_PRIORITIES,
  createTask,
  isTaskExpired,
} from "@/shared/types/simulation/unifiedTasks";

export type { Task, DetectorContext, HandlerContext } from "./types";

export { TaskQueue, type TaskQueueConfig } from "./TaskQueue";

export { ALL_DETECTORS, type Detector } from "./detectors";
export { detectNeeds } from "./detectors/NeedsDetector";
export { detectCombat } from "./detectors/CombatDetector";
export { detectWork } from "./detectors/WorkDetector";
export { detectInventory } from "./detectors/InventoryDetector";
export { detectCraft } from "./detectors/CraftDetector";
export { detectBuild } from "./detectors/BuildDetector";
export { detectSocial } from "./detectors/SocialDetector";
export { detectExplore } from "./detectors/ExploreDetector";
export { detectTrade } from "./detectors/TradeDetector";

export {
  handleMove,
  handleGather,
  handleAttack,
  handleFlee,
  handleCraft,
  handleBuild,
  handleDeposit,
  handleSocialize,
  handleRest,
  handleExplore,
  handleTrade,
  handleConsume,
  isAtTarget,
  moveToPosition,
} from "./handlers";

export { SharedKnowledgeSystem } from "./SharedKnowledgeSystem";
