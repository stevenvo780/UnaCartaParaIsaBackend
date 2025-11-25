import { GameState } from "../../types/game-types";
import { SocialConfig } from "../../types/simulation/social";
import { SpatialGrid } from "../../../utils/SpatialGrid";
import { SocialGroup } from "../../../shared/types/simulation/agents";
import { simulationEvents, GameEventNames } from "../core/events";
import type { SimulationEntity, EntityTraits } from "../core/schema";
import { logger } from "../../../infrastructure/utils/logger";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

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
  private spatialGrid: SpatialGrid<string>;
  private truces = new Map<string, number>();
  private infamy = new Map<string, number>();
  private zoneHeat = new Map<string, number>();
  private lastUpdate = 0;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.config = {
      proximityRadius: 100,
      reinforcementPerSecond: 0.05,
      decayPerSecond: 0.01,
      groupThreshold: 0.6,
    };

    const worldWidth = gameState.worldSize?.width ?? 2000;
    const worldHeight = gameState.worldSize?.height ?? 2000;
    this.spatialGrid = new SpatialGrid(
      worldWidth,
      worldHeight,
      this.config.proximityRadius,
    );
  }

  public getGroupForAgent(agentId: string): SocialGroup | undefined {
    return this.groups.find((group) => group.members.includes(agentId));
  }

  public update(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;
    this.lastUpdate += deltaTimeMs;

    // Sincronización ahora se hace centralmente en SimulationRunner
    // Mantener este método por compatibilidad pero ya no es necesario llamarlo aquí

    this.spatialGrid.clear();
    const entities = this.gameState.entities || [];
    for (const entity of entities) {
      if (entity.position) {
        this.spatialGrid.insert(entity.id, entity.position);
      }
    }

    this.updateProximity(dt);
    this.decayEdges(dt);

    if (this.lastUpdate > 1000) {
      this.recomputeGroups();
      this.lastUpdate = 0;
    }

    this.updateTruces(Date.now());
  }

  private decayEdges(dt: number): void {
    this.edges.forEach((neighbors, aId) => {
      neighbors.forEach((affinity, bId) => {
        if (affinity !== 0) {
          const bondType =
            this.permanentBonds.get(aId)?.get(bId) ||
            this.permanentBonds.get(bId)?.get(aId);

          let decayRate = this.config.decayPerSecond;
          if (bondType) {
            decayRate *= 0.05; // Slower decay for family/marriage
          }

          let newAffinity = affinity;
          if (affinity > 0) {
            newAffinity = Math.max(0, affinity - decayRate * dt);
          } else {
            newAffinity = Math.min(0, affinity + decayRate * dt);
          }

          neighbors.set(bId, newAffinity);
        }
      });
    });
  }

  private updateProximity(dt: number): void {
    const entities = this.gameState.entities || [];
    const reinforcement = this.config.reinforcementPerSecond * dt;

    for (const entity of entities) {
      if (!entity.position) continue;

      const nearby = this.spatialGrid.queryRadius(
        entity.position,
        this.config.proximityRadius,
      );

      for (const { entity: otherId } of nearby) {
        if (entity.id >= otherId) continue; // Avoid duplicates and self
        this.addEdge(entity.id, otherId, reinforcement);
      }
    }
  }

  public addEdge(a: string, b: string, delta: number): void {
    if (a === b) return;
    if (!this.edges.has(a)) this.edges.set(a, new Map());
    if (!this.edges.has(b)) this.edges.set(b, new Map());

    const currentA = this.edges.get(a)!.get(b) || 0;
    this.edges.get(a)!.set(b, Math.max(-1, Math.min(1, currentA + delta)));

    const currentB = this.edges.get(b)!.get(a) || 0;
    this.edges.get(b)!.set(a, Math.max(-1, Math.min(1, currentB + delta)));
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

    // DEBUG: Log truces
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
  }

  public registerFriendlyInteraction(aId: string, bId: string): void {
    this.addEdge(aId, bId, 0.15);
  }

  public imposeLocalTruces(
    centerAgentId: string,
    radius: number,
    durationMs: number,
  ): void {
    const entities = this.gameState.entities;
    if (!entities) return;

    const centerEntity = entities.find((e) => e.id === centerAgentId);
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

    // DEBUG: Log permanent bonds
    logger.debug(
      `💕 [SOCIAL] Permanent bond: ${type} between ${aId} and ${bId}`,
    );
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
          morale: 100, // Default morale for now
        });
      }
    }

    this.groups = newGroups;

    simulationEvents.emit(GameEventNames.SOCIAL_GROUPS_UPDATE, {
      groups: this.groups,
      count: this.groups.length,
    });
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

}
