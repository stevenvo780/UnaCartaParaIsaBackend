import type { GameState } from "../../types/game-types";
import type { ResourceCost } from "../../types/simulation/economy";
import { InventorySystem } from "./InventorySystem";
import { GameEventNames, simulationEvents } from "../core/events";

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
    // Cuando una necesidad se satisface, liberar reservas relacionadas si el agente ya no necesita esos recursos
    simulationEvents.on(
      GameEventNames.NEED_SATISFIED,
      (data: { agentId: string; need: string; value: number }) => {
        if (data.need === "hunger" || data.need === "thirst") {
          this.cleanupStaleReservations(2 * 60 * 1000);
        }
      },
    );
  }

  public reserve(taskId: string, cost: ResourceCost): boolean {
    if (this.reservations.has(taskId)) return false;
    if (!this.hasSufficientResources(cost)) return false;

    this.reservations.set(taskId, { taskId, cost, timestamp: this.now() });
    this.broadcastUpdate();
    return true;
  }

  public consume(taskId: string): boolean {
    const reservation = this.reservations.get(taskId);
    if (!reservation) return false;

    try {
      this.pay(reservation.cost);
      this.reservations.delete(taskId);
      this.broadcastUpdate();
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("ResourceReservationSystem.consume failed", {
        taskId,
        error,
      });
      return false;
    }
  }

  public release(taskId: string): boolean {
    const removed = this.reservations.delete(taskId);
    if (removed) {
      this.broadcastUpdate();
    }
    return removed;
  }

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

  public getTotalReserved(): ResourceCost {
    let wood = 0;
    let stone = 0;
    for (const reservation of this.reservations.values()) {
      wood += reservation.cost.wood;
      stone += reservation.cost.stone;
    }
    return { wood, stone };
  }

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
          "wood",
          entry.wood,
        );
      }
      if (entry.stone > 0) {
        this.inventorySystem.addToStockpile(
          entry.stockpileId,
          "stone",
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
