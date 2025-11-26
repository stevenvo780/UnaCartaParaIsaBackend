import type { GameState } from "../../../../types/game-types";
import type { RoleSystem } from "../../RoleSystem";
import { logger } from "@/infrastructure/utils/logger";

export type GoalDomain =
  | "survival"
  | "work"
  | "social"
  | "crafting"
  | "combat"
  | "flee"
  | "explore"
  | "logistics"
  | "rest"
  | "inspect";

/**
 * Priority weights for different goal domains.
 * Higher weights increase the priority of goals in that domain.
 */
export interface DomainWeights {
  survival: number;
  work: number;
  social: number;
  crafting: number;
  combat: number;
  flee: number;
  explore: number;
  logistics: number;
  rest: number;
  inspect: number;
}

/**
 * Configuration for priority manager.
 */
export interface PriorityManagerConfig {
  weights?: Partial<DomainWeights>;
}

/**
 * Manages priority weights for different goal domains.
 *
 * Adjusts priorities based on:
 * - Role-based weights
 * - Resource scarcity (boosts survival/logistics when resources are low)
 * - Agent-specific configurations
 *
 * Used by AgentGoalPlanner to determine which goals are most important.
 */
export class PriorityManager {
  private gameState: GameState;
  private roleSystem?: RoleSystem;
  private weights: DomainWeights = {
    survival: 1.0,
    work: 0.6,
    social: 0.45,
    crafting: 0.65,
    combat: 0.7,
    flee: 1.1,
    explore: 0.3,
    logistics: 0.55,
    rest: 0.8,
    inspect: 0.25,
  };

  constructor(
    gameState: GameState,
    config?: PriorityManagerConfig,
    roleSystem?: RoleSystem,
  ) {
    this.gameState = gameState;
    this.roleSystem = roleSystem;

    if (config?.weights) {
      this.weights = { ...this.weights, ...config.weights };
    }
  }

  public setWeights(newWeights: Partial<DomainWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  public getWeights(): DomainWeights {
    return { ...this.weights };
  }

  /**
   * Adjusts a base priority value based on domain weights and resource scarcity.
   *
   * @param agentId - Agent identifier (for future role-based adjustments)
   * @param domain - Goal domain category
   * @param basePriority - Base priority value (0-1)
   * @returns Adjusted priority value
   */
  public adjust(
    agentId: string,
    domain: GoalDomain,
    basePriority: number,
  ): number {
    const w = this.weights[domain] ?? 1;
    let adjusted = basePriority * w;

    try {
      const res = this.gameState.resources?.materials;
      if (res) {
        const scarceWater = (res.water ?? 0) < 8;
        const scarceFood = (res.food ?? 0) < 8;

        if (scarceWater || scarceFood) {
          if (domain === "survival") adjusted *= 1.3;
          if (domain === "logistics") adjusted *= 1.2;
        }

        const scarceWood = (res.wood ?? 0) < 10;
        const scarceStone = (res.stone ?? 0) < 10;

        if (scarceWood || scarceStone) {
          if (domain === "work") adjusted *= 1.15;
          if (domain === "logistics") adjusted *= 1.15;
        }
      }
    } catch (error) {
      logger.warn("[PriorityManager] Failed to adjust for resource scarcity", {
        error,
        agentId,
        domain,
      });
    }

    try {
      const role = this.roleSystem?.getAgentRole(agentId);
      const isWarrior = role?.roleType === "guard";

      if (isWarrior) {
        if (domain === "combat") adjusted *= 1.25;
        if (domain === "crafting") adjusted *= 1.15;
      } else {
        if (domain === "flee") adjusted *= 1.2;
        if (domain === "combat") adjusted *= 0.8;
      }
    } catch (error: unknown) {
      logger.warn("[PriorityManager] Failed to adjust for role", {
        error,
        agentId,
        domain,
      });
    }

    return adjusted;
  }

  public setRoleSystem(roleSystem: RoleSystem): void {
    this.roleSystem = roleSystem;
  }
}
