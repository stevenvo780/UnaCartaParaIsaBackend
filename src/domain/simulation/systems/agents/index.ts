/**
 * @fileoverview Agent Systems - Barrel exports
 *
 * Exporta todos los sistemas relacionados con agentes.
 *
 * @module domain/simulation/systems/agents
 */

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

export { AgentRegistry } from "./AgentRegistry";
export type { MovementState } from "./AgentRegistry";

export { RoleSystem } from "./RoleSystem";
export { EquipmentSystem, equipmentSystem } from "./EquipmentSystem";
export { AmbientAwarenessSystem } from "./AmbientAwarenessSystem";

export { AISystem } from "./ai/AISystem";
export { TaskQueue } from "./ai/TaskQueue";
export { SharedKnowledgeSystem } from "./ai/SharedKnowledgeSystem";

export { MovementSystem } from "./movement/MovementSystem";

export { NeedsSystem } from "./needs/NeedsSystem";
