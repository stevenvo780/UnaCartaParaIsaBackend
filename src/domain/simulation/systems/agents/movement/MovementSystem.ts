import { EventEmitter } from "events";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../../../core/PerformanceMonitor";
import EasyStar from "easystarjs";
import { GameState, MapElement } from "@/shared/types/game-types";
import { logger } from "../../../../../infrastructure/utils/logger";
import { GameEventType, simulationEvents } from "../../../core/events";
import { injectable, inject, optional, postConstruct } from "inversify";
import { TYPES } from "../../../../../config/Types";
import type { EntityIndex } from "../../../core/EntityIndex";
import type { GPUComputeService } from "../../../core/GPUComputeService";
import type { StateDirtyTracker } from "../../../core/StateDirtyTracker";
import type { AgentRegistry } from "../../agents/AgentRegistry";
import type { IMovementSystem } from "../../agents/SystemRegistry";
import { getFrameTime } from "../../../../../shared/FrameTime";
import { WORLD_CONFIG } from "../../../../../shared/constants/WorldConfig";
import {
  estimateTravelTime,
  assessRouteDifficultyByDistance,
  calculateZoneDistance,
  worldToGrid,
  findAccessibleDestination,
  Difficulty,
} from "./helpers";
import { MovementBatchProcessor } from "./MovementBatchProcessor";
import { ActivityType } from "../../../../../shared/constants/MovementEnums";
import { ActionType } from "../../../../../shared/constants/AIEnums";
import { SIM_CONSTANTS } from "../../../core/SimulationConstants";
import { TerrainSystem } from "../../world/TerrainSystem";

export interface EntityMovementState {
  entityId: string;
  currentPosition: { x: number; y: number };
  startPosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  targetZone?: string;
  isMoving: boolean;
  movementStartTime?: number;
  estimatedArrivalTime?: number;
  currentPath: Array<{ x: number; y: number }>;
  currentActivity: ActivityType;
  activityStartTime?: number;
  activityDuration?: number;
  fatigue: number;
  lastIdleWander?: number;
  isPathfinding?: boolean;
  /** Timestamp when pathfinding started - used to timeout stuck pathfinding */
  pathfindingStartTime?: number;
  /** Timestamp when the agent arrived at destination - used to prevent immediate idle wander */
  lastArrivalTime?: number;
}

export interface PathfindingResult {
  success: boolean;
  path: Array<{ x: number; y: number }>;
  estimatedTime: number;
  distance: number;
}

export interface ZoneDistance {
  fromZone: string;
  toZone: string;
  distance: number;
  travelTime: number;
  difficulty: Difficulty;
}

/**
 * System for managing entity movement, pathfinding, and activities.
 *
 * Features:
 * - A* pathfinding using EasyStar.js
 * - Batch processing for performance with many moving entities
 * - Zone-based movement and activity management
 * - Fatigue system affecting movement speed
 * - Idle wandering behavior
 * - Path caching and grid caching for optimization
 *
 * @see MovementBatchProcessor for batch processing
 * @see EasyStar.js for pathfinding algorithm
 */
@injectable()
export class MovementSystem extends EventEmitter implements IMovementSystem {
  @inject(TYPES.GameState)
  private gameState!: GameState;
  private movementStates = new Map<string, EntityMovementState>();
  private pathfinder: EasyStar.js;

  private zoneDistanceCache = new Map<string, ZoneDistance>();
  private readonly gridSize = SIM_CONSTANTS.PATHFINDING_GRID_SIZE;
  private gridWidth: number;
  private gridHeight: number;
  private occupiedTiles = new Set<string>();
  private cachedGrid: number[][] | null = null;
  private gridCacheTime: number = 0;
  private gridDirty = true;

  private pathCache = new Map<
    string,
    { result: PathfindingResult; timestamp: number }
  >();
  private readonly GRID_CACHE_DURATION = 30000;
  private readonly PATH_CACHE_DURATION = 30000;
  private lastCacheCleanup: number = 0;
  private entitiesDirty = true;

  private batchProcessor: MovementBatchProcessor;
  /**
   * Threshold for activating batch processing.
   * 5 entities: GPU batch processing is efficient for position updates.
   */
  private readonly BATCH_THRESHOLD = 5;

  private pathfindingQueue: Array<{
    entityId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    callback: (result: PathfindingResult) => void;
  }> = [];
  private activePaths = 0;
  private readonly MAX_CONCURRENT_PATHS = 5;
  @inject(TYPES.AgentRegistry as symbol)
  @optional()
  private agentRegistry?: AgentRegistry;

  @inject(TYPES.EntityIndex as symbol)
  @optional()
  private _entityIndex?: EntityIndex;
  @inject(TYPES.GPUComputeService as symbol)
  @optional()
  private _gpuService?: GPUComputeService;
  @inject(TYPES.StateDirtyTracker as symbol)
  @optional()
  private _dirtyTracker?: StateDirtyTracker;
  @inject(TYPES.TerrainSystem as symbol)
  @optional()
  private _terrainSystem?: TerrainSystem;

  constructor() {
    super();

    this.pathfinder = new EasyStar.js();
    this.gridWidth = 1;
    this.gridHeight = 1;
    this.batchProcessor = new MovementBatchProcessor(this._gpuService);
    void this._entityIndex;
    void this._dirtyTracker;
    void this._terrainSystem;
    void this._init;
  }

  @postConstruct()
  private _init(): void {
    this.pathfinder.setAcceptableTiles([0]);
    this.pathfinder.enableDiagonals();
    this.pathfinder.setIterationsPerCalculation(
      SIM_CONSTANTS.PATHFINDING_MAX_ITERATIONS,
    );

    const worldWidthPx =
      this.gameState.worldSize?.width ?? WORLD_CONFIG.WORLD_WIDTH;
    const worldHeightPx =
      this.gameState.worldSize?.height ?? WORLD_CONFIG.WORLD_HEIGHT;
    this.gridWidth = Math.max(1, Math.ceil(worldWidthPx / this.gridSize));
    this.gridHeight = Math.max(1, Math.ceil(worldHeightPx / this.gridSize));

    this.precomputeZoneDistances();
    this.initializeObstacles();
    this.batchProcessor = new MovementBatchProcessor(this._gpuService);
    if (this._gpuService?.isGPUAvailable()) {
      logger.info(
        "🚶 MovementSystem: GPU acceleration enabled for batch processing",
      );
    }

    if (this.agentRegistry) {
      this.agentRegistry.registerMovement(
        this.movementStates as Map<
          string,
          import("../../agents/AgentRegistry").MovementState
        >,
      );
    }

    logger.info("🚶 MovementSystem initialized", {
      gridSize: `${this.gridWidth}x${this.gridHeight}`,
      zones: this.gameState.zones.length,
    });
    void this._init;
  }

  public async update(deltaMs: number): Promise<void> {
    const now = getFrameTime();

    this.processPathfindingQueue();

    let movingCount = 0;
    for (const state of this.movementStates.values()) {
      if (state.isMoving) movingCount++;
    }

    if (movingCount >= this.BATCH_THRESHOLD) {
      await this.updateBatch(deltaMs, now);
    } else {
      for (const state of this.movementStates.values()) {
        this.updateEntityMovement(state, now, deltaMs);
        this.updateEntityActivity(state, now);
        this.updateEntityFatigue(state);
        this.maybeStartIdleWander(state, now);
      }
    }

    if (now - this.lastCacheCleanup > 30000) {
      this.cleanupOldCache(now);
      this.lastCacheCleanup = now;
    }

    this.pathfinder.calculate();
  }

  private processPathfindingQueue(): void {
    if (this.activePaths >= this.MAX_CONCURRENT_PATHS) {
      return;
    }

    while (
      this.pathfindingQueue.length > 0 &&
      this.activePaths < this.MAX_CONCURRENT_PATHS
    ) {
      const request = this.pathfindingQueue.shift();
      if (!request) break;

      this.activePaths++;

      this.calculatePath(request.from, request.to)
        .then((result) => {
          this.activePaths--;
          request.callback(result);

          if (this.pathfindingQueue.length > 10) {
            logger.warn(
              `Pathfinding queue has ${this.pathfindingQueue.length} pending requests`,
            );
          }
        })
        .catch((err) => {
          this.activePaths--;
          logger.error(
            `Pathfinding error for entity ${request.entityId}:`,
            err,
          );

          const distance = Math.hypot(
            request.to.x - request.from.x,
            request.to.y - request.from.y,
          );
          request.callback({
            success: false,
            path: [],
            estimatedTime: estimateTravelTime(
              distance,
              0,
              SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
              SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
            ),
            distance,
          });
        });
    }
  }

  private enqueuePathfinding(
    entityId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    callback: (result: PathfindingResult) => void,
  ): void {
    const existingIndex = this.pathfindingQueue.findIndex(
      (r) => r.entityId === entityId,
    );

    if (existingIndex !== -1) {
      this.pathfindingQueue[existingIndex] = { entityId, from, to, callback };
    } else {
      this.pathfindingQueue.push({ entityId, from, to, callback });
    }
  }

  private isMovingBuffer: Uint8Array | null = null;
  private isRestingBuffer: Uint8Array | null = null;

  private async updateBatch(deltaMs: number, now: number): Promise<void> {
    if (this.entitiesDirty) {
      this.batchProcessor.rebuildBuffers(this.movementStates);
      this.entitiesDirty = false;
    }
    this.batchProcessor.syncTargetsFromStates(this.movementStates);

    const entityIdArray = this.batchProcessor.getEntityIdArray();
    const entityCount = entityIdArray.length;

    if (!this.isMovingBuffer || this.isMovingBuffer.length < entityCount) {
      this.isMovingBuffer = new Uint8Array(Math.ceil(entityCount * 1.5));
      this.isRestingBuffer = new Uint8Array(Math.ceil(entityCount * 1.5));
    }

    for (let i = 0; i < entityCount; i++) {
      const entityId = entityIdArray[i];
      const state = this.movementStates.get(entityId);
      if (state) {
        this.isMovingBuffer![i] =
          state.isMoving && !!state.targetPosition ? 1 : 0;
        this.isRestingBuffer![i] =
          state.currentActivity === ActivityType.RESTING ? 1 : 0;
      } else {
        this.isMovingBuffer![i] = 0;
        this.isRestingBuffer![i] = 0;
      }
    }

    if (
      !this._persistentIsMoving ||
      this._persistentIsMoving.length < entityCount
    ) {
      this._persistentIsMoving = new Array<boolean>(
        Math.ceil(entityCount * 1.5),
      ).fill(false);
      this._persistentIsResting = new Array<boolean>(
        Math.ceil(entityCount * 1.5),
      ).fill(false);
    }

    for (let i = 0; i < entityCount; i++) {
      const entityId = entityIdArray[i];
      const state = this.movementStates.get(entityId);
      if (state) {
        this._persistentIsMoving[i] = state.isMoving && !!state.targetPosition;
        this._persistentIsResting[i] =
          state.currentActivity === ActivityType.RESTING;
      } else {
        this._persistentIsMoving[i] = false;
        this._persistentIsResting[i] = false;
      }
    }

    const isMovingSlice = this._persistentIsMoving.slice(0, entityCount);
    const isRestingSlice = this._persistentIsResting.slice(0, entityCount);

    const { updated, arrived } =
      await this.batchProcessor.updatePositionsBatch(deltaMs);

    await this.batchProcessor.updateFatigueBatch(
      isMovingSlice,
      isRestingSlice,
      deltaMs,
    );

    this.batchProcessor.syncToStates(this.movementStates);

    for (let i = 0; i < entityCount; i++) {
      if (!updated[i]) continue;

      const entityId = entityIdArray[i];
      const state = this.movementStates.get(entityId);
      if (!state) continue;

      if (arrived[i] && state.isMoving) {
        this.completeMovement(state);
      }

      this.updateEntityActivity(state, now);
      this.maybeStartIdleWander(state, now);

      const agent = this.agentRegistry?.getProfile(entityId);
      if (agent) {
        if (!agent.position) {
          agent.position = {
            x: state.currentPosition.x,
            y: state.currentPosition.y,
          };
        } else {
          agent.position.x = state.currentPosition.x;
          agent.position.y = state.currentPosition.y;
        }
      }
    }
  }

  private _persistentIsMoving: boolean[] = [];
  private _persistentIsResting: boolean[] = [];

  private updateEntityMovement(
    state: EntityMovementState,
    _now: number,
    deltaMs: number,
  ): void {
    if (!state.isMoving || !state.targetPosition) return;

    const dx = state.targetPosition.x - state.currentPosition.x;
    const dy = state.targetPosition.y - state.currentPosition.y;
    const distanceRemaining = Math.hypot(dx, dy);

    if (distanceRemaining < 2) {
      this.completeMovement(state);
      return;
    }

    const ageSpeedMultiplier = 1.0;
    const fatigueMultiplier =
      1 /
      (1 + (state.fatigue / 100) * SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER);

    const effectiveSpeed =
      SIM_CONSTANTS.BASE_MOVEMENT_SPEED *
      ageSpeedMultiplier *
      fatigueMultiplier;

    const moveDistance = (effectiveSpeed * deltaMs) / 1000;

    if (moveDistance >= distanceRemaining) {
      state.currentPosition.x = state.targetPosition.x;
      state.currentPosition.y = state.targetPosition.y;
    } else {
      const ratio = moveDistance / distanceRemaining;
      state.currentPosition.x += dx * ratio;
      state.currentPosition.y += dy * ratio;
    }

    const agent = this.agentRegistry?.getProfile(state.entityId);
    if (agent) {
      if (!agent.position) {
        agent.position = {
          x: state.currentPosition.x,
          y: state.currentPosition.y,
        };
      } else {
        agent.position.x = state.currentPosition.x;
        agent.position.y = state.currentPosition.y;
      }
    }
  }

  private updateEntityActivity(state: EntityMovementState, now: number): void {
    if (
      state.currentActivity === ActivityType.MOVING ||
      state.currentActivity === ActivityType.IDLE
    )
      return;

    if (state.activityStartTime && state.activityDuration) {
      const elapsed = now - state.activityStartTime;
      if (elapsed >= state.activityDuration) {
        this.completeActivity(state);
      }
    }
  }

  private updateEntityFatigue(state: EntityMovementState): void {
    if (state.isMoving) {
      state.fatigue = Math.min(100, state.fatigue + 0.1);
    } else if (state.currentActivity === ActivityType.RESTING) {
      state.fatigue = Math.max(0, state.fatigue - 0.5);
    } else {
      state.fatigue = Math.max(0, state.fatigue - 0.1);
    }
  }

  private completeMovement(state: EntityMovementState): void {
    const now = getFrameTime();
    state.isMoving = false;
    state.currentActivity = ActivityType.IDLE;
    state.lastArrivalTime = now;

    if (state.targetPosition) {
      state.currentPosition.x = state.targetPosition.x;
      state.currentPosition.y = state.targetPosition.y;

      const agent = this.agentRegistry?.getProfile(state.entityId);
      if (agent) {
        if (!agent.position) {
          agent.position = {
            x: state.currentPosition.x,
            y: state.currentPosition.y,
          };
        } else {
          agent.position.x = state.currentPosition.x;
          agent.position.y = state.currentPosition.y;
        }
      }
    }

    const arrivedZone = state.targetZone;
    state.targetZone = undefined;
    state.targetPosition = undefined;
    state.currentPath = [];

    if (arrivedZone) {
      simulationEvents.emit(GameEventType.MOVEMENT_ARRIVED_AT_ZONE, {
        entityId: state.entityId,
        zoneId: arrivedZone,
      });
    }

    simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
      agentId: state.entityId,
      actionType: ActionType.MOVE,
      success: true,
      position: { ...state.currentPosition },
      targetZone: arrivedZone,
    });

    simulationEvents.emit(GameEventType.MOVEMENT_ACTIVITY_COMPLETED, {
      entityId: state.entityId,
      activity: "moving",
      position: { ...state.currentPosition },
    });
  }

  private completeActivity(state: EntityMovementState): void {
    const previousActivity = state.currentActivity;
    state.currentActivity = ActivityType.IDLE;
    state.activityStartTime = undefined;
    state.activityDuration = undefined;

    simulationEvents.emit(GameEventType.MOVEMENT_ACTIVITY_COMPLETED, {
      entityId: state.entityId,
      activity: previousActivity,
      position: state.currentPosition,
    });
  }

  public initializeEntityMovement(
    entityId: string,
    initialPosition: { x: number; y: number },
  ): void {
    if (!isFinite(initialPosition.x) || !isFinite(initialPosition.y)) {
      initialPosition = { x: 100, y: 100 };
    }

    const movementState: EntityMovementState = {
      entityId,
      currentPosition: { ...initialPosition },
      isMoving: false,
      currentPath: [],
      currentActivity: ActivityType.IDLE,
      fatigue: 0,
      lastIdleWander: 0,
    };

    this.movementStates.set(entityId, movementState);
    this.entitiesDirty = true;

    const agent = this.agentRegistry?.getProfile(entityId);
    if (agent) {
      agent.position = { ...initialPosition };
    }
  }

  private readonly PATHFINDING_TIMEOUT_MS = 10000;

  public moveToZone(entityId: string, targetZoneId: string): boolean {
    const state = this.movementStates.get(entityId);
    const targetZone = this.gameState.zones.find((z) => z.id === targetZoneId);

    if (!state || !targetZone) {
      logger.warn(
        `🚶 [moveToZone] ${entityId}: state=${!!state}, zone=${!!targetZone}`,
      );
      return false;
    }

    const now = Date.now();
    if (state.isPathfinding) {
      if (
        state.pathfindingStartTime &&
        now - state.pathfindingStartTime > this.PATHFINDING_TIMEOUT_MS
      ) {
        logger.warn(
          `[MovementSystem] ${entityId}: Pathfinding timeout, resetting state`,
        );
        state.isPathfinding = false;
        state.pathfindingStartTime = undefined;
      } else {
        logger.debug(
          `🚶 [moveToZone] ${entityId}: Already pathfinding, skipping`,
        );
        return false;
      }
    }

    state.isPathfinding = true;
    state.pathfindingStartTime = now;

    const targetX = targetZone.bounds.x + targetZone.bounds.width / 2;
    const targetY = targetZone.bounds.y + targetZone.bounds.height / 2;

    logger.info(
      `🚶 [moveToZone] ${entityId}: Enqueueing pathfinding to zone ${targetZoneId} (target=${targetX.toFixed(0)},${targetY.toFixed(0)})`,
    );

    this.enqueuePathfinding(
      entityId,
      state.currentPosition,
      { x: targetX, y: targetY },
      (pathResult) => {
        state.isPathfinding = false;
        state.pathfindingStartTime = undefined;
        if (!pathResult.success || pathResult.path.length === 0) {
          logger.warn(
            `🚶 [moveToZone] Pathfinding FAILED for ${entityId} to zone ${targetZoneId}`,
          );

          simulationEvents.emit(GameEventType.PATHFINDING_FAILED, {
            entityId,
            targetZoneId,
            reason: "no_path_found",
            timestamp: Date.now(),
          });

          simulationEvents.emit(GameEventType.AGENT_ACTION_COMPLETE, {
            agentId: entityId,
            actionType: ActionType.MOVE,
            success: false,
            targetZone: targetZoneId,
          });
          return;
        }

        logger.info(
          `🚶 [moveToZone] ${entityId}: Pathfinding SUCCESS, path length=${pathResult.path.length}, distance=${pathResult.distance.toFixed(0)}`,
        );

        const now = Date.now();
        const travelTime = estimateTravelTime(
          pathResult.distance,
          state.fatigue,
          SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
          SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
        );

        state.isMoving = true;
        state.targetZone = targetZoneId;
        state.startPosition = { ...state.currentPosition };
        state.targetPosition = pathResult.path[pathResult.path.length - 1];
        state.currentPath = pathResult.path;
        state.movementStartTime = now;
        state.estimatedArrivalTime = now + travelTime;
        state.currentActivity = ActivityType.MOVING;

        simulationEvents.emit(GameEventType.MOVEMENT_ACTIVITY_STARTED, {
          entityId,
          activityType: ActivityType.MOVING,
          destination: state.targetPosition,
          path: pathResult.path,
        });
      },
    );

    return true;
  }

  public moveToPoint(entityId: string, x: number, y: number): boolean {
    const state = this.movementStates.get(entityId);
    if (!state) return false;

    const tx = Math.max(0, Math.min(x, this.gridWidth * this.gridSize - 1));
    const ty = Math.max(0, Math.min(y, this.gridHeight * this.gridSize - 1));

    const distance = Math.hypot(
      tx - state.currentPosition.x,
      ty - state.currentPosition.y,
    );

    const travelTime = estimateTravelTime(
      distance,
      state.fatigue,
      SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
      SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
    );

    const now = Date.now();

    state.isMoving = true;
    state.targetZone = undefined;
    state.startPosition = { ...state.currentPosition };
    state.targetPosition = { x: tx, y: ty };
    state.currentPath = [{ ...state.currentPosition }, { x: tx, y: ty }];
    state.movementStartTime = now;
    state.estimatedArrivalTime = now + travelTime;
    state.currentActivity = ActivityType.MOVING;
    state.lastArrivalTime = undefined;

    this.batchProcessor.updateEntityTarget(entityId, tx, ty);

    simulationEvents.emit(GameEventType.MOVEMENT_ACTIVITY_STARTED, {
      entityId,
      activityType: ActivityType.MOVING,
      destination: { x: tx, y: ty },
      path: state.currentPath,
    });

    return true;
  }

  public stopMovement(entityId: string): boolean {
    const state = this.movementStates.get(entityId);
    if (!state) return false;

    state.isMoving = false;
    state.targetZone = undefined;
    state.targetPosition = undefined;
    state.currentPath = [];
    state.movementStartTime = undefined;
    state.estimatedArrivalTime = undefined;
    state.currentActivity = ActivityType.IDLE;

    return true;
  }

  public hasMovementState(entityId: string): boolean {
    return this.movementStates.has(entityId);
  }

  public removeEntityMovement(entityId: string): void {
    this.movementStates.delete(entityId);
    this.entitiesDirty = true;
  }

  public isMovingToZone(entityId: string, zoneId: string): boolean {
    const state = this.movementStates.get(entityId);
    return !!(state && state.isMoving && state.targetZone === zoneId);
  }

  public isMovingToPosition(entityId: string, x: number, y: number): boolean {
    const state = this.movementStates.get(entityId);
    if (!state || !state.isMoving || !state.targetPosition) {
      return false;
    }
    return (
      Math.abs(state.targetPosition.x - x) < 1 &&
      Math.abs(state.targetPosition.y - y) < 1
    );
  }

  public getPosition(entityId: string): { x: number; y: number } | undefined {
    const state = this.movementStates.get(entityId);
    return state ? { ...state.currentPosition } : undefined;
  }

  public isMoving(entityId: string): boolean {
    const state = this.movementStates.get(entityId);
    return !!state?.isMoving;
  }

  private async calculatePath(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<PathfindingResult> {
    const startGrid = worldToGrid(from.x, from.y, this.gridSize);
    const endGrid = worldToGrid(to.x, to.y, this.gridSize);

    startGrid.x = Math.max(0, Math.min(startGrid.x, this.gridWidth - 1));
    startGrid.y = Math.max(0, Math.min(startGrid.y, this.gridHeight - 1));
    endGrid.x = Math.max(0, Math.min(endGrid.x, this.gridWidth - 1));
    endGrid.y = Math.max(0, Math.min(endGrid.y, this.gridHeight - 1));

    const pathKey = `${startGrid.x},${startGrid.y}->${endGrid.x},${endGrid.y}`;
    const now = Date.now();
    const cached = this.pathCache.get(pathKey);

    if (cached && now - cached.timestamp < this.PATH_CACHE_DURATION) {
      return cached.result;
    }

    return new Promise((resolve) => {
      const grid = this.getOptimizedGrid();
      this.pathfinder.setGrid(grid);

      const startTime = performance.now();
      this.pathfinder.findPath(
        startGrid.x,
        startGrid.y,
        endGrid.x,
        endGrid.y,
        (path) => {
          const duration = performance.now() - startTime;
          performanceMonitor.recordSubsystemExecution(
            "MovementSystem",
            "update",
            duration,
          );

          if (path) {
            const worldPath = path.map((p) => ({
              x: p.x * this.gridSize + this.gridSize / 2,
              y: p.y * this.gridSize + this.gridSize / 2,
            }));

            let distance = 0;
            for (let i = 0; i < worldPath.length - 1; i++) {
              distance += Math.hypot(
                worldPath[i + 1].x - worldPath[i].x,
                worldPath[i + 1].y - worldPath[i].y,
              );
            }

            const result: PathfindingResult = {
              success: true,
              path: worldPath,
              estimatedTime: estimateTravelTime(
                distance,
                0,
                SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
                SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
              ),
              distance,
            };

            this.pathCache.set(pathKey, { result, timestamp: now });
            resolve(result);
          } else {
            const grid = this.getOptimizedGrid();
            const accessiblePos = findAccessibleDestination(
              grid,
              endGrid.x,
              endGrid.y,
              this.gridWidth,
              this.gridHeight,
              5,
            );

            if (
              accessiblePos.x !== endGrid.x ||
              accessiblePos.y !== endGrid.y
            ) {
              this.pathfinder.findPath(
                startGrid.x,
                startGrid.y,
                accessiblePos.x,
                accessiblePos.y,
                (altPath) => {
                  if (altPath && altPath.length > 0) {
                    const worldPath = altPath.map((p) => ({
                      x: p.x * this.gridSize + this.gridSize / 2,
                      y: p.y * this.gridSize + this.gridSize / 2,
                    }));

                    let distance = 0;
                    for (let i = 0; i < worldPath.length - 1; i++) {
                      distance += Math.hypot(
                        worldPath[i + 1].x - worldPath[i].x,
                        worldPath[i + 1].y - worldPath[i].y,
                      );
                    }

                    resolve({
                      success: true,
                      path: worldPath,
                      estimatedTime: estimateTravelTime(
                        distance,
                        0,
                        SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
                        SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
                      ),
                      distance,
                    });
                    return;
                  }

                  const distance = Math.hypot(to.x - from.x, to.y - from.y);
                  resolve({
                    success: false,
                    path: [],
                    estimatedTime: estimateTravelTime(
                      distance,
                      0,
                      SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
                      SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
                    ),
                    distance,
                  });
                },
              );
              return;
            }

            const distance = Math.hypot(to.x - from.x, to.y - from.y);
            resolve({
              success: false,
              path: [],
              estimatedTime: estimateTravelTime(
                distance,
                0,
                SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
                SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
              ),
              distance,
            });
          }
        },
      );
    });
  }

  private getOptimizedGrid(): number[][] {
    const now = Date.now();

    if (
      this.cachedGrid &&
      !this.gridDirty &&
      now - this.gridCacheTime < this.GRID_CACHE_DURATION
    ) {
      return this.cachedGrid;
    }

    if (!this.cachedGrid) {
      this.cachedGrid = Array(this.gridHeight)
        .fill(null)
        .map(() => Array<number>(this.gridWidth).fill(0));
    } else if (this.gridDirty) {
      for (let y = 0; y < this.gridHeight; y++) {
        this.cachedGrid[y].fill(0);
      }
    }

    for (const key of this.occupiedTiles) {
      const [x, y] = key.split(",").map(Number);
      if (
        x >= 0 &&
        x < this.gridWidth &&
        y >= 0 &&
        y < this.gridHeight &&
        this.cachedGrid
      ) {
        this.cachedGrid[y][x] = 1;
      }
    }

    this.gridCacheTime = now;
    this.gridDirty = false;

    return this.cachedGrid!;
  }

  private initializeObstacles(): void {
    this.occupiedTiles.clear();

    if (this.gameState.mapElements) {
      for (const element of this.gameState.mapElements) {
        if (this.isObstacle(element)) {
          const gridPos = worldToGrid(
            element.position.x,
            element.position.y,
            this.gridSize,
          );
          const width = element.width || this.gridSize;
          const height = element.height || this.gridSize;
          const tilesWide = Math.ceil(width / this.gridSize);
          const tilesHigh = Math.ceil(height / this.gridSize);

          for (let dx = 0; dx < tilesWide; dx++) {
            for (let dy = 0; dy < tilesHigh; dy++) {
              this.occupiedTiles.add(`${gridPos.x + dx},${gridPos.y + dy}`);
            }
          }
        }
      }
    }

    this.gridDirty = true;
  }

  private isObstacle(element: MapElement): boolean {
    const type = element.type || "";
    return (
      type === "obstacle" ||
      type === "building" ||
      type === "rock" ||
      type === "tree"
    );
  }

  private precomputeZoneDistances(): void {
    const zones = this.gameState.zones;
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zoneA = zones[i];
        const zoneB = zones[j];
        const distance = calculateZoneDistance(zoneA, zoneB);
        const travelTime = estimateTravelTime(
          distance,
          0,
          SIM_CONSTANTS.BASE_MOVEMENT_SPEED,
          SIM_CONSTANTS.FATIGUE_PENALTY_MULTIPLIER,
        );
        const difficulty: Difficulty =
          assessRouteDifficultyByDistance(distance);

        const zoneDistance: ZoneDistance = {
          fromZone: zoneA.id,
          toZone: zoneB.id,
          distance,
          travelTime,
          difficulty,
        };
        this.zoneDistanceCache.set(`${zoneA.id}->${zoneB.id}`, zoneDistance);
        this.zoneDistanceCache.set(`${zoneB.id}->${zoneA.id}`, {
          ...zoneDistance,
          fromZone: zoneB.id,
          toZone: zoneA.id,
        });
      }
    }
  }

  /** Grace period after arrival before idle wander can start (allows AI to plan next action) */
  private readonly ARRIVAL_GRACE_PERIOD_MS = 2000;

  private maybeStartIdleWander(state: EntityMovementState, now: number): void {
    if (state.isMoving || state.currentActivity !== ActivityType.IDLE) return;

    if (
      state.lastArrivalTime &&
      now - state.lastArrivalTime < this.ARRIVAL_GRACE_PERIOD_MS
    ) {
      return;
    }

    if (
      (state.lastIdleWander || 0) + SIM_CONSTANTS.IDLE_WANDER_COOLDOWN_MS >
      now
    ) {
      return;
    }

    if (Math.random() > SIM_CONSTANTS.IDLE_WANDER_PROBABILITY) return;

    const radius: number =
      SIM_CONSTANTS.IDLE_WANDER_RADIUS_MIN +
      Math.random() *
        (SIM_CONSTANTS.IDLE_WANDER_RADIUS_MAX -
          SIM_CONSTANTS.IDLE_WANDER_RADIUS_MIN);

    const angle = Math.random() * Math.PI * 2;
    const targetX = state.currentPosition.x + Math.cos(angle) * radius;
    const targetY = state.currentPosition.y + Math.sin(angle) * radius;

    this.moveToPoint(state.entityId, targetX, targetY);
    state.lastIdleWander = now;
  }

  private cleanupOldCache(now: number): void {
    for (const [key, cached] of this.pathCache.entries()) {
      if (now - cached.timestamp > this.PATH_CACHE_DURATION) {
        this.pathCache.delete(key);
      }
    }
  }

  public getEntityMovementState(
    entityId: string,
  ): EntityMovementState | undefined {
    return this.movementStates.get(entityId);
  }

  // ==========================================================================
  // ECS INTERFACE METHODS - IMovementSystem
  // ==========================================================================

  /**
   * System name for ECS registration
   */
  public readonly name = "movement";

  /**
   * Request movement to a specific position.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestMove(
    agentId: string,
    target: { x: number; y: number },
  ): { status: "delegated" | "completed" | "failed" | "in_progress"; system: string; message?: string; data?: unknown } {
    const state = this.movementStates.get(agentId);
    
    if (!state) {
      return {
        status: "failed",
        system: "movement",
        message: `No movement state for agent ${agentId}`,
      };
    }

    // Check if already at target
    const dx = state.currentPosition.x - target.x;
    const dy = state.currentPosition.y - target.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq < 4) { // Within 2 units
      return {
        status: "completed",
        system: "movement",
        message: "Already at target",
        data: { position: state.currentPosition },
      };
    }

    // Check if already moving to same target
    if (state.isMoving && state.targetPosition) {
      const targetDx = state.targetPosition.x - target.x;
      const targetDy = state.targetPosition.y - target.y;
      if (targetDx * targetDx + targetDy * targetDy < 4) {
        return {
          status: "in_progress",
          system: "movement",
          message: "Already moving to target",
        };
      }
    }

    const success = this.moveToPoint(agentId, target.x, target.y);
    
    if (success) {
      return {
        status: "delegated",
        system: "movement",
        message: "Movement started",
        data: { target },
      };
    }

    return {
      status: "failed",
      system: "movement",
      message: "Failed to start movement",
    };
  }

  /**
   * Request movement to a zone.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestMoveToZone(
    agentId: string,
    zoneId: string,
  ): { status: "delegated" | "completed" | "failed" | "in_progress"; system: string; message?: string; data?: unknown } {
    const state = this.movementStates.get(agentId);
    
    if (!state) {
      return {
        status: "failed",
        system: "movement",
        message: `No movement state for agent ${agentId}`,
      };
    }

    // Find zone
    const zone = this.gameState.zones?.find(z => z.id === zoneId);
    if (!zone) {
      return {
        status: "failed",
        system: "movement",
        message: `Zone ${zoneId} not found`,
      };
    }

    // Check if already in zone
    const bounds = zone.bounds;
    if (bounds &&
        state.currentPosition.x >= bounds.x &&
        state.currentPosition.x <= bounds.x + bounds.width &&
        state.currentPosition.y >= bounds.y &&
        state.currentPosition.y <= bounds.y + bounds.height) {
      return {
        status: "completed",
        system: "movement",
        message: "Already in zone",
        data: { zoneId },
      };
    }

    // Check if already moving to this zone
    if (state.isMoving && state.targetZone === zoneId) {
      return {
        status: "in_progress",
        system: "movement",
        message: "Already moving to zone",
      };
    }

    const success = this.moveToZone(agentId, zoneId);
    
    if (success) {
      return {
        status: "delegated",
        system: "movement",
        message: "Movement to zone started",
        data: { zoneId },
      };
    }

    return {
      status: "failed",
      system: "movement",
      message: "Failed to start movement to zone",
    };
  }

  /**
   * Request movement to an entity's position.
   * Returns HandlerResult for ECS handler compatibility.
   */
  public requestMoveToEntity(
    agentId: string,
    entityId: string,
  ): { status: "delegated" | "completed" | "failed" | "in_progress"; system: string; message?: string; data?: unknown } {
    const state = this.movementStates.get(agentId);
    
    if (!state) {
      return {
        status: "failed",
        system: "movement",
        message: `No movement state for agent ${agentId}`,
      };
    }

    // Try to find entity position from various sources
    let targetPosition: { x: number; y: number } | undefined;

    // Check agents
    const targetAgent = this.agentRegistry?.getProfile(entityId);
    if (targetAgent?.position) {
      targetPosition = targetAgent.position;
    }

    // Check world resources
    if (!targetPosition && this.gameState.worldResources?.[entityId]) {
      targetPosition = this.gameState.worldResources[entityId].position;
    }

    // Check entities array
    if (!targetPosition) {
      const entity = this.gameState.entities?.find(e => e.id === entityId);
      if (entity?.position) {
        targetPosition = entity.position;
      }
    }

    if (!targetPosition) {
      return {
        status: "failed",
        system: "movement",
        message: `Entity ${entityId} not found or has no position`,
      };
    }

    return this.requestMove(agentId, targetPosition);
  }
}
