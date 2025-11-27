import type { GameState } from "../../types/game-types";
import type { ResourceCost } from "../../types/simulation/economy";
import { InventorySystem } from "./InventorySystem";
import { GameEventNames, simulationEvents } from "../core/events";
import { logger } from "../../../infrastructure/utils/logger";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

interface Reservation {
  taskId: string;
  cost: ResourceCost;
  timestamp: number;
}

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class ResourceReservationSystem {
  private reservations = new Map<string, Reservation>();
  private readonly now: () => number;
  private lastCleanup = 0;
  private readonly cleanupIntervalMs = 60_000;

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
  ) {
    this.now = (): number => Date.now();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventNames.NEED_SATISFIED,
      (data: { agentId: string; need: string; value: number }) => {
        if (data.need === "hunger" || data.need === "thirst") {
          this.cleanupStaleReservations(2 * 60 * 1000);
        }
      },
    );
  }

  /**
   * Reserves resources for a task.
   *
   * @param taskId - Task identifier
   * @param cost - Resource cost to reserve
   * @returns True if reservation was successful, false if task already reserved or insufficient resources
   */
  public reserve(taskId: string, cost: ResourceCost): boolean {
    if (this.reservations.has(taskId)) return false;
    if (!this.hasSufficientResources(cost)) return false;

    this.reservations.set(taskId, { taskId, cost, timestamp: this.now() });
    this.broadcastUpdate();
    return true;
  }

  /**
   * Consumes reserved resources for a completed task.
   *
   * @param taskId - Task identifier
   * @returns True if resources were consumed successfully, false if reservation not found or payment failed
   */
  public consume(taskId: string): boolean {
    const reservation = this.reservations.get(taskId);
    if (!reservation) return false;

    try {
      this.pay(reservation.cost);
      this.reservations.delete(taskId);
      this.broadcastUpdate();
      return true;
    } catch (error) {
      logger.warn("ResourceReservationSystem.consume failed", {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Releases a reservation without consuming resources.
   * Used when a task is cancelled or fails before completion.
   *
   * @param taskId - Task identifier
   * @returns True if reservation was released, false if not found
   */
  public release(taskId: string): boolean {
    const removed = this.reservations.delete(taskId);
    if (removed) {
      this.broadcastUpdate();
    }
    return removed;
  }

  /**
   * Gets available resources, optionally including or excluding reserved resources.
   * Combines global resources with stockpiled resources from InventorySystem.
   *
   * @param includeReserved - If true, includes reserved resources in the count
   * @returns Available resource amounts (wood, stone), floored to integers
   */
  /**
   * Gets available resources, optionally including or excluding reserved resources.
   * Combines global resources with stockpiled resources from InventorySystem.
   *
   * @param includeReserved - If true, includes reserved resources in the count
   * @returns Available resource amounts (wood, stone), floored to integers
   */
  public getAvailableResources(includeReserved = false): ResourceCost {
    const res = this.state.resources;
    const stats = this.inventorySystem.getSystemStats();

    let wood = (res?.materials.wood ?? 0) + stats.stockpiled.wood;
    let stone = (res?.materials.stone ?? 0) + stats.stockpiled.stone;

    if (!includeReserved) {
      for (const reservation of this.reservations.values()) {
        wood -= reservation.cost.wood;
        stone -= reservation.cost.stone;
      }
    }

    return {
      wood: Math.max(0, Math.floor(wood)),
      stone: Math.max(0, Math.floor(stone)),
    };
  }

  /**
   * Gets the total amount of currently reserved resources.
   *
   * @returns Total reserved resources (wood, stone)
   */
  public getTotalReserved(): ResourceCost {
    let wood = 0;
    let stone = 0;
    for (const reservation of this.reservations.values()) {
      wood += reservation.cost.wood;
      stone += reservation.cost.stone;
    }
    return { wood, stone };
  }

  /**
   * Removes reservations older than the specified age.
   * Used to clean up abandoned or failed tasks.
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
   * @returns Number of reservations cleaned up
   */
  public cleanupStaleReservations(maxAgeMs = 5 * 60 * 1000): number {
    const now = this.now();
    let cleaned = 0;
    const toDelete: string[] = [];

    for (const [taskId, reservation] of this.reservations) {
      if (now - reservation.timestamp > maxAgeMs) {
        toDelete.push(taskId);
      }
    }

    for (const taskId of toDelete) {
      this.reservations.delete(taskId);
      cleaned++;
    }

    if (cleaned > 0) {
      this.broadcastUpdate();
    }

    return cleaned;
  }

  /**
   * Periodic update to clean up stale reservations.
   * Called by the simulation scheduler.
   */
  public update(): void {
    const now = this.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;
    this.cleanupStaleReservations();
  }

  private hasSufficientResources(cost: ResourceCost): boolean {
    const available = this.getAvailableResources(false);
    return available.wood >= cost.wood && available.stone >= cost.stone;
  }

  private pay(cost: ResourceCost): void {
    const resources = this.state.resources;
    if (!resources) {
      throw new Error("Game resources not initialized");
    }

    let needWood = cost.wood;
    let needStone = cost.stone;

    const consumedStockpiles: Array<{
      stockpileId: string;
      wood: number;
      stone: number;
    }> = [];

    for (const stockpile of this.inventorySystem.getAllStockpiles()) {
      if (needWood <= 0 && needStone <= 0) break;

      const woodToTake = Math.min(needWood, stockpile.inventory.wood);
      const stoneToTake = Math.min(needStone, stockpile.inventory.stone);

      if (woodToTake <= 0 && stoneToTake <= 0) continue;

      const success = this.inventorySystem.consumeFromStockpile(stockpile.id, {
        wood: woodToTake || undefined,
        stone: stoneToTake || undefined,
      });

      if (!success) continue;

      consumedStockpiles.push({
        stockpileId: stockpile.id,
        wood: woodToTake,
        stone: stoneToTake,
      });
      needWood -= woodToTake;
      needStone -= stoneToTake;
    }

    if (needWood > 0) {
      const availableWood = resources.materials.wood ?? 0;
      if (availableWood < needWood) {
        this.refundStockpiles(consumedStockpiles);
        throw new Error("Insufficient global wood for reservation");
      }
      resources.materials.wood = availableWood - needWood;
    }

    if (needStone > 0) {
      const availableStone = resources.materials.stone ?? 0;
      if (availableStone < needStone) {
        this.refundStockpiles(consumedStockpiles);
        throw new Error("Insufficient global stone for reservation");
      }
      resources.materials.stone = availableStone - needStone;
    }
  }

  private refundStockpiles(
    consumed: Array<{ stockpileId: string; wood: number; stone: number }>,
  ): void {
    for (const entry of consumed) {
      if (entry.wood > 0) {
        this.inventorySystem.addToStockpile(
          entry.stockpileId,
          ResourceType.WOOD,
          entry.wood,
        );
      }
      if (entry.stone > 0) {
        this.inventorySystem.addToStockpile(
          entry.stockpileId,
          ResourceType.STONE,
          entry.stone,
        );
      }
    }
  }

  private broadcastUpdate(): void {
    simulationEvents.emit(GameEventNames.ECONOMY_RESERVATIONS_UPDATE, {
      reservations: Array.from(this.reservations.values()),
      totalReserved: this.getTotalReserved(),
      available: this.getAvailableResources(false),
    });
  }
}
