/**
 * @fileoverview ECS Module Exports
 *
 * Exporta todos los componentes del sistema ECS para uso en la aplicación.
 *
 * @module domain/simulation/ecs
 */

// ============================================================================
// COMPONENTS
// ============================================================================

export type {
  // Core
  AgentComponents,
  ComponentType,
  // Individual Components
  ProfileComponent,
  HealthComponent,
  NeedsComponent,
  TransformComponent,
  MovementComponent,
  InventoryComponent,
  InventoryItem,
  CombatComponent,
  RoleComponent,
  SocialComponent,
  RelationshipData,
  AIComponent,
} from "./AgentComponents";

export { createDefaultComponents, cloneComponent } from "./AgentComponents";

// ============================================================================
// STORE
// ============================================================================

export { AgentStore } from "./AgentStore";
export type { AgentStoreConfig } from "./AgentStore";

// ============================================================================
// EVENT BUS
// ============================================================================

export { EventBus } from "./EventBus";
export type {
  SystemEvents,
  EventName,
  EventData,
  EventHandler,
  EventBusConfig,
} from "./EventBus";

// ============================================================================
// SYSTEM REGISTRY
// ============================================================================

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

// ============================================================================
// TASK QUEUE
// ============================================================================

export { TaskQueue } from "./TaskQueue";
export type { TaskQueueConfig, QueuedTask } from "./TaskQueue";
