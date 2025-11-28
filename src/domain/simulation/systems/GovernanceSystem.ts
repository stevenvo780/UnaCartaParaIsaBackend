import type { GameState } from "../../types/game-types";
import type {
  GovernanceEvent,
  GovernancePolicy,
  GovernanceSnapshot,
  SettlementDemand,
  SettlementStats,
} from "../../types/simulation/governance";
import type { ResourceCost } from "../../types/simulation/economy";
import type { RoleType } from "../../types/simulation/roles";
import { RoleType as RoleTypeEnum } from "../../../shared/constants/RoleEnums";
import {
  DemandType,
  GovernancePolicyId,
  GovernanceProjectType,
  GovernanceEventType,
} from "../../../shared/constants/GovernanceEnums";
import { CrisisPredictionType } from "../../../shared/constants/AmbientEnums";
import { EntityStatus } from "../../../shared/constants/EntityStatusEnums";
import { GameEventType, simulationEvents } from "../core/events";
import { LifeCycleSystem } from "./LifeCycleSystem";
import { InventorySystem } from "./InventorySystem";

import { ResourceReservationSystem } from "./ResourceReservationSystem";
import { RoleSystem } from "./RoleSystem";
import { logger } from "../../../infrastructure/utils/logger";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

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
    id: GovernancePolicyId.FOOD_SECURITY,
    name: "Seguridad Alimentaria",
    description: "Construir infraestructura cuando la comida es escasa",
    enabled: true,
    threshold: { foodPerCapita: 5 },
    autoResolve: true,
  },
  {
    id: GovernancePolicyId.WATER_SUPPLY,
    name: "Suministro de Agua",
    description: "Refuerza pozos al detectar escasez",
    enabled: true,
    threshold: { waterPerCapita: 8 },
    autoResolve: true,
  },
  {
    id: GovernancePolicyId.HOUSING_EXPANSION,
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
      project: GovernanceProjectType;
      cost: ResourceCost;
      resourceBoost?: { food?: number; water?: number };
      roleAssignment?: { role: RoleType; count: number };
    }
  >
> = {
  [DemandType.HOUSING_FULL]: {
    project: GovernanceProjectType.BUILD_HOUSE,
    cost: { wood: 40, stone: 20 },
    roleAssignment: { role: RoleTypeEnum.BUILDER, count: 2 },
  },
  [DemandType.FOOD_SHORTAGE]: {
    project: GovernanceProjectType.ASSIGN_HUNTERS,
    cost: { wood: 0, stone: 0 },
    resourceBoost: { food: 40 },
    roleAssignment: { role: RoleTypeEnum.HUNTER, count: 3 },
  },
  [DemandType.WATER_SHORTAGE]: {
    project: GovernanceProjectType.GATHER_WATER,
    cost: { wood: 0, stone: 0 },
    resourceBoost: { water: 30 },
    roleAssignment: { role: RoleTypeEnum.GATHERER, count: 2 },
  },
};

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { AgentRegistry } from "../core/AgentRegistry";

@injectable()
export class GovernanceSystem {
  private config: GovernanceConfig;
  private demands = new Map<string, SettlementDemand>();
  private policies = new Map<string, GovernancePolicy>();
  private history: GovernanceEvent[] = [];
  private lastCheck = 0;
  private demandSeq = 0;
  private housingProjectsStarted = 0;
  private agentRegistry?: AgentRegistry;

  private readonly handleHighOccupancy = (payload: {
    occupancy?: number;
    free?: number;
    totalCapacity?: number;
  }): void => {
    const occupancy = payload.occupancy ?? 1;
    const priority = 7 + Math.min(3, Math.max(0, (occupancy - 0.8) * 10));
    this.createDemand(
      DemandType.HOUSING_FULL,
      priority,
      "Ocupación de viviendas alta",
      {
        occupancy,
        free: payload.free ?? 0,
        totalCapacity: payload.totalCapacity ?? 0,
      },
    );
  };

  private readonly handleHomeless = (payload: { count?: number }): void => {
    const count = payload.count ?? 1;
    const priority = 8 + Math.min(4, Math.floor(count / 2));
    this.createDemand(
      DemandType.HOUSING_FULL,
      priority,
      "Agentes sin hogar detectados",
      {
        homelessCount: count,
      },
    );
  };

  private readonly handleNoHouses = (): void => {
    this.createDemand(DemandType.HOUSING_FULL, 9, "No hay casas disponibles");
  };

  constructor(
    @inject(TYPES.GameState) private readonly state: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
    @inject(TYPES.LifeCycleSystem)
    private readonly lifeCycleSystem: LifeCycleSystem,

    @inject(TYPES.ResourceReservationSystem)
    private readonly reservationSystem: ResourceReservationSystem,
    @inject(TYPES.RoleSystem)
    private readonly roleSystem: RoleSystem,
    @inject(TYPES.AgentRegistry) @optional() agentRegistry?: AgentRegistry,
  ) {
    this.agentRegistry = agentRegistry;
    this.config = {
      checkIntervalMs: 30_000,
      demandExpirationMs: 5 * 60_000,
      autoGenerateProjects: true,
    };

    DEFAULT_POLICIES.forEach((policy) =>
      this.policies.set(policy.id, { ...policy }),
    );

    simulationEvents.on(
      GameEventType.HOUSEHOLD_HIGH_OCCUPANCY,
      this.handleHighOccupancy,
    );
    simulationEvents.on(
      GameEventType.HOUSEHOLD_AGENTS_HOMELESS,
      this.handleHomeless,
    );
    simulationEvents.on(
      GameEventType.HOUSEHOLD_NO_FREE_HOUSES,
      this.handleNoHouses,
    );

    simulationEvents.on(
      GameEventType.CRISIS_IMMEDIATE_WARNING,
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
        let demandType: DemandType = DemandType.HOUSING_FULL;
        if (prediction.type === CrisisPredictionType.RESOURCE_SHORTAGE) {
          demandType = DemandType.FOOD_SHORTAGE;
        } else if (prediction.type === CrisisPredictionType.POPULATION_CRISIS) {
          demandType = DemandType.HOUSING_FULL;
        }
        this.createDemand(
          demandType,
          10,
          `Crisis predicha: ${prediction.type}`,
          {
            probability: prediction.probability,
            severity: prediction.severity,
          },
        );
      },
    );

    simulationEvents.on(
      GameEventType.PRODUCTION_OUTPUT_GENERATED,
      (data: {
        zoneId: string;
        resource: string;
        amount: number;
        workers: string[];
        timestamp?: number;
      }) => {
        this.recordEvent({
          timestamp: Date.now(),
          type: GovernanceEventType.PRODUCTION_GENERATED,
          details: {
            zoneId: data.zoneId,
            resource: data.resource,
            amount: data.amount,
            workerCount: data.workers.length,
          },
        });
        if (data.resource === ResourceType.FOOD && data.amount > 20) {
          for (const [_demandId, demand] of Array.from(
            this.demands.entries(),
          )) {
            if (
              demand.type === DemandType.FOOD_SHORTAGE &&
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
      GameEventType.PRODUCTION_WORKER_REMOVED,
      (data: {
        zoneId: string;
        agentId: string;
        reason: string;
        timestamp?: number;
      }) => {
        this.recordEvent({
          timestamp: Date.now(),
          type: GovernanceEventType.PRODUCTION_WORKER_LOST,
          details: {
            zoneId: data.zoneId,
            agentId: data.agentId,
            reason: data.reason,
          },
        });
        const recentLosses = this.history.filter(
          (e) =>
            e.type === GovernanceEventType.PRODUCTION_WORKER_LOST &&
            Date.now() - e.timestamp < 60000,
        );
        if (recentLosses.length >= 3) {
          this.createDemand(
            DemandType.HOUSING_FULL,
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
      type: GovernanceEventType.POLICY_CHANGED,
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
    const now = Date.now();

    // Check and resolve/create food demands
    const foodPolicy = this.policies.get(GovernancePolicyId.FOOD_SECURITY);
    if (foodPolicy?.enabled) {
      const foodThreshold = foodPolicy.threshold.foodPerCapita ?? 5;
      const activeFoodDemand = Array.from(this.demands.values()).find(
        (d) => d.type === DemandType.FOOD_SHORTAGE && !d.resolvedAt,
      );

      if (stats.foodPerCapita >= foodThreshold && activeFoodDemand) {
        // Resolve the demand when threshold is met
        activeFoodDemand.resolvedAt = now;
        this.recordEvent({
          timestamp: now,
          type: GovernanceEventType.DEMAND_RESOLVED,
          details: { demandId: activeFoodDemand.id, action: GovernanceProjectType.ASSIGN_HUNTERS },
        });
        logger.info(
          `🏛️ [GOVERNANCE] Food shortage resolved: foodPerCapita=${stats.foodPerCapita.toFixed(1)} >= ${foodThreshold}`,
        );
      } else if (stats.foodPerCapita < foodThreshold && !activeFoodDemand) {
        this.createDemand(
          DemandType.FOOD_SHORTAGE,
          8,
          "Reservas de comida bajas",
          {
            foodPerCapita: stats.foodPerCapita,
            population: stats.population,
          },
        );
      }
    }

    // Check and resolve/create water demands
    const waterPolicy = this.policies.get(GovernancePolicyId.WATER_SUPPLY);
    if (waterPolicy?.enabled) {
      const waterEmergencyThreshold = waterPolicy.threshold.waterPerCapita ?? 8;
      // Resolution threshold is higher to ensure preventive storage
      const waterSafeThreshold = 15;
      const activeWaterDemand = Array.from(this.demands.values()).find(
        (d) => d.type === DemandType.WATER_SHORTAGE && !d.resolvedAt,
      );

      if (stats.waterPerCapita >= waterSafeThreshold && activeWaterDemand) {
        // Resolve the demand only when safe storage threshold is met
        activeWaterDemand.resolvedAt = now;
        this.recordEvent({
          timestamp: now,
          type: GovernanceEventType.DEMAND_RESOLVED,
          details: { demandId: activeWaterDemand.id, action: GovernanceProjectType.GATHER_WATER },
        });
        logger.info(
          `🏛️ [GOVERNANCE] Water shortage resolved: waterPerCapita=${stats.waterPerCapita.toFixed(1)} >= ${waterSafeThreshold} (safe storage)`,
        );
      } else if (stats.waterPerCapita < waterEmergencyThreshold && !activeWaterDemand) {
        this.createDemand(
          DemandType.WATER_SHORTAGE,
          9,
          "Reservas de agua bajas",
          {
            waterPerCapita: stats.waterPerCapita,
            population: stats.population,
          },
        );
      }
    }

    const housingPolicy = this.policies.get(
      GovernancePolicyId.HOUSING_EXPANSION,
    );
    if (housingPolicy?.enabled) {
      if (
        stats.housingOccupancy >
        (housingPolicy.threshold.housingOccupancy ?? 0.8)
      ) {
        this.createDemand(DemandType.HOUSING_FULL, 7, "Viviendas casi llenas", {
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
      type: GovernanceEventType.DEMAND_CREATED,
      details: {
        demandId: demand.id,
        demandType: type,
        priority: modifiedPriority,
      },
    });

    logger.debug(
      `🏛️ [GOVERNANCE] Demand created: ${type} (priority: ${modifiedPriority}) - ${reason}`,
    );

    // Push updated snapshot so AISystem can see the new demand
    this.pushSnapshot();

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
          type: GovernanceEventType.PROJECT_FAILED,
          details: { demandId: demand.id, reason: "insufficient_resources" },
        });
        return;
      }
      const consumed = this.reservationSystem.consume(reservationId);
      if (!consumed) {
        return;
      }
    }

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

    // Resource shortage demands (FOOD_SHORTAGE, WATER_SHORTAGE) are NOT resolved immediately
    // because they require agents to gather resources over time.
    // They will be resolved when the policy condition is met again (e.g., waterPerCapita >= threshold).
    const ongoingDemandTypes = [DemandType.FOOD_SHORTAGE, DemandType.WATER_SHORTAGE];
    if (!ongoingDemandTypes.includes(demand.type)) {
      demand.resolvedAt = Date.now();
      this.recordEvent({
        timestamp: demand.resolvedAt,
        type: GovernanceEventType.DEMAND_RESOLVED,
        details: { demandId: demand.id, action: solution.project },
      });
    } else {
      logger.debug(
        `🏛️ [GOVERNANCE] Demand ${demand.type} is ongoing (roles assigned, awaiting resource collection)`,
      );
    }

    simulationEvents.emit(GameEventType.GOVERNANCE_ACTION, {
      demandId: demand.id,
      action: solution.project,
      cost: solution.cost,
      timestamp: Date.now(),
    } as {
      demandId: string;
      action: GovernanceProjectType;
      cost: ResourceCost;
      timestamp: number;
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
    type AgentWithTraits = {
      id: string;
      isDead?: boolean;
      ageYears?: number;
      traits?: {
        diligence?: number;
        neuroticism?: number;
        curiosity?: number;
        cooperation?: number;
      };
    };
    const agents: AgentWithTraits[] = [];
    if (this.agentRegistry) {
      for (const profile of this.agentRegistry.getAllProfiles()) {
        if (!profile.isDead && (profile.ageYears ?? 0) >= 16) {
          agents.push(profile);
        }
      }
    } else if (this.state.agents) {
      for (const a of this.state.agents) {
        if (!a.isDead && (a.ageYears ?? 0) >= 16) {
          agents.push(a as AgentWithTraits);
        }
      }
    }

    if (agents.length === 0) return 0;

    const scoredAgents = agents.map((agent) => {
      const currentRole = this.roleSystem.getAgentRole(agent.id);

      if (currentRole?.roleType === targetRole) {
        return { agent, score: -1 };
      }

      let score = 0;

      if (!currentRole || currentRole.roleType === RoleTypeEnum.IDLE) {
        score += 50;
      }

      if (currentRole && currentRole.satisfaction < 0.4) {
        score += 20;
      }

      const traits = agent.traits ?? {};

      switch (targetRole) {
        case RoleTypeEnum.HUNTER:
          score += (traits.diligence ?? 0.5) * 30;
          score += (traits.neuroticism ?? 0.3) * 15;
          break;
        case RoleTypeEnum.GATHERER:
          score += (traits.curiosity ?? 0.5) * 25;
          score += (traits.cooperation ?? 0.5) * 15;
          break;
        case RoleTypeEnum.BUILDER:
          score += (traits.diligence ?? 0.5) * 25;
          score += (traits.cooperation ?? 0.5) * 25;
          break;
        case RoleTypeEnum.FARMER:
          score += (traits.diligence ?? 0.5) * 30;
          score += (traits.curiosity ?? 0.5) * 10;
          break;
        case RoleTypeEnum.LOGGER:
        case RoleTypeEnum.QUARRYMAN:
          score += (traits.diligence ?? 0.5) * 35;
          break;
        case RoleTypeEnum.GUARD:
          score += (traits.cooperation ?? 0.5) * 25;
          score += (traits.diligence ?? 0.5) * 20;
          break;
      }

      return { agent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);

    let assignedCount = 0;
    for (const { agent, score } of scoredAgents) {
      if (assignedCount >= count) break;
      if (score < 0) continue;

      const result = this.roleSystem.reassignRole(agent.id, targetRole);
      if (result.success) {
        assignedCount++;
        this.recordEvent({
          timestamp: Date.now(),
          type: GovernanceEventType.ROLE_REASSIGNED,
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
      case DemandType.HOUSING_FULL:
        this.housingProjectsStarted += 1;
        break;
      case DemandType.FOOD_SHORTAGE:
        if (solution?.resourceBoost?.food) {
          resources.materials.food += solution.resourceBoost.food;
        }
        break;
      case DemandType.WATER_SHORTAGE:
        if (solution?.resourceBoost?.water) {
          resources.materials.water += solution.resourceBoost.water;
        }
        break;
      default:
        break;
    }
  }

  private applyDivineModifiers(_type: DemandType, priority: number): number {
    return priority;
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
      const status = entity.state;

      return status === EntityStatus.INACTIVE || status === undefined;
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

    // Debug: log demands in snapshot
    if (snapshot.demands.length > 0) {
      const demandTypes = snapshot.demands.map((d) => d.type).join(", ");
      logger.debug(`🏛️ [GOVERNANCE] Snapshot pushed: demands=[${demandTypes}]`);
    }

    simulationEvents.emit(GameEventType.GOVERNANCE_UPDATE, snapshot);
  }
}
