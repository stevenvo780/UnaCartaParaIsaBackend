/**
 * @fileoverview Agent Systems - Barrel exports
 *
 * Exporta todos los sistemas relacionados con agentes.
 *
 * @module domain/simulation/systems/agents
 */

// Registry
export { SystemRegistry } from "./SystemRegistry";
export type {
  HandlerResult,
  ISystem,
  IMovementSystem,
  ICombatSystem,
  INeedsSystem,
  IInventorySystem,
  ISocialSystem,
  ICraftingSystem,
  IBuildingSystem,
  ITradeSystem,
} from "./SystemRegistry";

// Agent Registry
export { AgentRegistry } from "./AgentRegistry";
export type { MovementState } from "./AgentRegistry";

// Systems
export { RoleSystem } from "./RoleSystem";
export { EquipmentSystem, equipmentSystem } from "./EquipmentSystem";
export { AmbientAwarenessSystem } from "./AmbientAwarenessSystem";

// AI
export { AISystem } from "./ai/AISystem";
export { TaskQueue } from "./ai/TaskQueue";
export { SharedKnowledgeSystem } from "./ai/SharedKnowledgeSystem";

// Movement
export { MovementSystem } from "./movement/MovementSystem";

// Needs
export { NeedsSystem } from "./needs/NeedsSystem";
