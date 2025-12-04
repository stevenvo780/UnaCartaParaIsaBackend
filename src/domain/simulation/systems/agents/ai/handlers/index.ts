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
export { handleGather } from "./GatherHandler";
export { handleAttack } from "./AttackHandler";
export { handleFlee } from "./FleeHandler";
export { handleCraft, type Recipe } from "./CraftHandler";
export { handleBuild } from "./BuildHandler";
export { handleDeposit } from "./DepositHandler";
export { handleSocialize } from "./SocialHandler";
export { handleRest } from "./RestHandler";
export { handleExplore } from "./ExploreHandler";
export { handleTrade, type TradeOffer } from "./TradeHandler";
export { handleConsume } from "./ConsumeHandler";
