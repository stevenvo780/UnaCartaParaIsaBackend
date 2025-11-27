import type { GameState } from "../../types/game-types";
import type {
  GovernanceEvent,
  GovernancePolicy,
  GovernanceSnapshot,
  SettlementDemand,
  SettlementStats,
  DemandType,
} from "../../types/simulation/governance";
import type { ResourceCost } from "../../types/simulation/economy";
import type { RoleType } from "../../types/simulation/roles";
import { GameEventNames, simulationEvents } from "../core/events";
import { LifeCycleSystem } from "./LifeCycleSystem";
import { InventorySystem } from "./InventorySystem";
import { DivineFavorSystem } from "./DivineFavorSystem";
import { ResourceReservationSystem } from "./ResourceReservationSystem";
import { RoleSystem } from "./RoleSystem";
import { logger } from "../../../infrastructure/utils/logger";
import { ZoneType } from "../../../shared/constants/ZoneEnums";

/**
 * Configuration for governance system behavior.
 */
interface GovernanceConfig {
  checkIntervalMs: number;
  demandExpirationMs: number;
  autoGenerateProjects: boolean;
}

const DEFAULT_POLICIES: GovernancePolicy[] = [
  {
    id: "food_security",
    name: "Seguridad Alimentaria",
    description: "Construir infraestructura cuando la comida es escasa",
    enabled: true,
    threshold: { foodPerCapita: 5 },
    autoResolve: true,
  },
  {
    id: "water_supply",
    name: "Suministro de Agua",
    description: "Refuerza pozos al detectar escasez",
    enabled: true,
    threshold: { waterPerCapita: 8 },
    autoResolve: true,
  },
  {
    id: "housing_expansion",
    name: "Expansión de Vivienda",
    description: "Aumenta capacidad habitacional",
    enabled: true,
    threshold: { housingOccupancy: 0.8 },
    autoResolve: true,
  },
];

const DEMAND_SOLUTIONS: Partial<
  Record<
    DemandType,
    {
      project: string;
      cost: ResourceCost;
      resourceBoost?: { food?: number; water?: number };
      roleAssignment?: { role: RoleType; count: number };
    }
  >
> = {
  housing_full: {
    project: "build_house",
    cost: { wood: 40, stone: 20 },
    roleAssignment: { role: "builder", count: 2 },
  },
  food_shortage: {
    project: "assign_hunters",
    cost: { wood: 0, stone: 0 },
    resourceBoost: { food: 40 },
    roleAssignment: { role: "hunter", count: 3 },
  },
  water_shortage: {
    project: "gather_water",
    cost: { wood: 0, stone: 0 },
    resourceBoost: { water: 30 },
    roleAssignment: { role: "gatherer", count: 2 },
  },
};

const DEFAULT_LINEAGE = "community";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class GovernanceSystem {
  private config: GovernanceConfig;
  private demands = new Map<string, SettlementDemand>();
  private policies = new Map<string, GovernancePolicy>();
  private history: GovernanceEvent[] = [];
  private lastCheck = 0;
  private demandSeq = 0;
  private housingProjectsStarted = 0;

  private readonly handleHighOccupancy = (payload: {
    occupancy?: number;
    free?: number;
    totalCapacity?: number;
  }): void => {
    const occupancy = payload.occupancy ?? 1;
    const priority = 7 + Math.min(3, Math.max(0, (occupancy - 0.8) * 10));
    this.createDemand("housing_full", priority, "Ocupación de viviendas alta", {
      occupancy,
      free: payload.free ?? 0,
      totalCapacity: payload.totalCapacity ?? 0,
    });
  };

  private readonly handleHomeless = (payload: { count?: number }): void => {
    const count = payload.count ?? 1;
    const priority = 8 + Math.min(4, Math.floor(count / 2));
    this.createDemand(
      "housing_full",
      priority,
      "Agentes sin hogar detectados",
      {
        homelessCount: count,
      },
    );
  };

  private readonly handleNoHouses = (): void => {
    this.createDemand("housing_full", 9, "No hay casas disponibles");
  };

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
    @inject(TYPES.LifeCycleSystem)
    private readonly lifeCycleSystem: LifeCycleSystem,
    @inject(TYPES.DivineFavorSystem)
    private readonly divineFavorSystem: DivineFavorSystem,
    @inject(TYPES.ResourceReservationSystem)
    private readonly reservationSystem: ResourceReservationSystem,
    @inject(TYPES.RoleSystem)
    private readonly roleSystem: RoleSystem,
  ) {
    this.config = {
      checkIntervalMs: 30_000,
      demandExpirationMs: 5 * 60_000,
      autoGenerateProjects: true,
    };

    DEFAULT_POLICIES.forEach((policy) =>
      this.policies.set(policy.id, { ...policy }),
    );

    simulationEvents.on(
      GameEventNames.HOUSEHOLD_HIGH_OCCUPANCY,
      this.handleHighOccupancy,
    );
    simulationEvents.on(
      GameEventNames.HOUSEHOLD_AGENTS_HOMELESS,
      this.handleHomeless,
    );
    simulationEvents.on(
      GameEventNames.HOUSEHOLD_NO_FREE_HOUSES,
      this.handleNoHouses,
    );

    simulationEvents.on(
      GameEventNames.CRISIS_IMMEDIATE_WARNING,
      (data: {
        prediction: {
          type: string;
          probability: number;
          severity: number;
          recommendedActions: string[];
        };
        timestamp: number;
      }) => {
        const prediction = data.prediction;
        let demandType: DemandType = "housing_full";
        if (prediction.type === "resource_shortage") {
          demandType = "food_shortage";
        } else if (prediction.type === "population_crisis") {
          demandType = "housing_full";
        }
        this.createDemand(
          demandType,
          10, // máxima prioridad
          `Crisis predicha: ${prediction.type}`,
          {
            probability: prediction.probability,
            severity: prediction.severity,
          },
        );
      },
    );

    simulationEvents.on(
      GameEventNames.PRODUCTION_OUTPUT_GENERATED,
      (data: {
        zoneId: string;
        resource: string;
        amount: number;
        workers: string[];
        timestamp?: number;
      }) => {
        this.recordEvent({
          timestamp: Date.now(),
          type: "production_generated",
          details: {
            zoneId: data.zoneId,
            resource: data.resource,
            amount: data.amount,
            workerCount: data.workers.length,
          },
        });
        if (data.resource === "food" && data.amount > 20) {
          for (const [_demandId, demand] of Array.from(
            this.demands.entries(),
          )) {
            if (
              demand.type === "food_shortage" &&
              !demand.resolvedAt &&
              demand.priority < 8
            ) {
              demand.priority = Math.max(5, demand.priority - 1);
            }
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.PRODUCTION_WORKER_REMOVED,
      (data: {
        zoneId: string;
        agentId: string;
        reason: string;
        timestamp?: number;
      }) => {
        this.recordEvent({
          timestamp: Date.now(),
          type: "production_worker_lost",
          details: {
            zoneId: data.zoneId,
            agentId: data.agentId,
            reason: data.reason,
          },
        });
        const recentLosses = this.history.filter(
          (e) =>
            e.type === "production_worker_lost" &&
            Date.now() - e.timestamp < 60000,
        );
        if (recentLosses.length >= 3) {
          this.createDemand(
            "housing_full", // Usar tipo existente, podría ser "worker_shortage" en el futuro
            7,
            "Pérdida significativa de trabajadores de producción",
            {
              recentLosses: recentLosses.length,
            },
          );
        }
      },
    );
  }

  public update(_deltaTimeMs: number): void {
    const now = Date.now();
    if (now - this.lastCheck < this.config.checkIntervalMs) {
      return;
    }
    this.lastCheck = now;

    this.expireOldDemands(now);
    this.checkSettlementNeeds();
    this.pushSnapshot();
  }

  public getSnapshot(): GovernanceSnapshot {
    return {
      stats: this.getSettlementStats(),
      policies: Array.from(this.policies.values()),
      demands: Array.from(this.demands.values()),
      history: [...this.history],
      reservations: this.reservationSystem.getTotalReserved(),
    };
  }

  public setPolicyEnabled(policyId: string, enabled: boolean): void {
    const policy = this.policies.get(policyId);
    if (!policy) return;
    policy.enabled = enabled;
    this.recordEvent({
      timestamp: Date.now(),
      type: "policy_changed",
      details: { policyId, enabled },
    });
    this.pushSnapshot();
  }

  private expireOldDemands(now: number): void {
    for (const [id, demand] of Array.from(this.demands.entries())) {
      if (demand.resolvedAt) {
        continue;
      }
      if (now - demand.detectedAt > this.config.demandExpirationMs) {
        this.demands.delete(id);
      }
    }
  }

  private checkSettlementNeeds(): void {
    const stats = this.getSettlementStats();
    const foodPolicy = this.policies.get("food_security");
    if (foodPolicy?.enabled) {
      if (stats.foodPerCapita < (foodPolicy.threshold.foodPerCapita ?? 5)) {
        this.createDemand("food_shortage", 8, "Reservas de comida bajas", {
          foodPerCapita: stats.foodPerCapita,
          population: stats.population,
        });
      }
    }

    const waterPolicy = this.policies.get("water_supply");
    if (waterPolicy?.enabled) {
      if (stats.waterPerCapita < (waterPolicy.threshold.waterPerCapita ?? 8)) {
        this.createDemand("water_shortage", 9, "Reservas de agua bajas", {
          waterPerCapita: stats.waterPerCapita,
          population: stats.population,
        });
      }
    }

    const housingPolicy = this.policies.get("housing_expansion");
    if (housingPolicy?.enabled) {
      if (
        stats.housingOccupancy >
        (housingPolicy.threshold.housingOccupancy ?? 0.8)
      ) {
        this.createDemand("housing_full", 7, "Viviendas casi llenas", {
          occupancy: stats.housingOccupancy,
          population: stats.population,
          capacity: stats.housingCapacity,
        });
      }
    }
  }

  private createDemand(
    type: DemandType,
    priority: number,
    reason: string,
    metrics?: Record<string, number>,
  ): void {
    const existing = Array.from(this.demands.values()).find(
      (d) => d.type === type && !d.resolvedAt,
    );
    if (existing) return;

    const modifiedPriority = this.applyDivineModifiers(type, priority);

    const demand: SettlementDemand = {
      id: `demand_${++this.demandSeq}`,
      type,
      priority: modifiedPriority,
      detectedAt: Date.now(),
      reason,
      metrics,
      suggestedProject: DEMAND_SOLUTIONS[type]?.project,
    };

    this.demands.set(demand.id, demand);
    this.recordEvent({
      timestamp: Date.now(),
      type: "demand_created",
      details: {
        demandId: demand.id,
        demandType: type,
        priority: modifiedPriority,
      },
    });

    logger.debug(
      `🏛️ [GOVERNANCE] Demand created: ${type} (priority: ${modifiedPriority}) - ${reason}`,
    );

    if (this.config.autoGenerateProjects) {
      this.resolveWithProject(demand);
    }
  }

  private resolveWithProject(demand: SettlementDemand): void {
    const solution = DEMAND_SOLUTIONS[demand.type];
    if (!solution) return;

    const reservationId = `${demand.id}:reservation`;
    if (solution.cost && (solution.cost.wood > 0 || solution.cost.stone > 0)) {
      const reserved = this.reservationSystem.reserve(
        reservationId,
        solution.cost,
      );
      if (!reserved) {
        this.recordEvent({
          timestamp: Date.now(),
          type: "project_failed",
          details: { demandId: demand.id, reason: "insufficient_resources" },
        });
        return;
      }
      const consumed = this.reservationSystem.consume(reservationId);
      if (!consumed) {
        return;
      }
    }

    // Generic role assignment based on demand solution
    if (solution.roleAssignment) {
      const assignedCount = this.assignRolesForDemand(
        solution.roleAssignment.role,
        solution.roleAssignment.count,
        demand.type,
      );

      if (assignedCount > 0) {
        logger.info(
          `🏛️ [GOVERNANCE] Assigned ${assignedCount} agents to role ${solution.roleAssignment.role} for demand ${demand.type}`,
        );
      }
    }

    this.applyDemandEffect(demand.type, solution);
    demand.resolvedAt = Date.now();
    this.recordEvent({
      timestamp: demand.resolvedAt,
      type: "demand_resolved",
      details: { demandId: demand.id, action: solution.project },
    });

    simulationEvents.emit(GameEventNames.GOVERNANCE_ACTION, {
      demandId: demand.id,
      action: solution.project,
      cost: solution.cost,
      timestamp: Date.now(),
    });
  }

  /**
   * Assigns agents to a specific role based on a community demand.
   * Prioritizes idle agents and those with matching traits.
   *
   * @param targetRole - The role to assign
   * @param count - Maximum number of agents to assign
   * @param demandType - The type of demand triggering this assignment
   * @returns Number of agents successfully assigned
   */
  private assignRolesForDemand(
    targetRole: RoleType,
    count: number,
    demandType: DemandType,
  ): number {
    // Get all living agents
    const agents = (this.state.agents ?? []).filter(
      (a) => !a.isDead && a.ageYears >= 16,
    );

    if (agents.length === 0) return 0;

    // Score agents for the target role
    const scoredAgents = agents.map((agent) => {
      const currentRole = this.roleSystem.getAgentRole(agent.id);

      // Skip if already has the target role
      if (currentRole?.roleType === targetRole) {
        return { agent, score: -1 };
      }

      let score = 0;

      // Prefer idle agents
      if (!currentRole || currentRole.roleType === "idle") {
        score += 50;
      }

      // Prefer agents with low satisfaction in current role
      if (currentRole && currentRole.satisfaction < 0.4) {
        score += 20;
      }

      // Role-specific trait preferences
      switch (targetRole) {
        case "hunter":
          score += (agent.traits.diligence ?? 0.5) * 30;
          score += (agent.traits.neuroticism ?? 0.3) * 15; // Alertness
          break;
        case "gatherer":
          score += (agent.traits.curiosity ?? 0.5) * 25;
          score += (agent.traits.cooperation ?? 0.5) * 15;
          break;
        case "builder":
          score += (agent.traits.diligence ?? 0.5) * 25;
          score += (agent.traits.cooperation ?? 0.5) * 25;
          break;
        case "farmer":
          score += (agent.traits.diligence ?? 0.5) * 30;
          score += (agent.traits.curiosity ?? 0.5) * 10;
          break;
        case "logger":
        case "quarryman":
          score += (agent.traits.diligence ?? 0.5) * 35;
          break;
        case "guard":
          score += (agent.traits.cooperation ?? 0.5) * 25;
          score += (agent.traits.diligence ?? 0.5) * 20;
          break;
      }

      return { agent, score };
    });

    // Sort by score descending, filter out those already in role
    scoredAgents.sort((a, b) => b.score - a.score);

    let assignedCount = 0;
    for (const { agent, score } of scoredAgents) {
      if (assignedCount >= count) break;
      if (score < 0) continue; // Already has target role

      const result = this.roleSystem.reassignRole(agent.id, targetRole);
      if (result.success) {
        assignedCount++;
        this.recordEvent({
          timestamp: Date.now(),
          type: "role_reassigned",
          details: {
            agentId: agent.id,
            role: targetRole,
            reason: `${demandType}_demand`,
            score,
          },
        });
      }
    }

    return assignedCount;
  }

  private applyDemandEffect(
    type: DemandType,
    solution: { resourceBoost?: { food?: number; water?: number } } | undefined,
  ): void {
    const resources = this.state.resources;
    if (!resources) return;

    switch (type) {
      case "housing_full":
        this.housingProjectsStarted += 1;
        break;
      case "food_shortage":
        if (solution?.resourceBoost?.food) {
          resources.materials.food += solution.resourceBoost.food;
        }
        break;
      case "water_shortage":
        if (solution?.resourceBoost?.water) {
          resources.materials.water += solution.resourceBoost.water;
        }
        break;
      default:
        break;
    }
  }

  private applyDivineModifiers(type: DemandType, priority: number): number {
    if (!this.divineFavorSystem) return priority;
    const lineage = DEFAULT_LINEAGE;
    let multiplier = 1;

    if (type === "housing_full") {
      multiplier = this.divineFavorSystem.getMultiplier(
        lineage,
        "productivity_boost",
      );
    } else if (type === "food_shortage" || type === "water_shortage") {
      multiplier = this.divineFavorSystem.getMultiplier(lineage, "prosperity");
    }

    return Number((priority * Math.max(1, multiplier)).toFixed(2));
  }

  private getSettlementStats(): SettlementStats {
    const lifecycleAgents = this.lifeCycleSystem.getAgents();
    const entities = this.state.entities ?? [];
    const populationSource =
      lifecycleAgents.length > 0 ? lifecycleAgents : entities;
    const population = populationSource.length;
    const zones = this.state.zones ?? [];
    const housingZones = zones.filter(
      (zone) =>
        zone.type === ZoneType.SHELTER ||
        zone.type === ZoneType.BEDROOM ||
        (zone.props &&
          "subtype" in zone.props &&
          zone.props.subtype === "housing"),
    );
    const houses = housingZones.length;
    const baseCapacity = housingZones.reduce((sum: number, zone) => {
      const capacity =
        (zone.props && typeof zone.props.capacity === "number"
          ? zone.props.capacity
          : undefined) ?? 2;
      return sum + capacity;
    }, 0);
    const housingCapacity = baseCapacity + this.housingProjectsStarted * 2;

    const stats = this.inventorySystem.getSystemStats();
    const resources = this.state.resources;
    const foodStockpile =
      (resources?.materials.food ?? 0) + stats.stockpiled.food;
    const waterStockpile =
      (resources?.materials.water ?? 0) + stats.stockpiled.water;

    const avgHappiness = this.averageEntityStat("happiness");
    const avgHealth = this.averageEntityStat("health");

    const idleAgents = entities.filter((entity) => {
      const activity = entity.state;
      if (typeof activity === "string") {
        return activity === "idle";
      }
      if (
        typeof activity === "object" &&
        activity !== null &&
        "status" in activity
      ) {
        const status = (activity as { status?: string }).status;
        return status === "idle";
      }
      return false;
    }).length;
    const workersAvailable = Math.max(0, population - idleAgents);

    const foodPerCapita =
      population > 0 ? foodStockpile / population : foodStockpile;
    const waterPerCapita =
      population > 0 ? waterStockpile / population : waterStockpile;
    const housingOccupancy =
      housingCapacity > 0 ? population / housingCapacity : 1;

    return {
      population,
      houses,
      housingCapacity,
      foodStockpile,
      waterStockpile,
      avgHappiness,
      avgHealth,
      workersAvailable,
      idleAgents,
      foodPerCapita,
      waterPerCapita,
      housingOccupancy,
    };
  }

  private averageEntityStat(stat: string): number {
    const entities = this.state.entities ?? [];
    if (entities.length === 0) return 0;
    let total = 0;
    let counted = 0;
    for (const entity of entities) {
      const value = entity.stats?.[stat];
      if (typeof value === "number") {
        total += value;
        counted += 1;
      }
    }
    return counted > 0 ? total / counted : 0;
  }

  private recordEvent(event: GovernanceEvent): void {
    this.history.push(event);
    if (this.history.length > 50) {
      this.history.shift();
    }
  }

  private pushSnapshot(): void {
    const snapshot = this.getSnapshot();
    this.state.governance = snapshot;
    simulationEvents.emit(GameEventNames.GOVERNANCE_UPDATE, snapshot);
  }
}
