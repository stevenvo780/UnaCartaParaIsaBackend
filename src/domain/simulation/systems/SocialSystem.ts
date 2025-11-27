import { GameState } from "../../types/game-types";
import { SocialConfig } from "../../types/simulation/social";
import { SocialGroup } from "../../../shared/types/simulation/agents";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "../../../infrastructure/utils/logger";
import { getFrameTime } from "../../../shared/FrameTime";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../core/PerformanceMonitor";
import type { EntityIndex } from "../core/EntityIndex";
import type { SharedSpatialIndex } from "../core/SharedSpatialIndex";

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { GPUComputeService } from "../core/GPUComputeService";

/**
 * System for managing social relationships between agents.
 *
 * Features:
 * - Affinity tracking between agent pairs
 * - Social group formation based on affinity thresholds
 * - Truce system for conflict resolution
 * - Proximity-based relationship reinforcement
 * - Permanent bonds (family, marriage)
 * - Infamy tracking for reputation effects
 * - Zone heat tracking for conflict areas
 *
 * @see MarriageSystem for marriage relationships
 * @see ReputationSystem for reputation effects
 */
@injectable()
export class SocialSystem {
  private gameState: GameState;
  private config: SocialConfig;
  private edges = new Map<string, Map<string, number>>();
  private permanentBonds = new Map<
    string,
    Map<string, "family" | "marriage">
  >();
  private groups: SocialGroup[] = [];
  // NOTE: Using SharedSpatialIndex instead of own SpatialGrid to avoid duplication
  private sharedSpatialIndex?: SharedSpatialIndex;
  private truces = new Map<string, number>();
  private infamy = new Map<string, number>();
  private zoneHeat = new Map<string, number>();
  private lastUpdate = 0;
  private lastProximityUpdate = 0;
  private lastDecayUpdate = 0;

  // NOTE: Removed knownEntities, positionCache - now handled by SharedSpatialIndex
  /** Dirty flag to skip recomputeGroups when no edges changed */
  private edgesModified = false;
  private gpuService?: GPUComputeService;
  private entityIndex?: EntityIndex;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
    @inject(TYPES.EntityIndex) @optional() entityIndex?: EntityIndex,
    @inject(TYPES.SharedSpatialIndex) @optional() sharedSpatialIndex?: SharedSpatialIndex,
  ) {
    this.gameState = gameState;
    this.gpuService = gpuService;
    this.entityIndex = entityIndex;
    this.sharedSpatialIndex = sharedSpatialIndex;
    this.config = {
      proximityRadius: 100,
      reinforcementPerSecond: 0.05,
      decayPerSecond: 0.01,
      groupThreshold: 0.6,
    };

    // NOTE: SocialSystem now uses SharedSpatialIndex instead of own SpatialGrid
    // The SharedSpatialIndex is maintained by SimulationRunner and shared across systems

    this.setupMarriageListeners();
  }

  private setupMarriageListeners(): void {
    simulationEvents.on(
      GameEventNames.MARRIAGE_ACCEPTED,
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
      GameEventNames.DIVORCE_COMPLETED,
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

  public update(deltaTimeMs: number): void {
    const startTime = performance.now();
    const dt = deltaTimeMs / 1000;
    this.lastUpdate += deltaTimeMs;
    const now = getFrameTime();

    this.updateSpatialGridIncremental();

    if (now - this.lastProximityUpdate > 200) {
      this.updateProximity(dt);
      this.lastProximityUpdate = now;
    }

    if (now - this.lastDecayUpdate > 1000) {
      this.decayEdgesOptimized(dt);
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

    if (!this.gameState.socialGraph) {
      this.gameState.socialGraph = {
        groups: this.groups,
        relationships: this.edges,
      };
    } else {
      this.gameState.socialGraph.groups = this.groups;
      this.gameState.socialGraph.relationships = this.edges;
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
  private updateSpatialGridIncremental(): void {
    // No-op: SharedSpatialIndex is maintained centrally by SimulationRunner
    // Entities are automatically tracked there
  }

  /**
   * Optimized edge decay that only processes edges with significant non-zero values.
   * Uses GPU for batch decay when available and edge count is high.
   *
   * @param dt - Delta time in seconds
   */
  private decayEdgesOptimized(dt: number): void {
    const decayAmount = this.config.decayPerSecond * dt;
    const bondDecayAmount = decayAmount * 0.05;
    const minAffinity = 0.001;

    let totalEdges = 0;
    for (const neighbors of this.edges.values()) {
      totalEdges += neighbors.size;
    }

    if (this.gpuService?.isGPUAvailable() && totalEdges > 200) {
      this.decayEdgesGPU(dt, minAffinity);
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
  private decayEdgesGPU(dt: number, minAffinity: number): void {
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
      newNonBonded = this.gpuService!.decayAffinitiesBatch(
        nonBondedAffinities,
        this.config.decayPerSecond,
        dt,
        minAffinity,
      );
    }
    if (bondedAffinities.length > 0) {
      newBonded = this.gpuService!.decayAffinitiesBatch(
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
   */
  private updateProximity(dt: number): void {
    const entities = this.gameState.entities || [];
    const reinforcement = this.config.reinforcementPerSecond * dt;
    const entitiesWithPos = entities.filter(
      (e): e is typeof e & { position: { x: number; y: number } } =>
        !!e.position && !e.isDead,
    );

    if (this.gpuService?.isGPUAvailable() && entitiesWithPos.length >= 20) {
      this.updateProximityGPU(entitiesWithPos, reinforcement);
      return;
    }

    // Use SharedSpatialIndex for proximity queries
    for (const entity of entitiesWithPos) {
      const nearby = this.sharedSpatialIndex?.queryRadius(
        entity.position,
        this.config.proximityRadius,
      );

      if (nearby) {
        for (const { entity: otherId } of nearby) {
          if (entity.id >= otherId) continue;
          this.addEdge(entity.id, otherId, reinforcement);
        }
        // Release results back to pool for memory efficiency
        this.sharedSpatialIndex?.releaseResults(nearby);
      }
    }
  }

  /**
   * GPU-accelerated proximity detection using pairwise distance matrix.
   * Computes all N×N distances in parallel on GPU.
   */
  private updateProximityGPU(
    entities: Array<{ id: string; position: { x: number; y: number } }>,
    reinforcement: number,
  ): void {
    const count = entities.length;
    const positions = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      positions[i * 2] = entities[i].position.x;
      positions[i * 2 + 1] = entities[i].position.y;
    }

    const { distances } = this.gpuService!.computePairwiseDistances(
      positions,
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

    if (newAffinityA !== currentA || newAffinityB !== currentB) {
      this.edgesModified = true;
      simulationEvents.emit(GameEventNames.SOCIAL_RELATION_CHANGED, {
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

    simulationEvents.emit(GameEventNames.SOCIAL_TRUCE_IMPOSED, {
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
        simulationEvents.emit(GameEventNames.SOCIAL_TRUCE_EXPIRED, {
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

    this.spatialGrid.remove(agentId);
    this.positionCache.delete(agentId);
  }

  public registerFriendlyInteraction(aId: string, bId: string): void {
    this.addEdge(aId, bId, 0.15);
    simulationEvents.emit(GameEventNames.SOCIAL_INTERACTION, {
      agentA: aId,
      agentB: bId,
      type: "friendly",
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

    const nearby = this.spatialGrid.queryRadius(centerEntity.position, radius);

    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        this.imposeTruce(nearby[i].entity, nearby[j].entity, durationMs);
      }
    }
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

    simulationEvents.emit(GameEventNames.FRIENDSHIP_FORMED, {
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
          simulationEvents.emit(GameEventNames.SOCIAL_RALLY, {
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

    simulationEvents.emit(GameEventNames.SOCIAL_GROUPS_UPDATE, {
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
    relationships: Map<string, Map<string, number>>;
  } {
    return {
      groups: this.groups,
      relationships: this.edges,
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
}
