import { EventEmitter } from "events";
import type { GameState } from "../../types/game-types";
import { simulationEvents, GameEventType } from "../core/events";
import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { SharedSpatialIndex } from "../core/SharedSpatialIndex";
import type { AgentRegistry } from "../core/AgentRegistry";
import { EntityType } from "../../../shared/constants/EntityEnums";

export interface ResourceAlert {
  id: string;
  resourceId: string;
  resourceType: string;
  position: { x: number; y: number };
  reportedBy: string;
  reportedAt: number;
  expiresAt: number;
  notifiedAgents: Set<string>;
}

export interface ThreatAlert {
  id: string;
  threatId: string;
  threatType: "predator" | "hostile_agent" | "danger_zone";
  position: { x: number; y: number };
  reportedBy: string;
  reportedAt: number;
  expiresAt: number;
  severity: number;
  notifiedAgents: Set<string>;
}

/**
 * System for sharing knowledge and alerts among agents.
 *
 * Features:
 * - Resource discovery alerts that spread to nearby agents
 * - Threat warnings with severity-based propagation radius
 * - Automatic expiration of old alerts
 * - Spatial propagation based on agent proximity
 *
 * This enables emergent collective intelligence where agents
 * can benefit from discoveries and warnings of their peers.
 */
@injectable()
export class SharedKnowledgeSystem extends EventEmitter {
  private gameState: GameState;
  private spatialIndex?: SharedSpatialIndex;
  private agentRegistry?: AgentRegistry;
  private resourceAlerts = new Map<string, ResourceAlert>();
  private threatAlerts = new Map<string, ThreatAlert>();
  private alertSeq = 0;

  private readonly RESOURCE_ALERT_DURATION = 60000;
  private readonly THREAT_ALERT_DURATION = 30000;
  private readonly PROPAGATION_RADIUS = 500;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.SharedSpatialIndex)
    @optional()
    spatialIndex?: SharedSpatialIndex,
    @inject(TYPES.AgentRegistry)
    @optional()
    agentRegistry?: AgentRegistry,
  ) {
    super();
    this.gameState = gameState;
    this.spatialIndex = spatialIndex;
    this.agentRegistry = agentRegistry;
  }

  /**
   * Registers a resource find and propagates to nearby agents.
   *
   * @param agentId - ID of the agent who found the resource
   * @param resourceId - ID of the resource
   * @param resourceType - Type of resource (food, water, wood, stone)
   * @param position - Position where resource was found
   */
  public registerResourceFind(
    agentId: string,
    resourceId: string,
    resourceType: string,
    position: { x: number; y: number },
  ): void {
    const alert: ResourceAlert = {
      id: `resource_alert_${++this.alertSeq}`,
      resourceId,
      resourceType,
      position,
      reportedBy: agentId,
      reportedAt: Date.now(),
      expiresAt: Date.now() + this.RESOURCE_ALERT_DURATION,
      notifiedAgents: new Set([agentId]),
    };

    this.resourceAlerts.set(alert.id, alert);

    this.propagateResourceAlert(alert);

    simulationEvents.emit(GameEventType.RESOURCE_DISCOVERED, {
      agentId,
      resourceId,
      resourceType,
      position,
      timestamp: Date.now(),
    });
  }

  /**
   * Registers a threat and alerts nearby agents.
   *
   * @param agentId - ID of the agent who detected the threat
   * @param threatId - ID of the threat (e.g., predator ID)
   * @param threatType - Type of threat
   * @param position - Position of the threat
   * @param severity - Severity from 0 (minor) to 1 (critical)
   */
  public registerThreat(
    agentId: string,
    threatId: string,
    threatType: "predator" | "hostile_agent" | "danger_zone",
    position: { x: number; y: number },
    severity: number,
  ): void {
    const alert: ThreatAlert = {
      id: `threat_alert_${++this.alertSeq}`,
      threatId,
      threatType,
      position,
      reportedBy: agentId,
      reportedAt: Date.now(),
      expiresAt: Date.now() + this.THREAT_ALERT_DURATION,
      severity,
      notifiedAgents: new Set([agentId]),
    };

    this.threatAlerts.set(alert.id, alert);

    this.propagateThreatAlert(alert);

    simulationEvents.emit(GameEventType.THREAT_DETECTED, {
      agentId,
      threatId,
      threatType,
      position,
      severity,
      timestamp: Date.now(),
    });
  }

  private propagateResourceAlert(alert: ResourceAlert): void {
    if (this.spatialIndex) {
      const nearbyAgents = this.spatialIndex.queryRadius(
        alert.position,
        this.PROPAGATION_RADIUS,
        EntityType.AGENT,
      );

      for (const result of nearbyAgents) {
        if (alert.notifiedAgents.has(result.entity)) continue;

        alert.notifiedAgents.add(result.entity);
        this.emit("resource_alert", {
          agentId: result.entity,
          alert,
        });
      }

      this.spatialIndex.releaseResults(nearbyAgents);
      return;
    }

    // NOTA: AgentRegistry es la fuente de verdad para perfiles de agentes
    const agents: Array<{ id: string; position?: { x: number; y: number } }> =
      [];
    if (this.agentRegistry) {
      for (const profile of this.agentRegistry.getAllProfiles()) {
        agents.push(profile);
      }
    } else if (this.gameState.agents) {
      // Fallback: solo si AgentRegistry no disponible
      agents.push(...this.gameState.agents);
    }

    const radiusSq = this.PROPAGATION_RADIUS * this.PROPAGATION_RADIUS;

    for (const agent of agents) {
      if (alert.notifiedAgents.has(agent.id)) continue;
      if (!agent.position) continue;

      const dx = agent.position.x - alert.position.x;
      const dy = agent.position.y - alert.position.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= radiusSq) {
        alert.notifiedAgents.add(agent.id);
        this.emit("resource_alert", {
          agentId: agent.id,
          alert,
        });
      }
    }
  }

  private propagateThreatAlert(alert: ThreatAlert): void {
    const threatRadius = this.PROPAGATION_RADIUS * (1 + alert.severity);

    if (this.spatialIndex) {
      const nearbyAgents = this.spatialIndex.queryRadius(
        alert.position,
        threatRadius,
        EntityType.AGENT,
      );

      for (const result of nearbyAgents) {
        if (alert.notifiedAgents.has(result.entity)) continue;

        alert.notifiedAgents.add(result.entity);
        this.emit("threat_alert", {
          agentId: result.entity,
          alert,
        });
      }

      this.spatialIndex.releaseResults(nearbyAgents);
      return;
    }

    const agents = this.gameState.agents || [];
    const radiusSq = threatRadius * threatRadius;

    for (const agent of agents) {
      if (alert.notifiedAgents.has(agent.id)) continue;
      if (!agent.position) continue;

      const dx = agent.position.x - alert.position.x;
      const dy = agent.position.y - alert.position.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= radiusSq) {
        alert.notifiedAgents.add(agent.id);
        this.emit("threat_alert", {
          agentId: agent.id,
          alert,
        });
      }
    }
  }

  /**
   * Gets active resource alerts that an agent knows about.
   *
   * @param agentId - ID of the agent
   * @returns Array of resource alerts the agent has been notified about
   */
  public getKnownResourceAlerts(agentId: string): ResourceAlert[] {
    const now = Date.now();
    const alerts: ResourceAlert[] = [];

    for (const alert of this.resourceAlerts.values()) {
      if (alert.expiresAt < now) continue;
      if (!alert.notifiedAgents.has(agentId)) continue;

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Gets active threat alerts that an agent knows about.
   *
   * @param agentId - ID of the agent
   * @returns Array of threat alerts the agent has been notified about
   */
  public getKnownThreatAlerts(agentId: string): ThreatAlert[] {
    const now = Date.now();
    const alerts: ThreatAlert[] = [];

    for (const alert of this.threatAlerts.values()) {
      if (alert.expiresAt < now) continue;
      if (!alert.notifiedAgents.has(agentId)) continue;

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Cleans up expired alerts.
   * Should be called periodically by the simulation loop.
   */
  public update(): void {
    const now = Date.now();

    for (const [id, alert] of this.resourceAlerts.entries()) {
      if (alert.expiresAt < now) {
        this.resourceAlerts.delete(id);
      }
    }

    for (const [id, alert] of this.threatAlerts.entries()) {
      if (alert.expiresAt < now) {
        this.threatAlerts.delete(id);
      }
    }
  }

  /**
   * Gets stats about current alerts for monitoring.
   */
  public getStats(): {
    activeResourceAlerts: number;
    activeThreatAlerts: number;
    totalAgentsNotified: number;
  } {
    const now = Date.now();
    let activeResourceAlerts = 0;
    let activeThreatAlerts = 0;
    const notifiedAgents = new Set<string>();

    for (const alert of this.resourceAlerts.values()) {
      if (alert.expiresAt >= now) {
        activeResourceAlerts++;
        alert.notifiedAgents.forEach((id) => notifiedAgents.add(id));
      }
    }

    for (const alert of this.threatAlerts.values()) {
      if (alert.expiresAt >= now) {
        activeThreatAlerts++;
        alert.notifiedAgents.forEach((id) => notifiedAgents.add(id));
      }
    }

    return {
      activeResourceAlerts,
      activeThreatAlerts,
      totalAgentsNotified: notifiedAgents.size,
    };
  }
}
