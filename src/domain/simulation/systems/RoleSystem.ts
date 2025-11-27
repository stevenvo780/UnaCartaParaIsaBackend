import { EventEmitter } from "node:events";
import { logger } from "@/infrastructure/utils/logger";
import type { GameState } from "../../types/game-types";
import type { AgentProfile } from "../../types/simulation/agents";
import type {
  RoleType,
  WorkShift,
  RoleConfig,
  AgentRole,
  ShiftSchedule,
  RoleAssignment,
  RoleSystemConfig,
} from "../../types/simulation/roles";
import { simulationEvents, GameEventNames } from "../core/events";

const ROLE_DEFINITIONS: RoleConfig[] = [
  {
    type: "logger" as RoleType,
    name: "Leñador",
    description: "Recolecta madera del bosque",
    primaryResource: "wood",
    requirements: {
      minAge: 16,
      traits: { diligence: 0.4 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, cooperation: 0.1 },
    },
    preferredZoneType: "work",
    workShifts: ["morning", "afternoon"],
  },
  {
    type: "quarryman" as RoleType,
    name: "Cantero",
    description: "Extrae piedra de la cantera",
    primaryResource: "stone",
    requirements: {
      minAge: 18,
      traits: { diligence: 0.5 },
    },
    efficiency: {
      base: 0.5,
      traitBonus: { diligence: 0.4, cooperation: 0.1 },
    },
    preferredZoneType: "work",
    workShifts: ["morning", "afternoon"],
  },
  {
    type: "builder" as RoleType,
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
    preferredZoneType: "work",
    workShifts: ["morning", "afternoon", "evening"],
  },
  {
    type: "farmer" as RoleType,
    name: "Granjero",
    description: "Cultiva alimentos",
    primaryResource: "food",
    requirements: {
      minAge: 16,
      traits: { diligence: 0.3 },
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, curiosity: 0.2 },
    },
    preferredZoneType: "food",
    workShifts: ["morning", "afternoon"],
  },
  {
    type: "gatherer" as RoleType,
    name: "Recolector",
    description: "Recolecta agua y recursos básicos",
    primaryResource: "water",
    requirements: {
      minAge: 14,
      traits: {},
    },
    efficiency: {
      base: 0.7,
      traitBonus: { curiosity: 0.2, cooperation: 0.1 },
    },
    preferredZoneType: "water",
    workShifts: ["morning", "afternoon", "evening"],
  },
  {
    type: "guard" as RoleType,
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
    preferredZoneType: "rest",
    workShifts: ["evening", "night"],
  },
  {
    type: "hunter" as RoleType,
    name: "Cazador",
    description: "Caza animales para obtener carne y pieles",
    primaryResource: "food",
    requirements: {
      minAge: 18,
      traits: { diligence: 0.4, neuroticism: 0.3 }, // Neuroticism helps with alertness
    },
    efficiency: {
      base: 0.6,
      traitBonus: { diligence: 0.3, neuroticism: 0.2 },
    },
    preferredZoneType: "wild",
    workShifts: ["morning", "evening", "night"],
  },
];

import { injectable, inject } from "inversify";
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
  private currentShift: WorkShift = "morning";
  private lastUpdate = Date.now();
  private lastStatsUpdate = 0;
  private lastReassignment = 0;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    super();
    this.gameState = gameState;
    this.config = {
      autoAssignRoles: true,
      reassignmentIntervalSec: 120,
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

  public updateCurrentShift(
    timePhase: "morning" | "afternoon" | "evening" | "night" | "rest",
  ): void {
    if (this.currentShift !== timePhase && timePhase !== "rest") {
      const previousShift = this.currentShift;
      this.currentShift = timePhase as WorkShift;
      this.rebuildSchedule();

      this.emit("shiftChanged", {
        previous: previousShift,
        current: this.currentShift,
      });

      simulationEvents.emit(GameEventNames.ROLE_SHIFT_CHANGED, {
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
        role.currentShift = "rest";
        if (!this.schedule.rest.includes(agentId)) {
          this.schedule.rest.push(agentId);
        }
      }
    });
  }

  private autoAssignRoles(): void {
    const agents = this.getAdultAgents();

    agents.forEach((agent) => {
      if (!this.roles.has(agent.id)) {
        this.assignBestRole(agent);
      }
    });
  }

  private getAdultAgents(): AgentProfile[] {
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
        reason: "No cumple requisitos de ningún rol o todos llenos",
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
      `👷 Rol asignado: ${agent.name || agent.id} → ${selectedRole.name}`,
    );

    simulationEvents.emit(GameEventNames.ROLE_ASSIGNED, {
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
    const limits: Record<string, number> = {
      logger: 10,
      quarryman: 10,
      builder: 5,
      farmer: 10,
      gatherer: 15,
      guard: 8,
      hunter: 10,
    };
    return limits[roleType] || 5;
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
    const agents = this.getAdultAgents();
    const agent = agents.find((a) => a.id === agentId);
    if (!agent)
      return { success: false, agentId, reason: "Agente no encontrado" };

    const roleDef = ROLE_DEFINITIONS.find((r) => r.type === newRole);
    if (!roleDef) return { success: false, agentId, reason: "Rol no válido" };
    if (!this.meetsRequirements(agent, roleDef)) {
      return { success: false, agentId, reason: "No cumple requisitos" };
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

    logger.info(`👷 Rol reasignado: ${agentId} → ${roleDef.name}`);

    simulationEvents.emit(GameEventNames.ROLE_REASSIGNED, {
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
