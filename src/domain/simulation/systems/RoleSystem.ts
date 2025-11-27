import { EventEmitter } from "node:events";
import { logger } from "@/infrastructure/utils/logger";
import type { GameState } from "../../types/game-types";
import type { AgentProfile } from "../../types/simulation/agents";
import type {
  RoleType,
  RoleConfig,
  AgentRole,
  ShiftSchedule,
  RoleAssignment,
  RoleSystemConfig,
} from "../../types/simulation/roles";
import {
  WorkShift,
  RoleType as RoleTypeEnum,
} from "../../../shared/constants/RoleEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { ZoneType } from "../../../shared/constants/ZoneEnums";
import { simulationEvents, GameEventType } from "../core/events";
import type { AgentRegistry } from "../core/AgentRegistry";

const ROLE_DEFINITIONS: RoleConfig[] = [
  {
    type: RoleTypeEnum.LOGGER,
    name: "Leñador",
    description: "Recolecta madera del bosque",
    primaryResource: ResourceType.WOOD,
    requirements: {
      minAge: 16,
      traits: { diligence: 0.4 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, cooperation: 0.1 },
    },
    preferredZoneType: ZoneType.WORK,
    workShifts: [WorkShift.MORNING, WorkShift.AFTERNOON],
  },
  {
    type: RoleTypeEnum.QUARRYMAN,
    name: "Cantero",
    description: "Extrae piedra de la cantera",
    primaryResource: ResourceType.STONE,
    requirements: {
      minAge: 18,
      traits: { diligence: 0.5 },
    },
    efficiency: {
      base: 0.5,
      traitBonus: { diligence: 0.4, cooperation: 0.1 },
    },
    preferredZoneType: ZoneType.WORK,
    workShifts: [WorkShift.MORNING, WorkShift.AFTERNOON],
  },
  {
    type: RoleTypeEnum.BUILDER,
    name: "Constructor",
    description: "Construye y repara edificios",
    primaryResource: undefined,
    requirements: {
      minAge: 20,
      traits: { diligence: 0.5, cooperation: 0.4 },
    },
    efficiency: {
      base: 0.7,
      traitBonus: { diligence: 0.2, cooperation: 0.3, curiosity: 0.1 },
    },
    preferredZoneType: ZoneType.WORK,
    workShifts: [WorkShift.MORNING, WorkShift.AFTERNOON, WorkShift.EVENING],
  },
  {
    type: RoleTypeEnum.FARMER,
    name: "Granjero",
    description: "Cultiva alimentos",
    primaryResource: ResourceType.FOOD,
    requirements: {
      minAge: 16,
      traits: { diligence: 0.3 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, curiosity: 0.2 },
    },
    preferredZoneType: ZoneType.FOOD,
    workShifts: [WorkShift.MORNING, WorkShift.AFTERNOON],
  },
  {
    type: RoleTypeEnum.GATHERER,
    name: "Recolector",
    description: "Recolecta agua y recursos básicos",
    primaryResource: ResourceType.WATER,
    requirements: {
      minAge: 14,
      traits: {},
    },
    efficiency: {
      base: 0.7,
      traitBonus: { curiosity: 0.2, cooperation: 0.1 },
    },
    preferredZoneType: ZoneType.WATER,
    workShifts: [WorkShift.MORNING, WorkShift.AFTERNOON, WorkShift.EVENING],
  },
  {
    type: RoleTypeEnum.GUARD,
    name: "Guardián",
    description: "Protege el asentamiento",
    primaryResource: undefined,
    requirements: {
      minAge: 20,
      traits: { cooperation: 0.5 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { cooperation: 0.3, diligence: 0.2 },
    },
    preferredZoneType: ZoneType.REST,
    workShifts: [WorkShift.EVENING, WorkShift.NIGHT],
  },
  {
    type: RoleTypeEnum.HUNTER,
    name: "Cazador",
    description: "Caza animales para obtener carne y pieles",
    primaryResource: ResourceType.FOOD,
    requirements: {
      minAge: 18,
      traits: { diligence: 0.4, neuroticism: 0.3 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, neuroticism: 0.2 },
    },
    preferredZoneType: ZoneType.WILD,
    workShifts: [WorkShift.MORNING, WorkShift.EVENING, WorkShift.NIGHT],
  },
];

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class RoleSystem extends EventEmitter {
  private gameState: GameState;
  private config: RoleSystemConfig;
  private roles = new Map<string, AgentRole>();
  private schedule: ShiftSchedule = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
    rest: [],
  };
  private currentShift: WorkShift = WorkShift.MORNING;
  private lastUpdate = Date.now();
  private lastStatsUpdate = 0;
  private lastReassignment = 0;
  private agentRegistry?: AgentRegistry;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.AgentRegistry) @optional() agentRegistry?: AgentRegistry,
  ) {
    super();
    this.gameState = gameState;
    this.agentRegistry = agentRegistry;
    this.config = {
      autoAssignRoles: true,
      reassignmentIntervalSec: 15,
      experienceGainPerSecond: 0.001,
      satisfactionDecayPerSecond: 0.0005,
    };

    const now = Date.now();
    this.lastUpdate = now;
    this.lastStatsUpdate = now;
    this.lastReassignment = now;

    logger.info("👷 RoleSystem (Backend) initialized");
  }

  public update(_delta: number): void {
    void _delta;
    void _delta;
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    if (dt < 1) return;
    this.lastUpdate = now;

    if (now - this.lastStatsUpdate > 10000) {
      const dtStats = (now - this.lastStatsUpdate) / 1000;
      this.updateRoleStats(dtStats);
      this.lastStatsUpdate = now;
    }

    if (
      this.config.autoAssignRoles &&
      now - this.lastReassignment > this.config.reassignmentIntervalSec * 1000
    ) {
      this.autoAssignRoles();
      this.lastReassignment = now;
    }
  }

  private updateRoleStats(dt: number): void {
    for (const role of this.roles.values()) {
      if (
        role.currentShift === this.currentShift &&
        role.currentShift !== "rest"
      ) {
        role.experience = Math.min(
          1,
          role.experience + this.config.experienceGainPerSecond * dt,
        );
      }

      role.satisfaction = Math.max(
        0,
        role.satisfaction - this.config.satisfactionDecayPerSecond * dt,
      );
    }
  }

  public updateCurrentShift(timePhase: WorkShift): void {
    if (this.currentShift !== timePhase && timePhase !== "rest") {
      const previousShift = this.currentShift;
      this.currentShift = timePhase as WorkShift;
      this.rebuildSchedule();

      this.emit("shiftChanged", {
        previous: previousShift,
        current: this.currentShift,
      });

      simulationEvents.emit(GameEventType.ROLE_SHIFT_CHANGED, {
        previousShift,
        currentShift: this.currentShift,
        agentsInShift: this.schedule[this.currentShift],
        timestamp: Date.now(),
      });
    }
  }

  private rebuildSchedule(): void {
    this.schedule = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      rest: [],
    };

    this.roles.forEach((role, agentId) => {
      const config = this.getRoleConfig(role.roleType);
      if (!config) return;

      config.workShifts.forEach((shift: WorkShift) => {
        if (!this.schedule[shift].includes(agentId)) {
          this.schedule[shift].push(agentId);
        }
      });

      if (config.workShifts.includes(this.currentShift)) {
        role.currentShift = this.currentShift;
      } else {
        role.currentShift = WorkShift.REST;
        if (!this.schedule.rest.includes(agentId)) {
          this.schedule.rest.push(agentId);
        }
      }
    });
  }

  private autoAssignRoles(): void {
    const agents = this.getAdultAgents();
    const pop = agents.length;
    const minHunters = Math.max(1, Math.ceil(pop * 0.1));
    const minLoggers = Math.max(1, Math.ceil(pop * 0.15));
    const minQuarrymen = Math.max(1, Math.ceil(pop * 0.1));

    const countRole = (roleType: string): number =>
      Array.from(this.roles.values()).filter((r) => r.roleType === roleType)
        .length;

    agents.forEach((agent) => {
      if (!this.roles.has(agent.id)) {
        const currentLoggers = countRole(RoleTypeEnum.LOGGER);
        const currentQuarrymen = countRole(RoleTypeEnum.QUARRYMAN);
        const currentHunters = countRole(RoleTypeEnum.HUNTER);

        if (currentLoggers < minLoggers) {
          const loggerConfig = ROLE_DEFINITIONS.find(
            (r) => r.type === RoleTypeEnum.LOGGER,
          );
          if (loggerConfig && this.meetsRequirements(agent, loggerConfig)) {
            const result = this.reassignRole(agent.id, RoleTypeEnum.LOGGER);
            if (result.success) {
              logger.info(`🪓 Auto-assigned logger (wood): ${agent.id}`);
              return;
            }
          }
        }

        if (currentQuarrymen < minQuarrymen) {
          const quarrymanConfig = ROLE_DEFINITIONS.find(
            (r) => r.type === RoleTypeEnum.QUARRYMAN,
          );
          if (
            quarrymanConfig &&
            this.meetsRequirements(agent, quarrymanConfig)
          ) {
            const result = this.reassignRole(agent.id, RoleTypeEnum.QUARRYMAN);
            if (result.success) {
              logger.info(`⛏️ Auto-assigned quarryman (stone): ${agent.id}`);
              return;
            }
          }
        }

        if (currentHunters < minHunters) {
          const hunterConfig = ROLE_DEFINITIONS.find(
            (r) => r.type === RoleTypeEnum.HUNTER,
          );
          if (hunterConfig && this.meetsRequirements(agent, hunterConfig)) {
            const result = this.reassignRole(agent.id, RoleTypeEnum.HUNTER);
            if (result.success) {
              logger.info(`🎯 Auto-assigned hunter: ${agent.id}`);
              return;
            }
          }
        }

        this.assignBestRole(agent);
      }
    });

    this.ensureMinimumRole(
      RoleTypeEnum.LOGGER,
      minLoggers,
      agents,
      "🪓 Forced logger",
    );
    this.ensureMinimumRole(
      RoleTypeEnum.QUARRYMAN,
      minQuarrymen,
      agents,
      "⛏️ Forced quarryman",
    );
    this.ensureMinimumRole(
      RoleTypeEnum.HUNTER,
      minHunters,
      agents,
      "🎯 Forced hunter",
    );
  }

  private ensureMinimumRole(
    roleType: string,
    minCount: number,
    agents: AgentProfile[],
    logPrefix: string,
  ): void {
    let currentCount = Array.from(this.roles.values()).filter(
      (r) => r.roleType === roleType,
    ).length;

    if (currentCount >= minCount) return;

    const roleConfig = ROLE_DEFINITIONS.find((r) => r.type === roleType);
    if (!roleConfig) return;

    for (const agent of agents) {
      if (currentCount >= minCount) break;

      const currentRole = this.roles.get(agent.id);
      if (currentRole?.roleType === roleType) continue;

      if (
        currentRole?.roleType === RoleTypeEnum.LOGGER ||
        currentRole?.roleType === RoleTypeEnum.QUARRYMAN
      ) {
        continue;
      }

      if (this.meetsRequirements(agent, roleConfig)) {
        const prevRole = currentRole?.roleType ?? "none";
        const result = this.reassignRole(agent.id, roleType as RoleType);
        if (result.success) {
          logger.info(`${logPrefix}: ${agent.id} (was ${prevRole})`);
          currentCount++;
        }
      }
    }
  }

  private getAdultAgents(): AgentProfile[] {
    if (this.agentRegistry) {
      const agents: AgentProfile[] = [];
      for (const profile of this.agentRegistry.getAllProfiles()) {
        if (!profile.isDead) {
          agents.push(profile);
        }
      }
      return agents;
    }

    return (this.gameState.agents || []).filter((a) => !a.isDead);
  }

  public assignBestRole(agent: AgentProfile): RoleAssignment {
    let bestRole: RoleConfig | null = null;
    let bestScore = -1;

    ROLE_DEFINITIONS.forEach((roleDef) => {
      if (!this.meetsRequirements(agent, roleDef)) return;

      const currentWorkers = Array.from(this.roles.values()).filter(
        (r) => r.roleType === roleDef.type,
      ).length;
      const maxSlots = this.getMaxSlotsForRole(roleDef.type);

      if (currentWorkers >= maxSlots) {
        return;
      }

      const score = this.calculateRoleScore(agent, roleDef);
      if (score > bestScore) {
        bestScore = score;
        bestRole = roleDef;
      }
    });

    if (!bestRole) {
      return {
        success: false,
        agentId: agent.id,
        reason: "No role requirements met or all roles full",
      };
    }

    const selectedRole: RoleConfig = bestRole;
    const efficiency = this.calculateEfficiency(agent, selectedRole);
    const role: AgentRole = {
      agentId: agent.id,
      roleType: selectedRole.type,
      assignedAt: Date.now(),
      currentShift: this.currentShift,
      efficiency,
      experience: 0,
      satisfaction: 0.7,
    };

    this.roles.set(agent.id, role);
    this.rebuildSchedule();

    logger.info(
      `👷 Role assigned: ${agent.name || agent.id} → ${selectedRole.name}`,
    );

    simulationEvents.emit(GameEventType.ROLE_ASSIGNED, {
      agentId: agent.id,
      roleType: selectedRole.type,
      roleName: selectedRole.name,
      efficiency: role.efficiency,
      timestamp: Date.now(),
    });

    return { success: true, agentId: agent.id, roleType: selectedRole.type };
  }

  private meetsRequirements(agent: AgentProfile, role: RoleConfig): boolean {
    const req = role.requirements;
    if (req.minAge && agent.ageYears < req.minAge) return false;
    if (req.forbiddenFor?.includes(agent.id)) return false;
    if (req.traits) {
      if (
        req.traits.cooperation &&
        agent.traits.cooperation < req.traits.cooperation
      )
        return false;
      if (req.traits.diligence && agent.traits.diligence < req.traits.diligence)
        return false;
      if (req.traits.curiosity && agent.traits.curiosity < req.traits.curiosity)
        return false;
    }
    return true;
  }

  private calculateRoleScore(agent: AgentProfile, role: RoleConfig): number {
    let score = role.efficiency.base;
    const bonus = role.efficiency.traitBonus;
    if (bonus.cooperation)
      score += agent.traits.cooperation * bonus.cooperation;
    if (bonus.diligence) score += agent.traits.diligence * bonus.diligence;
    if (bonus.curiosity) score += agent.traits.curiosity * bonus.curiosity;
    if (bonus.neuroticism)
      score += (agent.traits.neuroticism ?? 0) * bonus.neuroticism;
    return score;
  }

  private calculateEfficiency(agent: AgentProfile, role: RoleConfig): number {
    return Math.min(1, this.calculateRoleScore(agent, role));
  }

  private getMaxSlotsForRole(roleType: string): number {
    const limits: Partial<Record<RoleType, number>> = {
      [RoleTypeEnum.LOGGER]: 10,
      [RoleTypeEnum.QUARRYMAN]: 10,
      [RoleTypeEnum.BUILDER]: 5,
      [RoleTypeEnum.FARMER]: 10,
      [RoleTypeEnum.GATHERER]: 15,
      [RoleTypeEnum.GUARD]: 8,
      [RoleTypeEnum.HUNTER]: 10,
    };
    return limits[roleType as RoleType] || 5;
  }

  public getAgentRole(agentId: string): AgentRole | undefined {
    return this.roles.get(agentId);
  }

  public getPreferredResourceForRole(roleType: string): string | undefined {
    const roleDef = ROLE_DEFINITIONS.find((r) => r.type === roleType);
    return roleDef?.primaryResource;
  }

  public getRoleConfig(roleType: string): RoleConfig | undefined {
    return ROLE_DEFINITIONS.find((r) => r.type === roleType);
  }

  public getAgentsInShift(shift: WorkShift): string[] {
    return this.schedule[shift] || [];
  }

  public getCurrentShift(): WorkShift {
    return this.currentShift;
  }

  public getAllRoles(): AgentRole[] {
    return Array.from(this.roles.values());
  }

  public getRoleEfficiency(agentId: string): number {
    const role = this.roles.get(agentId);
    if (!role) return 0.5;
    return Math.min(1, role.efficiency + role.experience * 0.2);
  }

  public reassignRole(agentId: string, newRole: RoleType): RoleAssignment {
    let agent: AgentProfile | undefined;
    if (this.agentRegistry) {
      agent = this.agentRegistry.getProfile(agentId);
    } else {
      const agents = this.getAdultAgents();
      agent = agents.find((a) => a.id === agentId);
    }
    if (!agent) return { success: false, agentId, reason: "Agent not found" };

    const roleDef = ROLE_DEFINITIONS.find((r) => r.type === newRole);
    if (!roleDef) return { success: false, agentId, reason: "Invalid role" };
    if (!this.meetsRequirements(agent, roleDef)) {
      return { success: false, agentId, reason: "Requirements not met" };
    }

    const efficiency = this.calculateEfficiency(agent, roleDef);
    const existing = this.roles.get(agentId);
    const role: AgentRole = {
      agentId,
      roleType: newRole,
      assignedAt: Date.now(),
      currentShift: this.currentShift,
      efficiency,
      experience: existing?.experience || 0,
      satisfaction: 0.5,
    };

    this.roles.set(agentId, role);
    this.rebuildSchedule();

    logger.info(`👷 Role reassigned: ${agentId} → ${roleDef.name}`);

    simulationEvents.emit(GameEventType.ROLE_REASSIGNED, {
      agentId,
      previousRole: existing?.roleType,
      newRole: newRole,
      roleName: roleDef.name,
      efficiency: role.efficiency,
      timestamp: Date.now(),
    });

    return { success: true, agentId, roleType: newRole };
  }

  /**
   * Gets the current distribution of roles in the population.
   * Returns count and percentage for each role type.
   */
  public getRoleDistribution(): Record<
    RoleType,
    { count: number; percentage: number }
  > {
    const distribution: Partial<
      Record<RoleType, { count: number; percentage: number }>
    > = {} as Partial<Record<RoleType, { count: number; percentage: number }>>;
    const totalAgents = this.roles.size;

    for (const roleConfig of ROLE_DEFINITIONS) {
      distribution[roleConfig.type] = { count: 0, percentage: 0 };
    }

    distribution.idle = { count: 0, percentage: 0 };
    distribution.craftsman = { count: 0, percentage: 0 };
    distribution.leader = { count: 0, percentage: 0 };

    for (const role of this.roles.values()) {
      if (distribution[role.roleType]) {
        distribution[role.roleType]!.count++;
      }
    }

    const result: Record<RoleType, { count: number; percentage: number }> =
      {} as Record<RoleType, { count: number; percentage: number }>;
    for (const roleType in distribution) {
      const dist = distribution[roleType as RoleType];
      if (dist) {
        result[roleType as RoleType] = {
          count: dist.count,
          percentage: totalAgents > 0 ? dist.count / totalAgents : 0,
        };
      } else {
        result[roleType as RoleType] = { count: 0, percentage: 0 };
      }
    }

    return result;
  }

  /**
   * Calculates needed roles based on community resource state.
   * Returns the target number of agents for each role.
   *
   * @param collectiveState - Current state of community resources
   */
  public calculateNeededRoles(collectiveState: {
    foodPerCapita: number;
    waterPerCapita: number;
    totalWood: number;
    totalStone: number;
    population: number;
  }): Record<RoleType, number> {
    const needed: Partial<Record<RoleType, number>> = {} as Partial<
      Record<RoleType, number>
    >;
    const pop = collectiveState.population;

    const baseDistribution: Record<RoleType, number> = {
      [RoleTypeEnum.LOGGER]: 0.15,
      [RoleTypeEnum.QUARRYMAN]: 0.1,
      [RoleTypeEnum.BUILDER]: 0.15,
      [RoleTypeEnum.FARMER]: 0.15,
      [RoleTypeEnum.GATHERER]: 0.15,
      [RoleTypeEnum.GUARD]: 0.1,
      [RoleTypeEnum.HUNTER]: 0.1,
      [RoleTypeEnum.CRAFTSMAN]: 0.05,
      [RoleTypeEnum.LEADER]: 0.03,
      [RoleTypeEnum.IDLE]: 0.02,
    };

    if (collectiveState.foodPerCapita < 8) {
      baseDistribution[RoleTypeEnum.FARMER] += 0.1;
      baseDistribution[RoleTypeEnum.HUNTER] += 0.05;
      baseDistribution[RoleTypeEnum.BUILDER] -= 0.05;
      baseDistribution[RoleTypeEnum.CRAFTSMAN] -= 0.05;
      baseDistribution[RoleTypeEnum.GUARD] -= 0.05;
    }

    if (collectiveState.waterPerCapita < 12) {
      baseDistribution[RoleTypeEnum.GATHERER] += 0.1;
      baseDistribution[RoleTypeEnum.CRAFTSMAN] -= 0.05;
      baseDistribution[RoleTypeEnum.GUARD] -= 0.05;
    }

    if (collectiveState.totalWood < 80) {
      baseDistribution[RoleTypeEnum.LOGGER] += 0.1;
      baseDistribution[RoleTypeEnum.FARMER] -= 0.05;
      baseDistribution[RoleTypeEnum.HUNTER] -= 0.05;
    }

    if (collectiveState.totalStone < 40) {
      baseDistribution[RoleTypeEnum.QUARRYMAN] += 0.1;
      baseDistribution[RoleTypeEnum.FARMER] -= 0.05;
      baseDistribution[RoleTypeEnum.HUNTER] -= 0.05;
    }

    for (const roleType in baseDistribution) {
      needed[roleType as RoleType] = Math.ceil(
        pop * baseDistribution[roleType as RoleType],
      );
    }

    return needed as Record<RoleType, number>;
  }

  /**
   * Rebalances roles to match community needs.
   * Only reassigns agents who are significantly mismatched.
   * Limits the number of changes per call to avoid disruption.
   *
   * @param collectiveState - Current state of community resources
   */
  public rebalanceRoles(collectiveState: {
    foodPerCapita: number;
    waterPerCapita: number;
    totalWood: number;
    totalStone: number;
    population: number;
  }): void {
    const current = this.getRoleDistribution();
    const needed = this.calculateNeededRoles(collectiveState);

    const changes: Array<{
      agentId: string;
      currentRole: RoleType;
      newRole: RoleType;
      score: number;
    }> = [];

    const rolesNeedingMore: RoleType[] = [];
    const rolesWithExtra: RoleType[] = [];

    for (const roleType in needed) {
      const rt = roleType as RoleType;
      const deficit = needed[rt] - current[rt].count;

      if (deficit > 0) {
        rolesNeedingMore.push(rt);
      } else if (deficit < -1) {
        rolesWithExtra.push(rt);
      }
    }

    if (rolesNeedingMore.length === 0) return;

    for (const [agentId, role] of this.roles.entries()) {
      if (!rolesWithExtra.includes(role.roleType)) continue;

      const agent = this.agentRegistry
        ? this.agentRegistry.getProfile(agentId)
        : this.gameState.agents?.find((a) => a.id === agentId);
      if (!agent) continue;

      for (const neededRole of rolesNeedingMore) {
        const roleConfig = ROLE_DEFINITIONS.find((r) => r.type === neededRole);
        if (!roleConfig || !this.meetsRequirements(agent, roleConfig)) continue;

        const score = this.calculateRoleScore(agent, roleConfig);

        changes.push({
          agentId,
          currentRole: role.roleType,
          newRole: neededRole,
          score,
        });
      }
    }

    changes.sort((a, b) => b.score - a.score);

    const MAX_CHANGES_PER_REBALANCE = 3;
    for (
      let i = 0;
      i < Math.min(MAX_CHANGES_PER_REBALANCE, changes.length);
      i++
    ) {
      const change = changes[i];
      this.reassignRole(change.agentId, change.newRole);

      logger.info(
        `🔄 Rebalanced role: ${change.agentId} ${change.currentRole} -> ${change.newRole} (score: ${change.score.toFixed(2)})`,
      );

      simulationEvents.emit(GameEventType.ROLE_REBALANCED, {
        agentId: change.agentId,
        previousRole: change.currentRole,
        newRole: change.newRole,
        score: change.score,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Removes an agent's role when they die or are removed.
   * Cleans up role data and schedule entries.
   *
   * @param agentId - The ID of the agent to remove
   */
  public removeAgentRole(agentId: string): void {
    const role = this.roles.get(agentId);
    if (!role) return;

    this.roles.delete(agentId);

    for (const shift of Object.keys(this.schedule) as WorkShift[]) {
      const idx = this.schedule[shift].indexOf(agentId);
      if (idx !== -1) {
        this.schedule[shift].splice(idx, 1);
      }
    }

    logger.debug(`👷 Role removed for dead agent: ${agentId}`);
  }
}
