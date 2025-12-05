/**
 * @fileoverview System Registry - Central System Access
 *
 * Registro central de todos los sistemas del juego.
 * Permite a los handlers acceder a sistemas de forma desacoplada.
 *
 * @module domain/simulation/systems/agents
 */

import { injectable } from "inversify";
import { logger } from "@/infrastructure/utils/logger";
import {
  SystemProperty,
  SystemName,
} from "../../../../shared/constants/SystemEnums";
import { ActivityType } from "../../../../shared/constants/MovementEnums";
import { HandlerResultStatus } from "../../../../shared/constants/StatusEnums";
import { GoalDomain } from "@/shared/constants/AIEnums";

/**
 * Resultado de una operación de handler
 */
export interface HandlerResult {
  status: HandlerResultStatus;
  system: SystemName;
  message?: string;
  data?: unknown;
}

/**
 * Interfaz base para todos los sistemas
 */
export interface ISystem {
  readonly name: string;
  update?(deltaTime: number): void;
  cleanup?(): void;
}

/**
 * Sistema de movimiento
 */
export interface IMovementSystem extends ISystem {
  requestMove(agentId: string, target: { x: number; y: number }): HandlerResult;
  requestMoveToZone(agentId: string, zoneId: string): HandlerResult;
  requestMoveToEntity(agentId: string, entityId: string): HandlerResult;
  stopMovement(agentId: string): void;
  isMoving(agentId: string): boolean;
  startActivity(
    entityId: string,
    activity: ActivityType,
    durationMs?: number,
  ): boolean;
  getActivity(entityId: string): ActivityType | undefined;
}

/**
 * Sistema de combate
 */
export interface ICombatSystem extends ISystem {
  requestAttack(agentId: string, targetId: string): HandlerResult;
  requestFlee(
    agentId: string,
    fromPosition: { x: number; y: number },
  ): HandlerResult;
  endCombat(agentId: string): void;
  isInCombat(agentId: string): boolean;
}

/**
 * Sistema de necesidades
 */
export interface INeedsSystem extends ISystem {
  requestConsume(agentId: string, itemId: string): HandlerResult;
  requestRest(agentId: string): HandlerResult;
  applyNeedChange(agentId: string, need: string, delta: number): HandlerResult;
  getNeeds(agentId: string): Record<string, number | undefined> | undefined;
  /**
   * Genera tareas pendientes basadas en el estado de necesidades del agente.
   * El sistema es la única fuente de verdad sobre umbrales y prioridades.
   */
  getPendingTasks(
    agentId: string,
    spatialContext?: {
      nearestFood?: { id: string; x: number; y: number };
      nearestWater?: { id: string; x: number; y: number };
      nearbyAgents?: readonly { id: string; x: number; y: number }[];
    },
  ): Array<{
    type: string;
    priority: number;
    target?: { entityId?: string; position?: { x: number; y: number } };
    params?: Record<string, unknown>;
    source: string;
  }>;
}

/**
 * Sistema de inventario
 */
export interface IInventorySystem extends ISystem {
  requestGather(
    agentId: string,
    resourceId: string,
    quantity: number,
  ): HandlerResult;
  requestDeposit(
    agentId: string,
    storageId: string,
    itemId: string,
  ): HandlerResult;
  requestTransfer(
    fromAgentId: string,
    toAgentId: string,
    itemId: string,
    quantity: number,
  ): HandlerResult;
  hasItem(agentId: string, itemId: string): boolean;
  getInventorySpace(agentId: string): number;
  /** Obtiene el inventario completo de un agente */
  getAgentInventory?(agentId: string): Record<string, number> | undefined;
}

/**
 * Sistema social
 */
export interface ISocialSystem extends ISystem {
  requestInteraction(
    agentId: string,
    targetId: string,
    type: string,
  ): HandlerResult;
  getRelationship(agentId: string, targetId: string): number;
}

/**
 * Sistema de crafteo
 */
export interface ICraftingSystem extends ISystem {
  requestCraft(agentId: string, recipeId: string): HandlerResult;
  canCraft(agentId: string, recipeId: string): boolean;
}

/**
 * Sistema de construcción
 */
export interface IBuildingSystem extends ISystem {
  requestBuild(
    agentId: string,
    buildingType: string,
    position: { x: number; y: number },
  ): HandlerResult;
  requestRepair(agentId: string, buildingId: string): HandlerResult;
  /** Retorna la demanda actual de recursos para construcción */
  getResourceDemand?(): { wood: number; stone: number } | null;
}

/**
 * Sistema de comercio
 */
export interface ITradeSystem extends ISystem {
  requestTrade(
    buyerId: string,
    sellerId: string,
    itemId: string,
    quantity: number,
    price: number,
  ): HandlerResult;
}

/**
 * Sistema de consultas del mundo (WorldQueryService)
 */
export interface IWorldQuerySystem extends ISystem {
  getDirectionToNearestEdge(
    x: number,
    y: number,
  ): { x: number; y: number; edgeName: string };
  findNearestWater(
    x: number,
    y: number,
  ): { worldX: number; worldY: number } | null;
  hasWaterAt(x: number, y: number): boolean;
}

@injectable()
export class SystemRegistry {
  private systems = new Map<string, ISystem>();

  public movement?: IMovementSystem;
  public combat?: ICombatSystem;
  public needs?: INeedsSystem;
  public inventory?: IInventorySystem;
  public social?: ISocialSystem;
  public crafting?: ICraftingSystem;
  public building?: IBuildingSystem;
  public trade?: ITradeSystem;
  public worldQuery?: IWorldQuerySystem;

  constructor() {
    logger.info("🔧 SystemRegistry: Initialized");
  }

  /**
   * Registra un sistema
   */
  public register<T extends ISystem>(name: string, system: T): void {
    this.systems.set(name, system);

    switch (name) {
      case SystemName.MOVEMENT:
        this.movement = system as unknown as IMovementSystem;
        break;
      case GoalDomain.COMBAT:
        this.combat = system as unknown as ICombatSystem;
        break;
      case SystemName.NEEDS:
        this.needs = system as unknown as INeedsSystem;
        break;
      case SystemProperty.INVENTORY:
        this.inventory = system as unknown as IInventorySystem;
        break;
      case GoalDomain.SOCIAL:
        this.social = system as unknown as ISocialSystem;
        break;
      case GoalDomain.CRAFTING:
        this.crafting = system as unknown as ICraftingSystem;
        break;
      case SystemName.BUILDING:
        this.building = system as unknown as IBuildingSystem;
        break;
      case GoalDomain.LOGISTICS:
        this.trade = system as unknown as ITradeSystem;
        break;
      case SystemName.WORLD_QUERY:
        this.worldQuery = system as unknown as IWorldQuerySystem;
        break;
    }

    logger.debug(`SystemRegistry: Registered system '${name}'`);
  }

  /**
   * Obtiene un sistema por nombre
   */
  public get<T extends ISystem>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  /**
   * Verifica si un sistema está registrado
   */
  public has(name: string): boolean {
    return this.systems.has(name);
  }

  /**
   * Obtiene todos los nombres de sistemas
   */
  public getSystemNames(): string[] {
    return Array.from(this.systems.keys());
  }

  /**
   * Alias for getSystemNames for compatibility
   */
  public getRegisteredSystems(): string[] {
    return this.getSystemNames();
  }

  /**
   * Elimina un sistema del registro
   */
  public unregister(name: string): void {
    if (!this.systems.has(name)) {
      logger.warn(`SystemRegistry: System '${name}' not registered`);
      return;
    }

    this.systems.delete(name);

    switch (name) {
      case SystemName.MOVEMENT:
        this.movement = undefined;
        break;
      case GoalDomain.COMBAT:
        this.combat = undefined;
        break;
      case SystemName.NEEDS:
        this.needs = undefined;
        break;
      case SystemProperty.INVENTORY:
        this.inventory = undefined;
        break;
      case GoalDomain.SOCIAL:
        this.social = undefined;
        break;
      case GoalDomain.CRAFTING:
        this.crafting = undefined;
        break;
      case SystemName.BUILDING:
        this.building = undefined;
        break;
      case GoalDomain.LOGISTICS:
        this.trade = undefined;
        break;
      case SystemName.WORLD_QUERY:
        this.worldQuery = undefined;
        break;
    }

    logger.debug(`SystemRegistry: Unregistered system '${name}'`);
  }

  /**
   * Ejecuta update en todos los sistemas que lo soporten
   */
  public updateAll(deltaTime: number): void {
    for (const system of this.systems.values()) {
      if (system.update) {
        try {
          system.update(deltaTime);
        } catch (error) {
          logger.error(
            `SystemRegistry: Error updating system '${system.name}'`,
            { error },
          );
        }
      }
    }
  }

  /**
   * Limpia todos los sistemas
   */
  public cleanupAll(): void {
    for (const system of this.systems.values()) {
      if (system.cleanup) {
        try {
          system.cleanup();
        } catch (error) {
          logger.error(
            `SystemRegistry: Error cleaning up system '${system.name}'`,
            { error },
          );
        }
      }
    }
    this.systems.clear();
  }
}
