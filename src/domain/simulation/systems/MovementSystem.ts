import { EventEmitter } from "events";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";
import EasyStar from "easystarjs";
import { GameState, MapElement } from "../../types/game-types";
import { logger } from "../../../infrastructure/utils/logger";
import { GameEventType, simulationEvents } from "../core/events";
import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { EntityIndex } from "../core/EntityIndex";
import type { GPUComputeService } from "../core/GPUComputeService";
import type { StateDirtyTracker } from "../core/StateDirtyTracker";
import type { AgentRegistry } from "../core/AgentRegistry";
import { getFrameTime } from "../../../shared/FrameTime";
import { WORLD_CONFIG } from "../../../shared/constants/WorldConfig";
import {
  estimateTravelTime,
  assessRouteDifficultyByDistance,
  calculateZoneDistance,
  worldToGrid,
  findAccessibleDestination,
  Difficulty,
} from "./movement/helpers";
import { MovementBatchProcessor } from "./MovementBatchProcessor";
import { ActivityType } from "../../../shared/constants/MovementEnums";
import { ActionType } from "../../../shared/constants/AIEnums";
import { SIM_CONSTANTS } from "../core/SimulationConstants";
import { TerrainSystem } from "./TerrainSystem";

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
export class MovementSystem extends EventEmitter {
  private gameState: GameState;
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
  private agentRegistry?: AgentRegistry;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.EntityIndex) @optional() _entityIndex?: EntityIndex,
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
    @inject(TYPES.AgentRegistry)
    @optional()
    agentRegistry?: AgentRegistry,
    @inject(TYPES.StateDirtyTracker)
    @optional()
    _dirtyTracker?: StateDirtyTracker,
    @inject(TYPES.TerrainSystem) @optional() _terrainSystem?: TerrainSystem,
  ) {
    super();
    this.gameState = gameState;
    this.agentRegistry = agentRegistry;

    this.pathfinder = new EasyStar.js();
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
    this.batchProcessor = new MovementBatchProcessor(gpuService);
    if (gpuService?.isGPUAvailable()) {
      logger.info(
        "🚶 MovementSystem: GPU acceleration enabled for batch processing",
      );
    }

    if (this.agentRegistry) {
      this.agentRegistry.registerMovement(
        this.movementStates as Map<
          string,
          import("../core/AgentRegistry").MovementState
        >,
      );
    }

    logger.info("🚶 MovementSystem initialized", {
      gridSize: `${this.gridWidth}x${this.gridHeight}`,
      zones: this.gameState.zones.length,
    });
  }

  public update(deltaMs: number): void {
    const now = getFrameTime();

    this.processPathfindingQueue();

    let movingCount = 0;
    for (const state of this.movementStates.values()) {
      if (state.isMoving) movingCount++;
    }

    if (movingCount >= this.BATCH_THRESHOLD) {
      this.updateBatch(deltaMs, now);
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

  private updateBatch(deltaMs: number, now: number): void {
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
      this.batchProcessor.updatePositionsBatch(deltaMs);

    this.batchProcessor.updateFatigueBatch(
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

  public moveToZone(entityId: string, targetZoneId: string): boolean {
    const state = this.movementStates.get(entityId);
    const targetZone = this.gameState.zones.find((z) => z.id === targetZoneId);

    if (!state || !targetZone) return false;
    if (state.isPathfinding) return false;

    state.isPathfinding = true;

    const targetX = targetZone.bounds.x + targetZone.bounds.width / 2;
    const targetY = targetZone.bounds.y + targetZone.bounds.height / 2;

    this.enqueuePathfinding(
      entityId,
      state.currentPosition,
      { x: targetX, y: targetY },
      (pathResult) => {
        state.isPathfinding = false;
        if (!pathResult.success || pathResult.path.length === 0) {
          logger.warn(
            `Pathfinding failed for ${entityId} to zone ${targetZoneId}`,
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
}
