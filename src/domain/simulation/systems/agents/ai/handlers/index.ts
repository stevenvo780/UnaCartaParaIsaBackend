/**
 * @fileoverview Índice de Handlers - ECS Compatible
 *
 * Exporta todos los handlers de acciones.
 * Los handlers delegan a sistemas via SystemRegistry.
 *
 * @module domain/simulation/systems/agents/ai/handlers
 */

export {
  handleMove,
  isAtTarget,
  moveToPosition,
  moveToZone,
  moveToEntity,
  stopMovement,
  isMoving,
  distance,
  createMoveAction,
} from "./MoveHandler";
export { handleGather, type GatherHandlerDeps } from "./GatherHandler";
export { handleAttack, type AttackHandlerDeps } from "./AttackHandler";
export { handleFlee, type FleeHandlerDeps } from "./FleeHandler";
export {
  handleCraft,
  type CraftHandlerDeps,
  type Recipe,
} from "./CraftHandler";
export { handleBuild, type BuildHandlerDeps } from "./BuildHandler";
export { handleDeposit, type DepositHandlerDeps } from "./DepositHandler";
export { handleSocialize, type SocialHandlerDeps } from "./SocialHandler";
export { handleRest, type RestHandlerDeps } from "./RestHandler";
export { handleExplore, type ExploreHandlerDeps } from "./ExploreHandler";
export {
  handleTrade,
  type TradeHandlerDeps,
  type TradeOffer,
} from "./TradeHandler";
export { handleConsume, type ConsumeHandlerDeps } from "./ConsumeHandler";
