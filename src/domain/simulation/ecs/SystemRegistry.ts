/**
 * @fileoverview System Registry - Central System Access
 *
 * Registro central de todos los sistemas del juego.
 * Permite a los handlers acceder a sistemas de forma desacoplada.
 *
 * @module domain/simulation/ecs
 */

import { injectable } from "inversify";
import { logger } from "@/infrastructure/utils/logger";

// ============================================================================
// SYSTEM INTERFACES
// ============================================================================

/**
 * Resultado de una operación de handler
 */
export interface HandlerResult {
  status: "delegated" | "completed" | "failed" | "in_progress";
  system: string;
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
  getNeeds(agentId: string): Record<string, number> | undefined;
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

// ============================================================================
// SYSTEM REGISTRY
// ============================================================================

@injectable()
export class SystemRegistry {
  private systems = new Map<string, ISystem>();

  // Sistemas tipados (se asignan al registrar)
  public movement?: IMovementSystem;
  public combat?: ICombatSystem;
  public needs?: INeedsSystem;
  public inventory?: IInventorySystem;
  public social?: ISocialSystem;
  public crafting?: ICraftingSystem;
  public building?: IBuildingSystem;
  public trade?: ITradeSystem;

  constructor() {
    logger.info("🔧 SystemRegistry: Initialized");
  }

  /**
   * Registra un sistema
   */
  public register<T extends ISystem>(name: string, system: T): void {
    this.systems.set(name, system);

    // Asignar a propiedad tipada si corresponde
    switch (name) {
      case "movement":
        this.movement = system as unknown as IMovementSystem;
        break;
      case "combat":
        this.combat = system as unknown as ICombatSystem;
        break;
      case "needs":
        this.needs = system as unknown as INeedsSystem;
        break;
      case "inventory":
        this.inventory = system as unknown as IInventorySystem;
        break;
      case "social":
        this.social = system as unknown as ISocialSystem;
        break;
      case "crafting":
        this.crafting = system as unknown as ICraftingSystem;
        break;
      case "building":
        this.building = system as unknown as IBuildingSystem;
        break;
      case "trade":
        this.trade = system as unknown as ITradeSystem;
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

    // Clear from typed properties
    switch (name) {
      case "movement":
        this.movement = undefined;
        break;
      case "combat":
        this.combat = undefined;
        break;
      case "needs":
        this.needs = undefined;
        break;
      case "inventory":
        this.inventory = undefined;
        break;
      case "social":
        this.social = undefined;
        break;
      case "crafting":
        this.crafting = undefined;
        break;
      case "building":
        this.building = undefined;
        break;
      case "trade":
        this.trade = undefined;
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
