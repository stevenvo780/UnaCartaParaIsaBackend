import { GameState } from "@/shared/types/game-types";
import { SocialConfig, SocialGroup } from "@/shared/types/simulation/social";
import { simulationEvents, GameEventType } from "../../core/events";
import { logger } from "../../../../infrastructure/utils/logger";
import { getFrameTime } from "../../../../shared/FrameTime";
import { performance } from "node:perf_hooks";
import { TYPES } from "../../../../config/Types";
import type { StateDirtyTracker } from "../../core/StateDirtyTracker";
import { performanceMonitor } from "../../core/PerformanceMonitor";
import type { EntityIndex } from "../../core/EntityIndex";
import type { SharedSpatialIndex } from "../../core/SharedSpatialIndex";
import type { HandlerResult, ISocialSystem } from "../agents/SystemRegistry";

import { injectable, inject, optional } from "inversify";
import type { GPUComputeService } from "../../core/GPUComputeService";
import { ActionType } from "../../../../shared/constants/AIEnums";
import { DialogueTone } from "../../../../shared/constants/AmbientEnums";
import { GoalType } from "../../../../shared/constants/AIEnums";
import { HandlerResultStatus } from "@/shared/constants/StatusEnums";
import { SystemName } from "@/shared/constants/SystemEnums";
import type { MarriageSystem } from "../social/MarriageSystem";
import type {
  ReputationEntry,
  AgentReputation,
  ReputationChange,
  SerializedReputationData,
  TrustRelationship,
} from "@/shared/types/simulation/reputation";

/**
 * Configuration for reputation system (merged from ReputationSystem)
 */
const REPUTATION_CONFIG = {
  decay: {
    perSecond: 0.003,
    targetValue: 0.5,
  },
  initialValues: {
    reputation: 0.5,
  },
  impacts: {
    socialRelation: {
      reputation: 0.01,
    },
    combat: {
      maxImpact: 0.05,
      damageNormalizer: 200,
    },
    interactionGame: {
      scale: 0.08,
      exploitPenalty: 0.5,
    },
  },
  bounds: {
    min: 0,
    max: 1,
  },
} as const;

/**
 * Unified system for managing social relationships and reputation between agents.
 *
 * Features:
 * - Affinity tracking between agent pairs (-1 to 1 scale)
 * - Reputation scores per agent (0 to 1 scale)
 * - Social group formation based on affinity thresholds
 * - Truce system for conflict resolution
 * - Proximity-based relationship reinforcement
 * - Permanent bonds (family, marriage)
 * - Infamy tracking for reputation effects
 * - Zone heat tracking for conflict areas
 * - Reputation history tracking
 *
 * @see MarriageSystem for marriage relationships
 */
@injectable()
export class SocialSystem implements ISocialSystem {
  public readonly name = "social";
  private gameState: GameState;
  private config: SocialConfig;
  private edges = new Map<string, Map<string, number>>();
  private permanentBonds = new Map<
    string,
    Map<string, "family" | "marriage">
  >();
  private groups: SocialGroup[] = [];

  private sharedSpatialIndex?: SharedSpatialIndex;
  private truces = new Map<string, number>();
  private infamy = new Map<string, number>();
  private zoneHeat = new Map<string, number>();
  private lastUpdate = 0;
  private lastDecayUpdate = 0;

  /** Dirty flag to skip recomputeGroups when no edges changed */
  private edgesModified = false;
  private gpuService?: GPUComputeService;
  private entityIndex?: EntityIndex;

  private reputation = new Map<string, ReputationEntry>();
  private reputationHistory = new Map<string, ReputationChange[]>();
  private readonly MAX_HISTORY_PER_AGENT = 50;
  private reputationStatsCache = {
    agents: 0,
    avgReputation: 0.5,
    lastUpdate: 0,
  };

  /** Marriage system for find_mate interactions */
  private marriageSystem?: MarriageSystem;

  /** Affinity threshold required to propose marriage */
  private static readonly MARRIAGE_AFFINITY_THRESHOLD = 0.4;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.StateDirtyTracker)
    @optional()
    private dirtyTracker?: StateDirtyTracker,
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
    @inject(TYPES.SharedSpatialIndex)
    @optional()
    sharedSpatialIndex?: SharedSpatialIndex,
    @inject(TYPES.MarriageSystem)
    @optional()
    marriageSystem?: MarriageSystem,
  ) {
    this.gameState = gameState;
    this.gpuService = gpuService;
    this.entityIndex = entityIndex;
    this.sharedSpatialIndex = sharedSpatialIndex;
    this.marriageSystem = marriageSystem;
    this.config = {
      proximityRadius: 100,
      reinforcementPerSecond: 0.05,
      decayPerSecond: 0.01,
      groupThreshold: 0.6,
    };

    this.setupMarriageListeners();
  }

  private setupMarriageListeners(): void {
    simulationEvents.on(
      GameEventType.MARRIAGE_ACCEPTED,
      (data: {
        proposerId: string;
        targetId: string;
        groupId: string;
        timestamp: number;
      }) => {
        this.registerPermanentBond(data.proposerId, data.targetId, "marriage");
      },
    );

    simulationEvents.on(
      GameEventType.DIVORCE_COMPLETED,
      (data: {
        agentId: string;
        groupId: string;
        reason: string;
        remainingMembers: string[];
        timestamp: number;
      }) => {
        for (const memberId of data.remainingMembers) {
          if (memberId !== data.agentId) {
            this.modifyAffinity(data.agentId, memberId, -0.3);
          }
        }
      },
    );
  }

  public getGroupForAgent(agentId: string): SocialGroup | undefined {
    return this.groups.find((group) => group.members.includes(agentId));
  }

  private lastGraphSync = 0;

  public async update(deltaTimeMs: number): Promise<void> {
    const startTime = performance.now();
    const dt = deltaTimeMs / 1000;
    this.lastUpdate += deltaTimeMs;
    const now = getFrameTime();

    const agentCount =
      this.gameState.agents?.filter((a) => !a.isDead).length ?? 0;
    const edgeCount = this.edges.size;
    const groupCount = this.groups.length;

    if (Math.floor(now / 5000) !== Math.floor((now - deltaTimeMs) / 5000)) {
      logger.debug(
        `👥 [SocialSystem] update: agents=${agentCount}, edges=${edgeCount}, groups=${groupCount}, edgesModified=${this.edgesModified}, reputations=${this.reputation.size}`,
      );
    }

    this.updateSpatialGridIncremental();

    await this.updateProximity(dt);

    if (now - this.lastDecayUpdate > 2000) {
      await this.decayEdgesOptimized(dt);
      this.updateReputationDecay(dt);
      this.lastDecayUpdate = now;
    }

    if (this.lastUpdate > 1000 && this.edgesModified) {
      this.recomputeGroups();
      this.edgesModified = false;
      this.lastUpdate = 0;
    } else if (this.lastUpdate > 1000) {
      this.lastUpdate = 0;
    }

    this.updateTruces(now);

    if (now - this.lastGraphSync > 200) {
      if (!this.gameState.socialGraph) {
        this.gameState.socialGraph = {
          groups: this.groups,
          relationships: this.serializeRelationships(),
        };
      } else {
        this.gameState.socialGraph.groups = this.groups;
        this.gameState.socialGraph.relationships =
          this.serializeRelationships();
      }
      this.syncReputationToGameState();
      this.dirtyTracker?.markDirty("socialGraph");
      this.lastGraphSync = now;
    }

    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "SocialSystem",
      "update",
      duration,
    );
    performanceMonitor.recordOperation("social_update", duration, 1, 0);
  }

  /**
   * NOTE: Spatial indexing now handled by SharedSpatialIndex.
   * This method is kept for backwards compatibility but is a no-op.
   * The SharedSpatialIndex is rebuilt by SimulationRunner each tick.
   */
  private updateSpatialGridIncremental(): void {}

  /**
   * Optimized edge decay that only processes edges with significant non-zero values.
   * Uses GPU for batch decay when available and edge count is high.
   *
   * @param dt - Delta time in seconds
   */
  private async decayEdgesOptimized(dt: number): Promise<void> {
    const decayAmount = this.config.decayPerSecond * dt;
    const bondDecayAmount = decayAmount * 0.05;
    const minAffinity = 0.001;

    let totalEdges = 0;
    for (const neighbors of this.edges.values()) {
      totalEdges += neighbors.size;
    }

    if (this.gpuService?.isGPUAvailable() && totalEdges > 200) {
      await this.decayEdgesGPU(dt, minAffinity);
      return;
    }

    for (const [aId, neighbors] of this.edges) {
      for (const [bId, affinity] of neighbors) {
        if (Math.abs(affinity) < minAffinity) {
          if (affinity !== 0) neighbors.set(bId, 0);
          continue;
        }

        const bondType =
          this.permanentBonds.get(aId)?.get(bId) ||
          this.permanentBonds.get(bId)?.get(aId);

        const decay = bondType ? bondDecayAmount : decayAmount;

        let newAffinity: number;
        if (affinity > 0) {
          newAffinity = Math.max(0, affinity - decay);
        } else {
          newAffinity = Math.min(0, affinity + decay);
        }

        neighbors.set(bId, newAffinity);
      }
    }
  }

  /**
   * GPU-accelerated edge decay for large social networks
   */
  private async decayEdgesGPU(dt: number, minAffinity: number): Promise<void> {
    const edgeList: Array<{
      aId: string;
      bId: string;
      affinity: number;
      hasBond: boolean;
    }> = [];

    for (const [aId, neighbors] of this.edges) {
      for (const [bId, affinity] of neighbors) {
        if (aId < bId) {
          const hasBond = !!(
            this.permanentBonds.get(aId)?.get(bId) ||
            this.permanentBonds.get(bId)?.get(aId)
          );
          edgeList.push({ aId, bId, affinity, hasBond });
        }
      }
    }

    if (edgeList.length === 0) return;

    const nonBondedAffinities = new Float32Array(
      edgeList.filter((e) => !e.hasBond).map((e) => e.affinity),
    );
    const bondedAffinities = new Float32Array(
      edgeList.filter((e) => e.hasBond).map((e) => e.affinity),
    );

    let newNonBonded: Float32Array | null = null;
    let newBonded: Float32Array | null = null;

    if (nonBondedAffinities.length > 0) {
      newNonBonded = await this.gpuService!.decayAffinitiesBatch(
        nonBondedAffinities,
        this.config.decayPerSecond,
        dt,
        minAffinity,
      );
    }
    if (bondedAffinities.length > 0) {
      newBonded = await this.gpuService!.decayAffinitiesBatch(
        bondedAffinities,
        this.config.decayPerSecond * 0.05,
        dt,
        minAffinity,
      );
    }

    let nonBondedIdx = 0;
    let bondedIdx = 0;

    for (const edge of edgeList) {
      const newAffinity = edge.hasBond
        ? newBonded
          ? newBonded[bondedIdx++]
          : edge.affinity
        : newNonBonded
          ? newNonBonded[nonBondedIdx++]
          : edge.affinity;

      this.edges.get(edge.aId)?.set(edge.bId, newAffinity);
      this.edges.get(edge.bId)?.set(edge.aId, newAffinity);
    }
  }

  /**
   * Updates proximity-based social reinforcement.
   * Uses GPU pairwise distance calculation when entity count is high.
   * Staggered to process only a subset of agents per frame to avoid spikes.
   */
  private async updateProximity(dt: number): Promise<void> {
    const entities = this.gameState.entities || [];
    const reinforcement = this.config.reinforcementPerSecond * dt;
    const entitiesWithPos = entities.filter(
      (e): e is typeof e & { position: { x: number; y: number } } =>
        !!e.position && !e.isDead,
    );

    if (this.gpuService?.isGPUAvailable() && entitiesWithPos.length >= 20) {
      await this.updateProximityGPU(entitiesWithPos, reinforcement);
      return;
    }

    const totalAgents = entitiesWithPos.length;
    if (totalAgents === 0) return;

    const batchSize = Math.max(1, Math.ceil(totalAgents / 10));

    if (this.proximityUpdateIndex >= totalAgents) {
      this.proximityUpdateIndex = 0;
    }

    const endIndex = Math.min(
      this.proximityUpdateIndex + batchSize,
      totalAgents,
    );

    for (let i = this.proximityUpdateIndex; i < endIndex; i++) {
      const entity = entitiesWithPos[i];
      const nearby = this.sharedSpatialIndex?.queryRadius(
        entity.position,
        this.config.proximityRadius,
      );

      if (nearby) {
        for (const { entity: otherId } of nearby) {
          if (entity.id >= otherId) continue;
          this.addEdge(entity.id, otherId, reinforcement);
        }
        this.sharedSpatialIndex?.releaseResults(nearby);
      }
    }

    this.proximityUpdateIndex = endIndex;
    if (this.proximityUpdateIndex >= totalAgents) {
      this.proximityUpdateIndex = 0;
    }
  }

  private proximityUpdateIndex = 0;

  private proximityPositionsBuffer: Float32Array | null = null;

  /**
   * GPU-accelerated proximity detection using pairwise distance matrix.
   * Computes all N×N distances in parallel on GPU.
   */
  private async updateProximityGPU(
    entities: Array<{ id: string; position: { x: number; y: number } }>,
    reinforcement: number,
  ): Promise<void> {
    const count = entities.length;

    if (
      !this.proximityPositionsBuffer ||
      this.proximityPositionsBuffer.length < count * 2
    ) {
      this.proximityPositionsBuffer = new Float32Array(
        Math.ceil(count * 2 * 1.5),
      );
    }

    for (let i = 0; i < count; i++) {
      this.proximityPositionsBuffer[i * 2] = entities[i].position.x;
      this.proximityPositionsBuffer[i * 2 + 1] = entities[i].position.y;
    }

    const positionsView = this.proximityPositionsBuffer.subarray(0, count * 2);

    const { distances } = await this.gpuService!.computePairwiseDistances(
      positionsView,
      count,
    );

    const proximityRadiusSq =
      this.config.proximityRadius * this.config.proximityRadius;

    let idx = 0;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (distances[idx] <= proximityRadiusSq) {
          this.addEdge(entities[i].id, entities[j].id, reinforcement);
        }
        idx++;
      }
    }
  }

  public addEdge(a: string, b: string, delta: number): void {
    if (a === b) return;
    if (!this.edges.has(a)) this.edges.set(a, new Map());
    if (!this.edges.has(b)) this.edges.set(b, new Map());

    const currentA = this.edges.get(a)!.get(b) || 0;
    const newAffinityA = Math.max(-1, Math.min(1, currentA + delta));
    this.edges.get(a)!.set(b, newAffinityA);

    const currentB = this.edges.get(b)!.get(a) || 0;
    const newAffinityB = Math.max(-1, Math.min(1, currentB + delta));
    this.edges.get(b)!.set(a, newAffinityB);

    if (
      Math.abs(newAffinityA - currentA) > 0.01 ||
      Math.abs(newAffinityB - currentB) > 0.01
    ) {
      this.edgesModified = true;
      simulationEvents.emit(GameEventType.SOCIAL_RELATION_CHANGED, {
        agentA: a,
        agentB: b,
        oldAffinity: currentA,
        newAffinity: newAffinityA,
        timestamp: Date.now(),
      });
    }
  }

  public getAffinityBetween(a: string, b: string): number {
    if (a === b) return 1;
    return this.edges.get(a)?.get(b) ?? 0;
  }

  public imposeTruce(aId: string, bId: string, durationMs: number): void {
    const key = this.pairKey(aId, bId);
    this.truces.set(key, Date.now() + durationMs);

    const current = this.getAffinityBetween(aId, bId);
    if (current < 0) {
      this.addEdge(aId, bId, Math.abs(current) * 0.5);
    }

    logger.debug(
      `🤝 [SOCIAL] Truce imposed: ${aId} <-> ${bId} for ${durationMs}ms`,
    );

    simulationEvents.emit(GameEventType.SOCIAL_TRUCE_IMPOSED, {
      aId,
      bId,
      durationMs,
    });
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
  }

  private updateTruces(now: number): void {
    for (const [key, expiresAt] of this.truces.entries()) {
      if (now >= expiresAt) {
        this.truces.delete(key);
        const [a, b] = key.split("::");
        simulationEvents.emit(GameEventType.SOCIAL_TRUCE_EXPIRED, {
          aId: a,
          bId: b,
        });
      }
    }
  }

  public isTruceActive(aId: string, bId: string): boolean {
    const key = this.pairKey(aId, bId);
    const expiresAt = this.truces.get(key);
    return !!expiresAt && expiresAt > Date.now();
  }

  public setAffinity(aId: string, bId: string, value: number): void {
    if (!this.edges.has(aId)) this.edges.set(aId, new Map());
    if (!this.edges.has(bId)) this.edges.set(bId, new Map());
    this.edges.get(aId)!.set(bId, Math.max(-1, Math.min(1, value)));
    this.edges.get(bId)!.set(aId, Math.max(-1, Math.min(1, value)));
  }

  public modifyAffinity(aId: string, bId: string, delta: number): void {
    this.addEdge(aId, bId, delta);
  }

  public removeRelationships(agentId: string): void {
    this.edges.delete(agentId);
    this.edges.forEach((neighbors) => {
      neighbors.delete(agentId);
    });
    this.permanentBonds.delete(agentId);
    this.permanentBonds.forEach((bonds) => bonds.delete(agentId));

    for (const key of this.truces.keys()) {
      if (key.includes(agentId)) {
        this.truces.delete(key);
      }
    }
  }

  public registerFriendlyInteraction(aId: string, bId: string): void {
    this.addEdge(aId, bId, 0.15);
    simulationEvents.emit(GameEventType.SOCIAL_INTERACTION, {
      agentA: aId,
      agentB: bId,
      type: DialogueTone.FRIENDLY,
      timestamp: Date.now(),
    });
  }

  public imposeLocalTruces(
    centerAgentId: string,
    radius: number,
    durationMs: number,
  ): void {
    const entities = this.gameState.entities;
    if (!entities) return;

    const centerEntity = this.entityIndex?.getEntity(centerAgentId);
    if (!centerEntity?.position) return;

    const nearby = this.sharedSpatialIndex?.queryRadius(
      centerEntity.position,
      radius,
    );
    if (!nearby) return;

    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        this.imposeTruce(nearby[i].entity, nearby[j].entity, durationMs);
      }
    }

    this.sharedSpatialIndex?.releaseResults(nearby);
  }

  public registerPermanentBond(
    aId: string,
    bId: string,
    type: "family" | "marriage",
  ): void {
    if (!this.permanentBonds.has(aId)) this.permanentBonds.set(aId, new Map());
    if (!this.permanentBonds.has(bId)) this.permanentBonds.set(bId, new Map());

    this.permanentBonds.get(aId)!.set(bId, type);
    this.permanentBonds.get(bId)!.set(aId, type);

    const current = this.getAffinityBetween(aId, bId);
    if (current < 0.5) {
      this.addEdge(aId, bId, 0.5 - current);
    }

    logger.debug(
      `💕 [SOCIAL] Permanent bond: ${type} between ${aId} and ${bId}`,
    );

    simulationEvents.emit(GameEventType.FRIENDSHIP_FORMED, {
      agentA: aId,
      agentB: bId,
      bondType: type,
      timestamp: Date.now(),
    });
  }

  public addInfamy(agentId: string, amount: number): void {
    const current = this.infamy.get(agentId) || 0;
    this.infamy.set(agentId, current + amount);
  }

  public getInfamy(agentId: string): number {
    return this.infamy.get(agentId) || 0;
  }

  public addHeatAt(pos: { x: number; y: number }, amount: number): void {
    const zone = this.gameState.zones?.find(
      (z) =>
        pos.x >= z.bounds.x &&
        pos.x <= z.bounds.x + z.bounds.width &&
        pos.y >= z.bounds.y &&
        pos.y <= z.bounds.y + z.bounds.height,
    );

    if (zone) {
      const current = this.zoneHeat.get(zone.id) || 0;
      this.zoneHeat.set(zone.id, Math.min(10000, current + amount));
    }
  }

  public getZoneHeat(zoneId: string): number {
    return this.zoneHeat.get(zoneId) || 0;
  }

  private recomputeGroups(): void {
    const startTime = performance.now();
    const visited = new Set<string>();
    const newGroups: SocialGroup[] = [];
    const entities = this.gameState.entities?.map((e) => e.id) || [];

    for (const u of entities) {
      if (visited.has(u)) continue;

      const groupMembers: string[] = [];
      const queue = [u];
      visited.add(u);

      while (queue.length > 0) {
        const current = queue.shift()!;
        groupMembers.push(current);

        const neighbors = this.edges.get(current);
        if (neighbors) {
          for (const [v, affinity] of neighbors.entries()) {
            if (affinity >= this.config.groupThreshold && !visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          }
        }
      }

      if (groupMembers.length > 1) {
        let totalAffinity = 0;
        let edgeCount = 0;
        let bestLeader = { id: groupMembers[0], score: -Infinity };

        for (const member of groupMembers) {
          let leadershipScore = 0;
          const memberEdges = this.edges.get(member);

          if (memberEdges) {
            for (const other of groupMembers) {
              if (member === other) continue;
              const aff = memberEdges.get(other) || 0;
              if (aff > 0) {
                totalAffinity += aff;
                edgeCount++;
                leadershipScore += aff;
              }
            }
          }

          if (leadershipScore > bestLeader.score) {
            bestLeader = { id: member, score: leadershipScore };
          }
        }

        const cohesion = edgeCount > 0 ? totalAffinity / edgeCount : 0;

        newGroups.push({
          id: `group_${groupMembers[0]}`,
          members: groupMembers,
          leader: bestLeader.id,
          cohesion,
          morale: 100,
        });

        if (cohesion > 0.7 && groupMembers.length >= 3) {
          simulationEvents.emit(GameEventType.SOCIAL_RALLY, {
            groupId: `group_${groupMembers[0]}`,
            leaderId: bestLeader.id,
            members: groupMembers,
            cohesion,
            timestamp: Date.now(),
          });
        }
      }
    }

    this.groups = newGroups;

    simulationEvents.emit(GameEventType.SOCIAL_GROUPS_UPDATE, {
      groups: this.groups,
      count: this.groups.length,
    });
    const duration = performance.now() - startTime;
    performanceMonitor.recordSubsystemExecution(
      "SocialSystem",
      "recomputeGroups",
      duration,
    );
  }

  public getGroups(): SocialGroup[] {
    return this.groups;
  }

  public getSocialConnections(agentId: string): Record<string, number> {
    const connections: Record<string, number> = {};
    const neighbors = this.edges.get(agentId);
    if (neighbors) {
      for (const [otherId, affinity] of neighbors.entries()) {
        connections[otherId] = affinity;
      }
    }
    return connections;
  }

  public getFriends(agentId: string): string[] {
    const neighbors = this.edges.get(agentId);
    if (!neighbors) return [];
    const friends: string[] = [];
    for (const [otherId, affinity] of neighbors.entries()) {
      if (affinity > 0.5) {
        friends.push(otherId);
      }
    }
    return friends;
  }

  public getGraphSnapshot(): {
    groups: SocialGroup[];
    relationships: Record<string, Record<string, number>>;
  } {
    return {
      groups: this.groups,
      relationships: this.serializeRelationships(),
    };
  }

  public addSocialMemory(
    _agentId: string,
    _memory: {
      type: string;
      targetId?: string;
      timestamp: number;
      [key: string]: unknown;
    },
  ): void {}
  private serializeRelationships(): Record<string, Record<string, number>> {
    const serialized: Record<string, Record<string, number>> = {};
    for (const [agentId, neighbors] of this.edges.entries()) {
      serialized[agentId] = {};
      for (const [targetId, affinity] of neighbors.entries()) {
        serialized[agentId][targetId] = affinity;
      }
    }
    return serialized;
  }

  /**
   * Solicita una interacción social entre dos agentes.
   * @param agentId - ID del agente que inicia la interacción
   * @param targetId - ID del agente objetivo
   * @param type - Tipo de interacción (friendly, hostile, etc.)
   */
  public requestInteraction(
    agentId: string,
    targetId: string,
    type: string,
  ): HandlerResult {
    const agents = this.gameState.agents;
    const agent = agents.find((a) => a.id === agentId);
    const target = agents.find((a) => a.id === targetId);

    if (!agent || !target) {
      return {
        status: HandlerResultStatus.FAILED,
        system: SystemName.SOCIAL,
        message: `Agent or target not found: ${agentId}, ${targetId}`,
      };
    }

    if (this.isTruceActive(agentId, targetId)) {
      return {
        status: HandlerResultStatus.FAILED,
        system: SystemName.SOCIAL,
        message: "Truce active between agents",
      };
    }

    switch (type) {
      case DialogueTone.FRIENDLY:
      case ActionType.SOCIALIZE:
        this.registerFriendlyInteraction(agentId, targetId);
        return {
          status: HandlerResultStatus.COMPLETED,
          system: SystemName.SOCIAL,
          message: "Friendly interaction registered",
          data: { affinityChange: 0.1 },
        };

      case "find_mate": {
        this.registerFriendlyInteraction(agentId, targetId);
        const affinity = this.getAffinityBetween(agentId, targetId);

        logger.info(
          `💕 [SocialSystem] find_mate: ${agentId} -> ${targetId}, affinity=${affinity.toFixed(2)}, threshold=${SocialSystem.MARRIAGE_AFFINITY_THRESHOLD}`,
        );

        if (
          affinity >= SocialSystem.MARRIAGE_AFFINITY_THRESHOLD &&
          this.marriageSystem
        ) {
          const proposalSuccess = this.marriageSystem.proposeMarriage(
            agentId,
            targetId,
          );
          logger.info(
            `💍 [SocialSystem] Marriage proposal: ${agentId} -> ${targetId}, success=${proposalSuccess}`,
          );
          return {
            status: proposalSuccess
              ? HandlerResultStatus.COMPLETED
              : HandlerResultStatus.FAILED,
            system: SystemName.SOCIAL,
            message: proposalSuccess
              ? "Marriage proposal registered"
              : "Marriage proposal failed",
            data: { affinity, proposalSuccess },
          };
        }

        return {
          status: HandlerResultStatus.COMPLETED,
          system: SystemName.SOCIAL,
          message: `Courtship interaction, affinity now ${affinity.toFixed(2)}`,
          data: { affinityChange: 0.1, currentAffinity: affinity },
        };
      }

      case "hostile":
        this.addEdge(agentId, targetId, -0.2);
        this.addInfamy(agentId, 0.1);
        return {
          status: HandlerResultStatus.COMPLETED,
          system: SystemName.SOCIAL,
          message: "Hostile interaction registered",
          data: { affinityChange: -0.2 },
        };

      case GoalType.ASSIST:
        this.addEdge(agentId, targetId, 0.15);
        return {
          status: HandlerResultStatus.COMPLETED,
          system: SystemName.SOCIAL,
          message: "Assistance registered",
          data: { affinityChange: 0.15 },
        };

      default:
        this.addEdge(agentId, targetId, 0.05);
        return {
          status: HandlerResultStatus.COMPLETED,
          system: SystemName.SOCIAL,
          message: `Interaction type '${type}' processed`,
          data: { affinityChange: 0.05 },
        };
    }
  }

  /**
   * Obtiene la relación (afinidad) entre dos agentes.
   * @param agentId - ID del primer agente
   * @param targetId - ID del segundo agente
   * @returns Valor de afinidad entre -1 y 1, o 0 si no hay relación
   */
  public getRelationship(agentId: string, targetId: string): number {
    return this.getAffinityBetween(agentId, targetId);
  }

  public syncToGameState(): void {
    if (!this.gameState.socialGraph) {
      this.gameState.socialGraph = {
        groups: [],
        relationships: {},
      };
    }

    this.gameState.socialGraph.groups = this.groups;

    const relationships: Record<string, Record<string, number>> = {};
    for (const [source, targets] of this.edges.entries()) {
      relationships[source] = {};
      for (const [target, weight] of targets.entries()) {
        relationships[source][target] = weight;
      }
    }
    this.gameState.socialGraph.relationships = relationships;
  }

  /**
   * Updates the reputation of an agent.
   * @param agentId - The ID of the agent
   * @param delta - The change in reputation (-1 to 1 recommended)
   * @param reason - Optional reason for the change
   */
  public updateReputation(
    agentId: string,
    delta: number,
    reason?: string,
  ): void {
    const now = Date.now();
    const r = this.reputation.get(agentId) || {
      value: REPUTATION_CONFIG.initialValues.reputation,
      lastUpdated: now,
    };
    const oldValue = r.value;
    r.value = Math.max(
      REPUTATION_CONFIG.bounds.min,
      Math.min(REPUTATION_CONFIG.bounds.max, r.value + delta),
    );
    r.lastUpdated = now;
    this.reputation.set(agentId, r);

    if (delta !== 0) {
      const change: ReputationChange = {
        timestamp: now,
        agentId,
        oldValue,
        newValue: r.value,
        delta,
        reason: reason || "unknown",
      };

      const history = this.reputationHistory.get(agentId) || [];
      history.push(change);
      if (history.length > this.MAX_HISTORY_PER_AGENT) {
        history.shift();
      }
      this.reputationHistory.set(agentId, history);

      simulationEvents.emit(GameEventType.REPUTATION_UPDATED, {
        agentId,
        oldValue,
        newValue: r.value,
        delta,
        reason: reason || "unknown",
        timestamp: now,
      });

      if (Math.abs(delta) >= 0.05) {
        logger.debug(
          `⭐ [REPUTATION] ${agentId}: ${oldValue.toFixed(2)} -> ${r.value.toFixed(2)} (${delta > 0 ? "+" : ""}${delta.toFixed(2)}) - ${reason || "unknown"}`,
        );
      }
    }
  }

  /**
   * Gets the reputation of an agent (0 to 1 scale).
   * @param agentId - The ID of the agent
   * @returns Reputation value between 0 and 1
   */
  public getReputation(agentId: string): number {
    return (
      this.reputation.get(agentId)?.value ??
      REPUTATION_CONFIG.initialValues.reputation
    );
  }

  /**
   * Gets all agent reputations sorted by rank.
   */
  public getAllReputations(): AgentReputation[] {
    const allReps = Array.from(this.reputation.entries())
      .map(([agentId, entry]) => ({
        agentId,
        agentName: agentId,
        reputation: entry.value,
        lastUpdated: entry.lastUpdated,
        rank: 0,
      }))
      .sort((a, b) => b.reputation - a.reputation);

    allReps.forEach((rep, index) => {
      rep.rank = index + 1;
    });

    return allReps;
  }

  /**
   * Gets the reputation history for an agent.
   * @param agentId - The ID of the agent
   * @param limit - Maximum number of entries to return
   */
  public getReputationHistory(agentId: string, limit = 20): ReputationChange[] {
    const history = this.reputationHistory.get(agentId) || [];
    return history.slice(-limit).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets top reputations.
   * @param limit - Maximum number of entries to return
   */
  public getTopReputations(limit = 10): AgentReputation[] {
    return this.getAllReputations().slice(0, limit);
  }

  /**
   * Gets trust network for an agent (affinity converted to trust 0-1 scale).
   * @param agentId - The ID of the agent
   */
  public getTrustNetwork(agentId: string): TrustRelationship[] {
    const neighbors = this.edges.get(agentId);
    if (!neighbors) return [];
    return Array.from(neighbors.entries()).map(([targetId, affinity]) => ({
      sourceId: agentId,
      targetId,
      trust: (affinity + 1) / 2, // Convert affinity (-1..1) to trust (0..1)
      lastUpdated: Date.now(),
    }));
  }

  /**
   * Gets reputation system stats.
   */
  public getReputationStats(): {
    agents: number;
    avgReputation: number;
    trustEdges: number;
  } {
    let totalRep = 0;
    let repCount = 0;
    this.reputation.forEach((r) => {
      totalRep += r.value;
      repCount++;
    });

    let trustEdges = 0;
    this.edges.forEach((row) => (trustEdges += row.size));

    return {
      agents: repCount,
      avgReputation:
        repCount > 0
          ? totalRep / repCount
          : REPUTATION_CONFIG.initialValues.reputation,
      trustEdges,
    };
  }

  /**
   * Updates reputation decay over time.
   * Called internally during update cycle.
   */
  private updateReputationDecay(dt: number): void {
    const decay = REPUTATION_CONFIG.decay.perSecond * dt;
    const now = Date.now();

    let totalRep = 0;
    let repCount = 0;

    this.reputation.forEach((r) => {
      r.value += (REPUTATION_CONFIG.decay.targetValue - r.value) * decay;
      r.lastUpdated = now;
      totalRep += r.value;
      repCount++;
    });

    this.reputationStatsCache.agents = repCount;
    this.reputationStatsCache.avgReputation =
      repCount > 0
        ? totalRep / repCount
        : REPUTATION_CONFIG.initialValues.reputation;
    this.reputationStatsCache.lastUpdate = now;
  }

  /**
   * Serializes reputation data for persistence.
   */
  public serializeReputationData(): SerializedReputationData {
    const trustArray: SerializedReputationData["trust"] = [];
    for (const [sourceId, targets] of this.edges.entries()) {
      const arr: Array<{
        targetId: string;
        value: number;
        lastUpdated: number;
      }> = [];
      for (const [targetId, affinity] of targets.entries()) {
        arr.push({
          targetId,
          value: (affinity + 1) / 2, // affinity to trust conversion
          lastUpdated: Date.now(),
        });
      }
      trustArray.push({ sourceId, targets: arr });
    }

    const reputationArray = Array.from(this.reputation.entries()).map(
      ([agentId, entry]) => ({
        agentId,
        value: entry.value,
        lastUpdated: entry.lastUpdated,
      }),
    );

    const historyArray = Array.from(this.reputationHistory.entries()).map(
      ([agentId, changes]) => ({
        agentId,
        changes: [...changes],
      }),
    );

    return {
      trust: trustArray,
      reputation: reputationArray,
      reputationHistory: historyArray,
    };
  }

  /**
   * Deserializes reputation data from persistence.
   */
  public deserializeReputationData(data: SerializedReputationData): void {
    for (const source of data.trust) {
      for (const target of source.targets) {
        const affinity = target.value * 2 - 1;
        this.setAffinity(source.sourceId, target.targetId, affinity);
      }
    }

    this.reputation.clear();
    for (const rep of data.reputation) {
      this.reputation.set(rep.agentId, {
        value: rep.value,
        lastUpdated: rep.lastUpdated,
      });
    }

    this.reputationHistory.clear();
    for (const history of data.reputationHistory) {
      this.reputationHistory.set(history.agentId, history.changes);
    }
  }

  /**
   * Removes all reputation and relationship data for an agent.
   */
  public removeAgentData(agentId: string): void {
    this.reputation.delete(agentId);
    this.reputationHistory.delete(agentId);
    this.removeRelationships(agentId);
  }

  /**
   * Syncs reputation data to game state.
   * Called during update cycle.
   */
  private syncReputationToGameState(): void {
    if (!this.gameState.reputation) {
      this.gameState.reputation = {
        data: {
          trust: [],
          reputation: [],
          reputationHistory: [],
        },
        stats: {
          agents: 0,
          avgReputation: 0.5,
          trustEdges: 0,
        },
      };
    }

    this.gameState.reputation.data = this.serializeReputationData();
    this.gameState.reputation.stats = this.getReputationStats();
    this.gameState.reputation.reputations = this.getAllReputations();

    const trustArray = Array.from(this.edges.entries()).map(
      ([sourceId, targets]) => ({
        sourceId,
        targets: Array.from(targets.entries()).map(([targetId, affinity]) => ({
          sourceId,
          targetId,
          trust: (affinity + 1) / 2,
        })),
      }),
    );
    this.gameState.reputation.trust = trustArray;
  }

  /**
   * Cleans up all reputation data.
   */
  public cleanupReputation(): void {
    this.reputation.clear();
    this.reputationHistory.clear();
  }
}
