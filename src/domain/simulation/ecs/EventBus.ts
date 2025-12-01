/**
 * @fileoverview Event Bus - Central Event System
 *
 * Sistema de eventos centralizado para comunicación entre sistemas.
 * Los sistemas emiten eventos, otros sistemas escuchan y reaccionan.
 *
 * Características:
 * - Tipado fuerte de eventos
 * - Unsubscribe automático
 * - Manejo de errores en handlers
 * - Debug logging opcional
 *
 * @module domain/simulation/ecs
 */

import { injectable } from "inversify";
import { logger } from "@/infrastructure/utils/logger";

/**
 * Definición de todos los eventos del sistema
 */
export interface SystemEvents {
  "combat:damage_dealt": {
    attackerId: string;
    targetId: string;
    damage: number;
    damageType: string;
    timestamp: number;
  };
  "combat:entity_died": {
    entityId: string;
    killerId?: string;
    cause: string;
    timestamp: number;
  };
  "combat:combat_started": {
    agentId: string;
    targetId: string;
    timestamp: number;
  };
  "combat:combat_ended": {
    agentId: string;
    reason: string;
    timestamp: number;
  };

  "needs:critical": {
    agentId: string;
    needType: string;
    value: number;
    threshold: number;
    timestamp: number;
  };
  "needs:satisfied": {
    agentId: string;
    needType: string;
    previousValue: number;
    newValue: number;
    timestamp: number;
  };
  "needs:item_consumed": {
    agentId: string;
    itemId: string;
    itemType: string;
    satisfaction: Record<string, number>;
    timestamp: number;
  };

  "movement:arrived": {
    agentId: string;
    position: { x: number; y: number };
    zoneId?: string;
    timestamp: number;
  };
  "movement:path_blocked": {
    agentId: string;
    position: { x: number; y: number };
    blockedBy?: string;
    timestamp: number;
  };
  "movement:started": {
    agentId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    timestamp: number;
  };

  "inventory:item_added": {
    agentId: string;
    itemId: string;
    itemType: string;
    quantity: number;
    timestamp: number;
  };
  "inventory:item_removed": {
    agentId: string;
    itemId: string;
    itemType: string;
    quantity: number;
    reason: string;
    timestamp: number;
  };
  "inventory:full": {
    agentId: string;
    capacity: number;
    currentLoad: number;
    timestamp: number;
  };

  "social:interaction": {
    agentId: string;
    targetId: string;
    interactionType: string;
    outcome: string;
    timestamp: number;
  };
  "social:relationship_changed": {
    agentId: string;
    targetId: string;
    previousAffinity: number;
    newAffinity: number;
    reason: string;
    timestamp: number;
  };

  "economy:transaction": {
    buyerId: string;
    sellerId: string;
    itemType: string;
    quantity: number;
    price: number;
    timestamp: number;
  };
  "economy:resource_gathered": {
    agentId: string;
    resourceType: string;
    quantity: number;
    position: { x: number; y: number };
    timestamp: number;
  };

  "ai:task_started": {
    agentId: string;
    taskType: string;
    taskId: string;
    priority: number;
    timestamp: number;
  };
  "ai:task_completed": {
    agentId: string;
    taskType: string;
    taskId: string;
    duration: number;
    timestamp: number;
  };
  "ai:task_failed": {
    agentId: string;
    taskType: string;
    taskId: string;
    reason: string;
    timestamp: number;
  };
  "ai:task_emit": {
    agentId: string;
    type: string;
    priority: number;
    target?: {
      entityId?: string;
      position?: { x: number; y: number };
      zoneId?: string;
    };
    params?: Record<string, unknown>;
    source: string;
    timestamp: number;
  };

  "lifecycle:agent_spawned": {
    agentId: string;
    position: { x: number; y: number };
    timestamp: number;
  };
  "lifecycle:agent_removed": {
    agentId: string;
    reason: string;
    timestamp: number;
  };
}

export type EventName = keyof SystemEvents;
export type EventData<E extends EventName> = SystemEvents[E];
export type EventHandler<E extends EventName> = (data: EventData<E>) => void;

export interface EventBusConfig {
  /** Enable debug logging */
  debug: boolean;
  /** Max listeners per event (0 = unlimited) */
  maxListeners: number;
  /** Catch and log handler errors instead of throwing */
  catchErrors: boolean;
}

const DEFAULT_CONFIG: EventBusConfig = {
  debug: false,
  maxListeners: 100,
  catchErrors: true,
};

@injectable()
export class EventBus {
  private config: EventBusConfig;
  private handlers = new Map<EventName, Set<EventHandler<EventName>>>();
  private eventCounts = new Map<EventName, number>();

  constructor(config?: Partial<EventBusConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info("📡 EventBus: Initialized");
  }

  /**
   * Registra un handler para un evento
   * @returns Función para unsubscribe
   */
  public on<E extends EventName>(
    event: E,
    handler: EventHandler<E>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const handlers = this.handlers.get(event)!;

    if (
      this.config.maxListeners > 0 &&
      handlers.size >= this.config.maxListeners
    ) {
      logger.warn(
        `EventBus: Max listeners (${this.config.maxListeners}) reached for ${event}`,
      );
    }

    handlers.add(handler as EventHandler<EventName>);

    if (this.config.debug) {
      logger.debug(`EventBus: Handler registered for ${event}`);
    }

    return () => {
      handlers.delete(handler as EventHandler<EventName>);
      if (this.config.debug) {
        logger.debug(`EventBus: Handler unregistered from ${event}`);
      }
    };
  }

  /**
   * Registra un handler que se ejecuta una sola vez
   */
  public once<E extends EventName>(
    event: E,
    handler: EventHandler<E>,
  ): () => void {
    const wrapper = ((data: EventData<E>) => {
      this.handlers.get(event)?.delete(wrapper as EventHandler<EventName>);
      handler(data);
    }) as EventHandler<E>;

    return this.on(event, wrapper);
  }

  /**
   * Emite un evento a todos los handlers registrados
   */
  public emit<E extends EventName>(event: E, data: EventData<E>): void {
    const handlers = this.handlers.get(event);

    this.eventCounts.set(event, (this.eventCounts.get(event) ?? 0) + 1);

    if (!handlers || handlers.size === 0) {
      if (this.config.debug) {
        logger.debug(`EventBus: No handlers for ${event}`);
      }
      return;
    }

    if (this.config.debug) {
      logger.debug(`EventBus: Emitting ${event} to ${handlers.size} handlers`);
    }

    for (const handler of handlers) {
      try {
        (handler as EventHandler<E>)(data);
      } catch (error) {
        if (this.config.catchErrors) {
          logger.error(`EventBus: Error in handler for ${event}`, { error });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Elimina todos los handlers de un evento
   */
  public off(event: EventName): void {
    this.handlers.delete(event);
    if (this.config.debug) {
      logger.debug(`EventBus: All handlers removed for ${event}`);
    }
  }

  /**
   * Elimina todos los handlers
   */
  public clear(): void {
    this.handlers.clear();
    this.eventCounts.clear();
    logger.info("EventBus: All handlers cleared");
  }

  /**
   * Obtiene el número de handlers para un evento
   */
  public getHandlerCount(event: EventName): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Obtiene estadísticas de eventos
   */
  public getStats(): {
    totalEvents: number;
    eventCounts: Record<string, number>;
    handlerCounts: Record<string, number>;
  } {
    const eventCounts: Record<string, number> = {};
    const handlerCounts: Record<string, number> = {};

    for (const [event, count] of this.eventCounts) {
      eventCounts[event] = count;
    }

    for (const [event, handlers] of this.handlers) {
      handlerCounts[event] = handlers.size;
    }

    return {
      totalEvents: Array.from(this.eventCounts.values()).reduce(
        (a, b) => a + b,
        0,
      ),
      eventCounts,
      handlerCounts,
    };
  }

  /**
   * Obtiene todos los eventos registrados
   */
  public getRegisteredEvents(): EventName[] {
    return Array.from(this.handlers.keys());
  }
}
