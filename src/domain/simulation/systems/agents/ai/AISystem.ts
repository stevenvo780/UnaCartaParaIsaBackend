/**
 * @fileoverview AISystem - Sistema de IA ECS
 *
 * Sistema de IA que opera con la arquitectura ECS:
 * 1. Recibe tareas de otros sistemas via EventBus
 * 2. Las encola en TaskQueue
 * 3. Ejecuta handlers que delegan a sistemas via SystemRegistry
 *
 * Flujo:
 * ```
 * Sistema → EventBus(ai:task) → AISystem.emitTask() → TaskQueue
 * AISystem.update() → handler() → SystemRegistry.system.method()
 * ```
 *
 * Arquitectura ECS:
 * - AgentStore: Estado centralizado de componentes
 * - SystemRegistry: Acceso tipado a sistemas de dominio
 * - EventBus: Comunicación cross-system
 * - Handlers: Delegación pura, sin lógica de negocio
 *
 * @module domain/simulation/systems/agents/ai
 */

import { EventEmitter } from "events";
import { injectable, inject, optional } from "inversify";
import { logger } from "@/infrastructure/utils/logger";
import { TaskQueue } from "./TaskQueue";
import { runAllDetectors } from "./detectors";
import { LifeStage } from "@/shared/constants/AgentEnums";
import { NeedType } from "@/shared/constants/AIEnums";
import { ZoneType } from "@/shared/constants/ZoneEnums";
import { EquipmentSlot } from "@/shared/constants/EquipmentEnums";
import { WeaponId } from "@/shared/constants/CraftingEnums";
import { WorldResourceType } from "@/shared/constants/ResourceEnums";
import { ItemId } from "@/shared/constants/ItemEnums";
import {
  handleGather,
  handleAttack,
  handleFlee,
  handleRest,
  handleConsume,
  handleSocialize,
  handleExplore,
  handleCraft,
  handleBuild,
  handleDeposit,
  handleTrade,
} from "./handlers";
import type { DetectorContext, HandlerContext } from "./types";
import {
  type AgentTask,
  TaskType,
  TaskStatus,
  TASK_PRIORITIES,
  createTask,
} from "@/shared/types/simulation/unifiedTasks";
import type { GameState } from "@/shared/types/game-types";
import { TYPES } from "@/config/Types";
import type { AgentRegistry } from "../AgentRegistry";
import type { NeedsSystem } from "../needs/NeedsSystem";
import type { MovementSystem } from "../movement/MovementSystem";
import type { WorldQueryService } from "../../world/WorldQueryService";
import { SystemRegistry } from "../SystemRegistry";
import type { TimeSystem } from "../../core/TimeSystem";
import { equipmentSystem } from "../EquipmentSystem";
import { RoleSystem } from "../RoleSystem";
import type { Container } from "inversify";
import { RandomUtils } from "@/shared/utils/RandomUtils";
import {
  WorldContextCache,
  type CachedZoneInfo,
  type ZonesMetadata,
} from "@/domain/simulation/core/WorldContextCache";

// Lazy import to avoid circular dependency
let _container: Container | null = null;
function getContainer(): Container {
  if (!_container) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _container = (require("@/config/container") as { container: Container })
      .container;
  }
  return _container!;
}

export interface AISystemDeps {
  gameState: GameState;
  agentRegistry: AgentRegistry;
  needsSystem?: NeedsSystem;
  movementSystem?: MovementSystem;
  worldQueryService?: WorldQueryService;
  timeSystem?: TimeSystem;

  systemRegistry?: SystemRegistry;
}

export interface AISystemConfig {
  /** Intervalo entre updates (ms) */
  updateInterval: number;
  /** Boost de prioridad por tarea duplicada */
  priorityBoost: number;
  /** Máximo de tareas por agente */
  maxTasksPerAgent: number;
  /** Debug logging */
  debug: boolean;
}

/**
 * Memoria del agente para tracking de zonas, recursos y actividades.
 */
export interface AIAgentMemory {
  visitedZones: Set<string>;
  knownResources: Map<string, unknown>;
  knownAgents: Map<string, unknown>;
  recentEvents: unknown[];
  knowledge: Record<string, unknown>;
  importantLocations: Map<string, unknown>;
  socialMemory: Map<string, unknown>;
  shortTerm: unknown[];
  longTerm: unknown[];
  knownResourceLocations: Map<string, unknown>;
  successfulActivities: Map<string, unknown>;
  failedAttempts: Map<string, unknown>;
  failedTargets: Map<string, unknown>;
  lastMemoryCleanup: number;
  lastExploreTime: number;
}

const DEFAULT_CONFIG: AISystemConfig = {
  updateInterval: 100,
  priorityBoost: 0.1,
  maxTasksPerAgent: 10,
  debug: false,
};

/**
 * Sistema de IA unificado.
 *
 * Flujo:
 * ```
 * Sistemas externos → emitTask() → TaskQueue → update() → Handler → Acción
 * ```
 *
 * Ejemplo de uso:
 * ```typescript
 *
 * aiSystem.emitTask(agentId, {
 *   type: TaskType.SATISFY_NEED,
 *   priority: 0.8,
 *   params: { needType: NeedType.HUNGER }
 * });
 *
 *
 *
 * ```
 */
@injectable()
export class AISystem extends EventEmitter {
  private gameState: GameState;
  private agentRegistry?: AgentRegistry;
  private needsSystem?: NeedsSystem;
  private worldQueryService?: WorldQueryService;
  private timeSystem?: TimeSystem;
  private worldContextCache?: WorldContextCache;

  private systemRegistry: SystemRegistry;

  private taskQueue: TaskQueue;
  private config: AISystemConfig;

  private activeTask = new Map<string, AgentTask>();
  private lastUpdate = new Map<string, number>();

  /** Memoria persistente por agente */
  private agentMemories = new Map<string, AIAgentMemory>();

  /** Caché de contextos de detección con TTL de 500ms */
  private contextCache = new Map<
    string,
    { context: DetectorContext; timestamp: number }
  >();
  private readonly CONTEXT_CACHE_TTL = 500; // ms

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.AgentRegistry) @optional() agentRegistry?: AgentRegistry,
    @inject(TYPES.NeedsSystem) @optional() needsSystem?: NeedsSystem,
    @inject(TYPES.MovementSystem) @optional() _movementSystem?: MovementSystem,
    @inject(TYPES.WorldQueryService)
    @optional()
    worldQueryService?: WorldQueryService,
    @inject(TYPES.TimeSystem) @optional() timeSystem?: TimeSystem,
    @inject(TYPES.WorldContextCache)
    @optional()
    worldContextCache?: WorldContextCache,
  ) {
    super();
    this.gameState = gameState;
    this.agentRegistry = agentRegistry;
    this.needsSystem = needsSystem;

    this.worldQueryService = worldQueryService;
    this.timeSystem = timeSystem;
    this.worldContextCache = worldContextCache;
    this.config = { ...DEFAULT_CONFIG };

    this.systemRegistry = new SystemRegistry();

    this.taskQueue = new TaskQueue({
      maxTasksPerAgent: this.config.maxTasksPerAgent,
      debug: this.config.debug,
    });

    logger.info("✅ [AISystem] Initialized (v4 - ECS architecture)");
  }

  /**
   * Configura dependencias después de la construcción.
   */
  public setDependencies(deps: Partial<AISystemDeps>): void {
    if (deps.agentRegistry) this.agentRegistry = deps.agentRegistry;
    if (deps.needsSystem) this.needsSystem = deps.needsSystem;

    if (deps.worldQueryService) this.worldQueryService = deps.worldQueryService;
    if (deps.timeSystem) this.timeSystem = deps.timeSystem;
    if (deps.systemRegistry) this.systemRegistry = deps.systemRegistry;
  }

  /**
   * Obtiene el SystemRegistry para acceso externo.
   */
  public getSystemRegistry(): SystemRegistry {
    return this.systemRegistry;
  }

  /**
   * Obtiene la memoria persistente de un agente.
   * Crea una nueva si no existe.
   */
  public getAgentMemory(agentId: string): AIAgentMemory {
    let memory = this.agentMemories.get(agentId);
    if (!memory) {
      memory = this.createEmptyMemory();
      this.agentMemories.set(agentId, memory);
    }
    return memory;
  }

  /**
   * Registra que un agente visitó una zona.
   */
  public recordVisitedZone(agentId: string, zoneId: string): void {
    const memory = this.getAgentMemory(agentId);
    memory.visitedZones.add(zoneId);
    logger.debug(`[AISystem] ${agentId} recorded visited zone: ${zoneId}`);
  }

  /**
   * Registra una ubicación de recurso conocida.
   */
  public recordKnownResource(
    agentId: string,
    resourceType: string,
    position: { x: number; y: number },
  ): void {
    const memory = this.getAgentMemory(agentId);
    memory.knownResourceLocations.set(resourceType, position);
    logger.debug(
      `[AISystem] ${agentId} recorded resource: ${resourceType} at (${position.x}, ${position.y})`,
    );
  }

  /**
   * Registra que el agente completó una exploración.
   */
  public recordExploration(agentId: string): void {
    const memory = this.getAgentMemory(agentId);
    memory.lastExploreTime = Date.now();
  }

  /**
   * Crea una memoria vacía para un agente.
   */
  private createEmptyMemory(): AIAgentMemory {
    return {
      visitedZones: new Set<string>(),
      knownResources: new Map<string, unknown>(),
      knownAgents: new Map<string, unknown>(),
      recentEvents: [],
      knowledge: {},
      importantLocations: new Map<string, unknown>(),
      socialMemory: new Map<string, unknown>(),
      shortTerm: [],
      longTerm: [],
      knownResourceLocations: new Map<string, unknown>(),
      successfulActivities: new Map<string, unknown>(),
      failedAttempts: new Map<string, unknown>(),
      failedTargets: new Map<string, unknown>(),
      lastMemoryCleanup: Date.now(),
      lastExploreTime: 0,
    };
  }

  /**
   * Emite una tarea para un agente.
   *
   * Los sistemas externos usan esto para reportar condiciones:
   * - NeedsSystem: emite SATISFY_NEED cuando hay hambre/sed
   * - CombatSystem: emite ATTACK cuando el agente es atacado
   * - RoleSystem: emite GATHER/CRAFT durante horas de trabajo
   *
   * Si la tarea ya existe, su prioridad AUMENTA (acumulación).
   *
   * @param agentId - ID del agente
   * @param task - Tarea parcial (type, priority, params opcionales)
   */
  public emitTask(
    agentId: string,
    task: {
      type: TaskType;
      priority: number;
      target?: {
        entityId?: string;
        position?: { x: number; y: number };
        zoneId?: string;
      };
      params?: Record<string, unknown>;
      source?: string;
    },
  ): void {
    const fullTask = createTask({
      agentId,
      type: task.type,
      priority: task.priority,
      target: task.target,
      params: task.params,
      source: task.source ?? "external",
    });

    this.taskQueue.enqueue(agentId, fullTask, this.config.priorityBoost);

    if (this.config.debug) {
      logger.debug(
        `[AISystem] Task emitted for ${agentId}: ${task.type} (priority: ${task.priority})`,
      );
    }
  }

  /**
   * Reporte de evento rápido (atajo para eventos comunes).
   */
  public reportEvent(
    agentId: string,
    event: "attacked" | "damaged" | "hungry" | "thirsty" | "tired",
    data?: { attackerId?: string; severity?: number },
  ): void {
    switch (event) {
      case "attacked":
      case "damaged":
        if (data?.attackerId) {
          this.emitTask(agentId, {
            type: TaskType.ATTACK,
            priority: TASK_PRIORITIES.URGENT,
            target: { entityId: data.attackerId },
            params: { reason: "retaliation" },
            source: `event:${event}`,
          });
        }
        break;

      case "hungry":
        this.emitTask(agentId, {
          type: TaskType.SATISFY_NEED,
          priority: TASK_PRIORITIES.HIGH,
          params: { needType: NeedType.HUNGER },
          source: "event:hungry",
        });
        break;

      case "thirsty":
        this.emitTask(agentId, {
          type: TaskType.SATISFY_NEED,
          priority: TASK_PRIORITIES.HIGH,
          params: { needType: NeedType.THIRST },
          source: "event:thirsty",
        });
        break;

      case "tired":
        this.emitTask(agentId, {
          type: TaskType.REST,
          priority: TASK_PRIORITIES.NORMAL,
          params: { reason: "tired" },
          source: "event:tired",
        });
        break;
    }
  }

  /**
   * Actualiza la IA de todos los agentes con batch processing.
   * Procesa agentes en batches pequeños para reducir latencia y evitar bloqueo.
   */
  public async update(deltaTimeMs: number): Promise<void> {
    const agents = this.gameState.agents ?? [];
    const aliveAgents = agents.filter((a) => !a.isDead);

    if (RandomUtils.chance(0.04)) {
      logger.debug(
        `[AISystem] update(): ${aliveAgents.length} alive agents (${agents.length} total)`,
      );
    }

    // Process in batches to avoid long blocking
    const BATCH_SIZE = 50;
    for (let i = 0; i < aliveAgents.length; i += BATCH_SIZE) {
      const batch = aliveAgents.slice(i, i + BATCH_SIZE);

      // Process batch sequentially (async handlers need sequential execution)
      for (const agent of batch) {
        this.updateAgent(agent.id, deltaTimeMs);
      }

      // Yield to event loop after each batch to prevent blocking
      if (i + BATCH_SIZE < aliveAgents.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  /**
   * Actualiza la IA de un agente específico.
   */
  public updateAgent(agentId: string, _deltaTimeMs: number): void {
    const now = Date.now();
    const last = this.lastUpdate.get(agentId) ?? 0;

    if (now - last < this.config.updateInterval) return;
    this.lastUpdate.set(agentId, now);

    this.runDetectors(agentId);

    this.taskQueue.cleanExpired(agentId);

    if (!this.activeTask.has(agentId)) {
      const nextTask = this.taskQueue.dequeue(agentId);
      if (nextTask) {
        this.activeTask.set(agentId, nextTask);
        nextTask.status = TaskStatus.ACTIVE;
        logger.debug(`[AISystem] ${agentId} ACTIVATED task: ${nextTask.type}`);
      }
    }

    const task = this.activeTask.get(agentId);
    if (task) {
      this.executeTask(agentId, task);
    }
  }

  /**
   * Ejecuta una tarea usando el handler apropiado.
   */
  private executeTask(agentId: string, task: AgentTask): void {
    const ctx = this.buildHandlerContext(agentId, task);
    if (!ctx) {
      this.failTask(agentId, task, "no context");
      return;
    }

    let result: { success: boolean; completed: boolean } | undefined;

    switch (task.type) {
      case TaskType.SATISFY_NEED:
        result = handleConsume(ctx);
        break;

      case TaskType.REST:
        result = handleRest(ctx);
        break;

      case TaskType.GATHER:
        result = handleGather(ctx);
        break;

      case TaskType.ATTACK:
        result = handleAttack(ctx);
        break;

      case TaskType.FLEE:
        result = handleFlee(ctx);
        break;

      case TaskType.SOCIALIZE:
        result = handleSocialize(ctx);
        break;

      case TaskType.EXPLORE:
        result = handleExplore(ctx);
        break;

      case TaskType.CRAFT:
        result = handleCraft(ctx);
        break;

      case TaskType.BUILD:
        result = handleBuild(ctx);
        break;

      case TaskType.DEPOSIT:
        result = handleDeposit(ctx);
        break;

      case TaskType.TRADE:
        result = handleTrade(ctx);
        break;

      case TaskType.HUNT:
        result = handleAttack(ctx);
        break;

      case TaskType.IDLE:
      default:
        result = { success: true, completed: true };
        break;
    }

    if (result?.completed) {
      if (result.success) {
        this.completeTask(agentId, task);
      } else {
        this.failTask(agentId, task, "handler failed");
      }
    }
  }

  /**
   * Construye el contexto para los handlers.
   * Los handlers reciben acceso a ECS via SystemRegistry.
   */
  private buildHandlerContext(
    agentId: string,
    task: AgentTask,
  ): HandlerContext | null {
    const position = this.agentRegistry?.getPosition(agentId);
    if (!position) return null;

    const memory = this.getAgentMemory(agentId);
    const memoryCallbacks: import("./types").MemoryCallbacks = {
      recordVisitedZone: (zoneId: string) =>
        this.recordVisitedZone(agentId, zoneId),
      recordKnownResource: (
        resourceType: string,
        pos: { x: number; y: number },
      ) => this.recordKnownResource(agentId, resourceType, pos),
      recordExploration: () => this.recordExploration(agentId),
      getVisitedZones: () => memory.visitedZones,
      getKnownResourceLocations: () =>
        memory.knownResourceLocations as Map<string, { x: number; y: number }>,
    };

    return {
      agentId,
      task: {
        id: task.id,
        agentId: task.agentId ?? agentId,
        type: task.type as unknown as import("./types").TaskType,
        priority: task.priority,
        status: task.status as unknown as import("./types").TaskStatus,
        target: task.target,
        params: task.params,
        source: task.source ?? "ai_system",
        createdAt: task.createdAt ?? Date.now(),
        expiresAt: task.expiresAt,
      },
      position,

      systems: this.systemRegistry,
      memory: memoryCallbacks,
    };
  }

  /**
   * Marca tarea como completada.
   */
  private completeTask(agentId: string, task: AgentTask): void {
    task.status = TaskStatus.COMPLETED;
    this.activeTask.delete(agentId);

    if (this.config.debug) {
      logger.debug(`[AISystem] ${agentId} completed: ${task.type}`);
    }

    this.emit("taskCompleted", { agentId, task });
  }

  /**
   * Marca tarea como fallida.
   */
  private failTask(agentId: string, task: AgentTask, reason: string): void {
    task.status = TaskStatus.FAILED;
    this.activeTask.delete(agentId);

    if (this.config.debug) {
      logger.debug(`[AISystem] ${agentId} failed: ${task.type} (${reason})`);
    }

    this.emit("taskFailed", { agentId, task, reason });
  }

  /**
   * Ejecuta detectores internos como backup.
   * Los sistemas externos deberían emitir tareas directamente,
   * pero los detectores sirven como fallback.
   */
  private runDetectors(agentId: string): void {
    const ctx = this.buildDetectorContext(agentId);
    if (!ctx) return;

    const tasks = runAllDetectors(ctx);
    for (const task of tasks) {
      this.taskQueue.enqueue(
        agentId,
        task as AgentTask,
        this.config.priorityBoost,
      );
    }

    if (tasks.length > 0) {
      logger.debug(
        `[AISystem] runDetectors ${agentId}: ${tasks.length} tasks enqueued, types=${tasks.map((t) => t.type).join(",")}`,
      );
    }
  }

  /**
   * Construye contexto para detectores.
   * Usa WorldQueryService para poblar campos espaciales.
   * Implementa caché con TTL de 500ms para reducir queries costosas.
   */
  private buildDetectorContext(agentId: string): DetectorContext | null {
    // Verificar caché primero
    const now = Date.now();
    const cached = this.contextCache.get(agentId);
    if (cached && now - cached.timestamp < this.CONTEXT_CACHE_TTL) {
      return cached.context;
    }

    const position = this.agentRegistry?.getPosition(agentId);
    if (!position) return null;

    const needs: DetectorContext["needs"] = this.needsSystem?.getNeeds(
      agentId,
    ) as DetectorContext["needs"];

    const spatialContext = this.buildSpatialContext(position, agentId);

    const memory = this.getAgentMemory(agentId);
    const explorationContext: Record<string, unknown> = {
      visitedZones: memory.visitedZones,
      lastExploreTime: memory.lastExploreTime,
      knownResources: memory.knownResourceLocations,
    };

    const zonesMetadata = this.worldContextCache?.getZonesMetadata();
    if (zonesMetadata) {
      const zoneCenters = this.getZoneCentersFromMetadata(zonesMetadata);
      if (zoneCenters.length > 0) {
        explorationContext.allZones = zoneCenters;
      }
    } else if (this.gameState.zones && this.gameState.zones.length > 0) {
      explorationContext.allZones = this.gameState.zones.map((z) => ({
        id: z.id,
        x: z.bounds.x + z.bounds.width / 2,
        y: z.bounds.y + z.bounds.height / 2,
      }));
    }

    let inventoryLoad = 0;
    const inventoryCapacity = 50;
    let depositZoneId: string | undefined;
    let agentInventory: Record<string, number> = {};

    const inventorySystem = this.systemRegistry?.inventory;
    if (inventorySystem) {
      const availableSpace = inventorySystem.getInventorySpace(agentId);
      inventoryLoad = inventoryCapacity - availableSpace;

      agentInventory =
        (inventorySystem.getAgentInventory?.(agentId) as
          | Record<string, number>
          | undefined) ?? {};
    }

    if (zonesMetadata) {
      const storageZone = this.findClosestZone(
        position,
        zonesMetadata.storageZones,
      );
      if (storageZone) {
        depositZoneId = storageZone.id;
      }
    } else if (this.gameState.zones) {
      const storageZone = this.gameState.zones.find(
        (z) => z.type === ZoneType.STORAGE || z.id.includes(ZoneType.STORAGE),
      );
      if (storageZone) {
        depositZoneId = storageZone.id;
      }
    }

    let _hasBuildingResourceDemand = false;
    let _buildingResourceNeeds: { wood?: number; stone?: number } | undefined;
    const buildingSystem = this.systemRegistry?.building;
    if (
      buildingSystem &&
      typeof buildingSystem.getResourceDemand === "function"
    ) {
      const demand: { wood: number; stone: number } | null =
        buildingSystem.getResourceDemand();
      if (demand && (demand.wood > 0 || demand.stone > 0)) {
        _hasBuildingResourceDemand = true;
        _buildingResourceNeeds = demand;
        if (RandomUtils.chance(0.01)) {
          logger.debug(
            `🏗️ [AISystem] ${agentId}: Building demand detected: wood=${demand.wood}, stone=${demand.stone}`,
          );
        }
      }
    }

    let _globalStockpile:
      | { wood?: number; stone?: number; food?: number }
      | undefined;
    let _totalAgents = 1;

    if (this.worldContextCache) {
      const stats = this.worldContextCache.getInventoryStats();
      _globalStockpile = {
        wood: (stats.stockpiled.wood ?? 0) + (stats.inAgents.wood ?? 0),
        stone: (stats.stockpiled.stone ?? 0) + (stats.inAgents.stone ?? 0),
        food: (stats.stockpiled.food ?? 0) + (stats.inAgents.food ?? 0),
      };
    } else {
      const inventorySys = this.systemRegistry?.inventory as unknown as {
        getSystemStats?: () => {
          stockpiled: { wood: number; stone: number; food: number };
          inAgents: { wood: number; stone: number; food: number };
        };
      };
      if (inventorySys?.getSystemStats) {
        const stats = inventorySys.getSystemStats();

        _globalStockpile = {
          wood: (stats.stockpiled.wood ?? 0) + (stats.inAgents.wood ?? 0),
          stone: (stats.stockpiled.stone ?? 0) + (stats.inAgents.stone ?? 0),
          food: (stats.stockpiled.food ?? 0) + (stats.inAgents.food ?? 0),
        };
      }
    }

    if (this.agentRegistry) {
      _totalAgents = Math.max(1, this.agentRegistry.getStats().aliveAgents);
    }

    const isWorkHours = this.calculateIsWorkHours();

    const equippedWeapon = equipmentSystem.getEquippedItem(
      agentId,
      EquipmentSlot.MAIN_HAND,
    );
    const hasWeapon =
      equippedWeapon !== undefined && equippedWeapon !== WeaponId.UNARMED;

    const agentNeeds = this.needsSystem?.getNeeds(agentId);

    const health =
      (agentNeeds as Record<string, number | undefined>)?.health ?? 100;
    const maxHealth = 100;

    let roleType: string | undefined;
    try {
      const roleSystem = getContainer().get<RoleSystem>(TYPES.RoleSystem);
      const agentRole = roleSystem.getAgentRole(agentId);
      roleType = agentRole?.roleType;
    } catch (error) {
      logger.debug("RoleSystem not available for agent context", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const craftingSystem = this.systemRegistry?.crafting;
    let canCraftClub = false;
    let canCraftDagger = false;

    if (
      craftingSystem &&
      typeof (
        craftingSystem as unknown as {
          canCraftWeapon?: (agentId: string, weaponId: string) => boolean;
        }
      ).canCraftWeapon === "function"
    ) {
      const craftSys = craftingSystem as unknown as {
        canCraftWeapon: (agentId: string, weaponId: string) => boolean;
      };
      canCraftClub = craftSys.canCraftWeapon(agentId, WeaponId.WOODEN_CLUB);
      canCraftDagger = craftSys.canCraftWeapon(agentId, WeaponId.STONE_DAGGER);
    }

    let craftZoneId: string | undefined;
    let pendingBuilds: { id: string; zoneId: string; progress: number }[] = [];
    const workZonesWithItems: {
      zoneId: string;
      x: number;
      y: number;
      items: { itemId: string; quantity: number }[];
    }[] = [];
    if (zonesMetadata) {
      const craftZone = this.findClosestZone(
        position,
        zonesMetadata.craftZones,
      );
      if (craftZone) {
        craftZoneId = craftZone.id;
      }

      pendingBuilds =
        zonesMetadata.pendingBuilds.map((build) => ({
          id: build.id,
          zoneId: build.zoneId,
          progress: build.progress,
        })) ?? [];

      for (const zone of zonesMetadata.workZones) {
        const dx = zone.center.x - position.x;
        const dy = zone.center.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1000) {
          workZonesWithItems.push({
            zoneId: zone.id,
            x: zone.center.x,
            y: zone.center.y,
            items: [
              { itemId: ItemId.WOOD_LOG, quantity: 1 },
              { itemId: ItemId.STONE, quantity: 1 },
            ],
          });
        }
      }
    } else if (this.gameState.zones && this.gameState.zones.length > 0) {
      const workZoneTypes = [ZoneType.WORK, ZoneType.GATHERING, ZoneType.WILD];

      for (const zone of this.gameState.zones) {
        const isWorkZone =
          workZoneTypes.includes(zone.type as ZoneType) ||
          zone.id.includes("workbench") ||
          zone.id.includes("mine") ||
          zone.id.includes("forest") ||
          zone.id.includes("logging") ||
          zone.id.includes("quarry");

        if (isWorkZone) {
          const centerX = zone.bounds.x + zone.bounds.width / 2;
          const centerY = zone.bounds.y + zone.bounds.height / 2;

          const dx = centerX - position.x;
          const dy = centerY - position.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 1000) {
            workZonesWithItems.push({
              zoneId: zone.id,
              x: centerX,
              y: centerY,
              items: [
                { itemId: ItemId.WOOD_LOG, quantity: 1 },
                { itemId: ItemId.STONE, quantity: 1 },
              ],
            });
          }
        }
      }

      pendingBuilds = this.gameState.zones
        .map((zone) => {
          const metadata = (
            zone as {
              metadata?: { buildProgress?: number };
            }
          ).metadata;
          const progress = metadata?.buildProgress;
          if (progress !== undefined && progress < 1) {
            return {
              id: zone.id,
              zoneId: zone.id,
              progress,
            };
          }
          return undefined;
        })
        .filter(
          (build): build is { id: string; zoneId: string; progress: number } =>
            Boolean(build),
        );

      const craftZone = this.gameState.zones.find(
        (z) =>
          z.type === ZoneType.WORK ||
          z.id.includes("craft") ||
          (z as { metadata?: { craftingStation?: boolean } }).metadata
            ?.craftingStation === true,
      );
      if (craftZone) {
        craftZoneId = craftZone.id;
      }
    }

    const context: DetectorContext = {
      agentId,
      position,
      needs,
      now: Date.now(),
      isWorkHours,
      inventoryLoad,
      inventoryCapacity,
      depositZoneId,

      inventory:
        Object.keys(agentInventory).length > 0 ? agentInventory : undefined,

      hasWeapon,
      equippedWeapon: equippedWeapon ?? WeaponId.UNARMED,
      health,
      maxHealth,
      roleType,

      canCraftClub,
      canCraftDagger,
      craftZoneId,

      pendingBuilds: pendingBuilds.length > 0 ? pendingBuilds : undefined,
      hasBuildingResourceDemand: _hasBuildingResourceDemand,
      buildingResourceNeeds: _buildingResourceNeeds,
      globalStockpile: _globalStockpile,
      totalAgents: _totalAgents,

      workZonesWithItems:
        workZonesWithItems.length > 0 ? workZonesWithItems : undefined,
      ...spatialContext,
      ...explorationContext,
    };

    // Guardar en caché
    this.contextCache.set(agentId, { context, timestamp: now });

    return context;
  }

  private getZoneCentersFromMetadata(
    metadata: ZonesMetadata,
  ): Array<{ id: string; x: number; y: number }> {
    const centers: Array<{ id: string; x: number; y: number }> = [];
    const seen = new Set<string>();
    const register = (zone: CachedZoneInfo): void => {
      if (seen.has(zone.id)) return;
      seen.add(zone.id);
      centers.push({
        id: zone.id,
        x: zone.center.x,
        y: zone.center.y,
      });
    };

    metadata.storageZones.forEach(register);
    metadata.workZones.forEach(register);
    metadata.craftZones.forEach(register);

    return centers;
  }

  private findClosestZone(
    position: { x: number; y: number },
    zones: readonly CachedZoneInfo[],
  ): CachedZoneInfo | undefined {
    let closest: CachedZoneInfo | undefined;
    let minDistSq = Infinity;

    for (const zone of zones) {
      const dx = zone.center.x - position.x;
      const dy = zone.center.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = zone;
      }
    }

    return closest;
  }

  /**
   * Construye contexto espacial usando WorldQueryService.
   * Retorna un objeto mutable para luego hacer spread.
   *
   * NOTA: Este método hace múltiples queries espaciales. La mayoría de estos datos
   * son cacheados por buildDetectorContext (TTL 500ms) para evitar recomputación.
   * Optimización futura: combinar queries de recursos en una sola llamada.
   */
  private buildSpatialContext(
    position: { x: number; y: number },
    agentId: string,
  ): Record<string, unknown> {
    if (!this.worldQueryService) return {};

    const wqs = this.worldQueryService;
    const QUERY_RADIUS = 300;
    const result: Record<string, unknown> = {};

    // Query 1: Nearest food
    const nearestFood = wqs.findNearestFood(position.x, position.y);
    if (nearestFood && "id" in nearestFood) {
      result.nearestFood = {
        id: nearestFood.id,
        x: nearestFood.position.x,
        y: nearestFood.position.y,
      };
    }

    const nearestWater = wqs.findNearestWater(position.x, position.y);
    if (nearestWater) {
      if ("worldX" in nearestWater) {
        result.nearestWater = {
          id: `tile_${nearestWater.tileX}_${nearestWater.tileY}`,
          x: nearestWater.worldX,
          y: nearestWater.worldY,
        };
      }
    }

    const nearestResource = wqs.findNearestResource(position.x, position.y, {
      excludeDepleted: true,
    });
    if (nearestResource && nearestResource.distance < QUERY_RADIUS) {
      result.nearestResource = {
        id: nearestResource.id,
        x: nearestResource.position.x,
        y: nearestResource.position.y,
        type: nearestResource.resourceType,
      };
    }

    const buildingSystem = this.systemRegistry?.building;
    const resourceDemand = buildingSystem?.getResourceDemand?.();
    if (
      resourceDemand &&
      (resourceDemand.wood > 0 || resourceDemand.stone > 0)
    ) {
      if (resourceDemand.wood > 0) {
        const nearestTree = wqs.findNearestResource(position.x, position.y, {
          type: WorldResourceType.TREE,
          excludeDepleted: true,
        });
        if (nearestTree && nearestTree.distance < QUERY_RADIUS) {
          result.nearestTree = {
            id: nearestTree.id,
            x: nearestTree.position.x,
            y: nearestTree.position.y,
            type: nearestTree.resourceType,
          };
        }
      }

      if (resourceDemand.stone > 0) {
        const nearestRock = wqs.findNearestResource(position.x, position.y, {
          type: WorldResourceType.ROCK,
          excludeDepleted: true,
        });
        if (nearestRock && nearestRock.distance < QUERY_RADIUS) {
          result.nearestStone = {
            id: nearestRock.id,
            x: nearestRock.position.x,
            y: nearestRock.position.y,
            type: nearestRock.resourceType,
          };
        }
      }
    }

    if (RandomUtils.chance(0.02)) {
      logger.debug(
        `[AISystem] buildSpatial ${agentId}: food=${result.nearestFood ? "found" : "none"}, water=${result.nearestWater ? "found" : "none"}, resource=${result.nearestResource ? "found" : "none"}`,
      );
    }

    const nearbyAgentsResult = wqs.findAgentsInRadius(
      position.x,
      position.y,
      QUERY_RADIUS,
      { excludeDead: true },
    );
    if (nearbyAgentsResult.length > 0) {
      const otherAgents = nearbyAgentsResult.filter((a) => a.id !== agentId);

      result.nearbyAgents = otherAgents.map((a) => ({
        id: a.id,
        x: a.position.x,
        y: a.position.y,
      }));

      const currentAgent = this.agentRegistry?.getProfile(agentId);
      if (currentAgent) {
        const potentialMate = otherAgents.find((a) => {
          const agent = a.agent;
          if (!agent || agent.sex === currentAgent.sex) return false;
          if (agent.lifeStage !== LifeStage.ADULT) return false;
          const needs = agent.needs;
          if (!needs) return false;
          const wellness = (needs.hunger + needs.thirst + needs.energy) / 300;
          return wellness > 0.6;
        });

        if (potentialMate) {
          result.potentialMate = {
            id: potentialMate.id,
            x: potentialMate.position.x,
            y: potentialMate.position.y,
          };
          if (RandomUtils.chance(0.1)) {
            logger.debug(
              `💕 [SocialContext] ${agentId} found potentialMate: ${potentialMate.id}`,
            );
          }
        }

        const agentInNeed = otherAgents.find((a) => {
          const needs = a.agent?.needs;
          if (!needs) return false;
          return needs.hunger < 30 || needs.thirst < 30 || needs.energy < 20;
        });

        if (agentInNeed) {
          const needs = agentInNeed.agent?.needs;
          const criticalNeed = needs
            ? needs.thirst < 30
              ? "thirst"
              : needs.hunger < 30
                ? "hunger"
                : NeedType.ENERGY
            : NeedType.ENERGY;
          result.nearbyAgentInNeed = {
            id: agentInNeed.id,
            need: criticalNeed,
            targetZoneId: undefined,
          };
          if (RandomUtils.chance(0.1)) {
            logger.debug(
              `🆘 [SocialContext] ${agentId} found agentInNeed: ${agentInNeed.id} (${criticalNeed})`,
            );
          }
        }
      }
    }

    const nearbyAnimals = wqs.findAnimalsInRadius(
      position.x,
      position.y,
      QUERY_RADIUS,
      { hostile: true, excludeDead: true },
    );
    if (nearbyAnimals.length > 0) {
      result.nearbyPredators = nearbyAnimals.map((a) => ({
        id: a.id,
        x: a.position.x,
        y: a.position.y,
        type: a.animalType,
      }));
    }

    return result;
  }

  /**
   * Cancela la tarea activa de un agente.
   */
  public cancelTask(agentId: string): void {
    this.activeTask.delete(agentId);
  }

  /**
   * Limpia todo el estado de un agente.
   */
  public clearAgent(agentId: string): void {
    this.activeTask.delete(agentId);
    this.taskQueue.clear(agentId);
    this.lastUpdate.delete(agentId);
    this.agentMemories.delete(agentId);
  }

  /**
   * Obtiene la tarea activa de un agente.
   */
  public getActiveTask(agentId: string): AgentTask | undefined {
    return this.activeTask.get(agentId);
  }

  /**
   * Obtiene las tareas pendientes de un agente.
   */
  public getPendingTasks(agentId: string): readonly AgentTask[] {
    return this.taskQueue.getTasks(agentId);
  }

  /**
   * Obtiene estadísticas del sistema.
   */
  public getStats(): {
    activeAgents: number;
    totalPendingTasks: number;
  } {
    const queueStats = this.taskQueue.getStats();
    return {
      activeAgents: this.activeTask.size,
      totalPendingTasks: queueStats.totalTasks,
    };
  }

  /**
   * Cleanup del sistema.
   */
  public cleanup(): void {
    this.activeTask.clear();
    this.lastUpdate.clear();
    this.removeAllListeners();
  }

  /**
   * Determina si es hora de trabajo basándose en el TimeSystem.
   * Horas de trabajo: 6:00 - 18:00 (día completo)
   */
  private calculateIsWorkHours(): boolean {
    if (!this.timeSystem) {
      return true;
    }

    try {
      const currentTime = this.timeSystem.getCurrentTime();
      const hour = currentTime.hour;

      return hour >= 6 && hour < 18;
    } catch (error) {
      logger.debug(
        "Failed to get current time from TimeSystem, assuming work hours",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return true;
    }
  }
}
