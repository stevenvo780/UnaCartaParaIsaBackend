import { performance } from "node:perf_hooks";
import type { TickRate, SchedulerStatsSnapshot } from "./SchedulerTypes";

interface SimpleStats {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

interface SystemStats extends SimpleStats {
  name: string;
  rate: TickRate;
}

interface TickStats extends SimpleStats {
  rate: TickRate;
}

type SystemKey = `${TickRate}:${string}`;

/**
 * Central registry that aggregates runtime metrics without introducing I/O.
 *
 * The monitor keeps only rolling aggregates (avg, max, count) so memory usage
 * remains constant regardless of entity count.
 */
class PerformanceMonitor {
  private tickStats: Record<TickRate, TickStats> = {
    FAST: this.createTickStats("FAST"),
    MEDIUM: this.createTickStats("MEDIUM"),
    SLOW: this.createTickStats("SLOW"),
  };

  private systemStats = new Map<SystemKey, SystemStats>();
  private schedulerStats: SchedulerStatsSnapshot | null = null;

  private createTickStats(rate: TickRate): TickStats {
    return {
      rate,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastMs: 0,
    };
  }

  public recordTick(rate: TickRate, durationMs: number): void {
    const stats = this.tickStats[rate];
    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  public recordSystemExecution(
    rate: TickRate,
    name: string,
    durationMs: number,
  ): void {
    const key: SystemKey = `${rate}:${name}`;
    let stats = this.systemStats.get(key);
    if (!stats) {
      stats = {
        name,
        rate,
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
      };
      this.systemStats.set(key, stats);
    }

    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  private subsystemStats = new Map<string, SimpleStats>();

  public recordSubsystemExecution(
    systemName: string,
    subOperation: string,
    durationMs: number,
    entityId?: string,
  ): void {
    const key = entityId
      ? `${systemName}:${subOperation}:${entityId}`
      : `${systemName}:${subOperation}`;
    let stats = this.subsystemStats.get(key);
    if (!stats) {
      stats = {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
      };
      this.subsystemStats.set(key, stats);
    }

    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  public setSchedulerStats(stats: SchedulerStatsSnapshot): void {
    this.schedulerStats = stats;
  }

  private gameLogicStats: {
    activeAgents: number;
    totalResources: number;
    totalBuildings: number;
  } = {
    activeAgents: 0,
    totalResources: 0,
    totalBuildings: 0,
  };

  public setGameLogicStats(stats: {
    activeAgents: number;
    totalResources: number;
    totalBuildings: number;
  }): void {
    this.gameLogicStats = stats;
  }

  // ==================== NUEVAS MÉTRICAS DETALLADAS ====================

  // Métricas de necesidades de agentes (promedios globales)
  private needsStats: {
    hunger: number;
    thirst: number;
    energy: number;
    hygiene: number;
    social: number;
    fun: number;
    mentalHealth: number;
    criticalCount: Record<string, number>; // Agentes en estado crítico por necesidad
  } = {
    hunger: 100,
    thirst: 100,
    energy: 100,
    hygiene: 100,
    social: 100,
    fun: 100,
    mentalHealth: 100,
    criticalCount: {},
  };

  public setNeedsStats(stats: {
    hunger: number;
    thirst: number;
    energy: number;
    hygiene: number;
    social: number;
    fun: number;
    mentalHealth: number;
    criticalCount: Record<string, number>;
  }): void {
    this.needsStats = stats;
  }

  // Métricas de IA y comportamiento
  private aiStats: {
    goalsByType: Record<string, number>; // Cantidad de agentes por tipo de goal activo
    actionsByType: Record<string, number>; // Acciones ejecutadas por tipo (acumulativo)
    statesByType: Record<string, number>; // Cantidad de agentes por estado
    planningFailures: number; // Fallos de planificación (acumulativo)
  } = {
    goalsByType: {},
    actionsByType: {},
    statesByType: {},
    planningFailures: 0,
  };

  public setAIStats(stats: {
    goalsByType: Record<string, number>;
    actionsByType: Record<string, number>;
    statesByType: Record<string, number>;
    planningFailures: number;
  }): void {
    this.aiStats = stats;
  }

  public incrementActionCount(actionType: string): void {
    this.aiStats.actionsByType[actionType] =
      (this.aiStats.actionsByType[actionType] || 0) + 1;
  }

  public incrementPlanningFailures(): void {
    this.aiStats.planningFailures += 1;
  }

  // Métricas de economía
  private economyStats: {
    totalMoney: number; // Dinero total en circulación
    moneyByAgent: number; // Promedio de dinero por agente
    transactionsTotal: number; // Transacciones totales (acumulativo)
    resourcesProduced: Record<string, number>; // Recursos producidos por tipo (acumulativo)
    resourcesConsumed: Record<string, number>; // Recursos consumidos por tipo (acumulativo)
  } = {
    totalMoney: 0,
    moneyByAgent: 0,
    transactionsTotal: 0,
    resourcesProduced: {},
    resourcesConsumed: {},
  };

  public setEconomyStats(stats: {
    totalMoney: number;
    moneyByAgent: number;
    transactionsTotal: number;
    resourcesProduced: Record<string, number>;
    resourcesConsumed: Record<string, number>;
  }): void {
    this.economyStats = stats;
  }

  public incrementTransaction(): void {
    this.economyStats.transactionsTotal += 1;
  }

  public recordResourceProduction(resourceType: string, amount: number): void {
    this.economyStats.resourcesProduced[resourceType] =
      (this.economyStats.resourcesProduced[resourceType] || 0) + amount;
  }

  public recordResourceConsumption(
    resourceType: string,
    amount: number,
  ): void {
    this.economyStats.resourcesConsumed[resourceType] =
      (this.economyStats.resourcesConsumed[resourceType] || 0) + amount;
  }

  // Métricas de combate
  private combatStats: {
    activeCombats: number; // Combates activos en este momento
    totalDamage: number; // Daño total infligido (acumulativo)
    totalDeaths: number; // Muertes totales en combate (acumulativo)
    combatsTotal: number; // Combates totales (acumulativo)
  } = {
    activeCombats: 0,
    totalDamage: 0,
    totalDeaths: 0,
    combatsTotal: 0,
  };

  public setCombatStats(stats: {
    activeCombats: number;
    totalDamage: number;
    totalDeaths: number;
    combatsTotal: number;
  }): void {
    this.combatStats = stats;
  }

  public recordDamage(amount: number): void {
    this.combatStats.totalDamage += amount;
  }

  public recordCombatDeath(): void {
    this.combatStats.totalDeaths += 1;
  }

  public recordCombat(): void {
    this.combatStats.combatsTotal += 1;
  }

  // Métricas de recursos del mundo
  private worldResourceStats: {
    byType: Record<string, number>; // Cantidad de recursos por tipo
    totalWorldResources: number; // Total de recursos en el mundo
  } = {
    byType: {},
    totalWorldResources: 0,
  };

  public setWorldResourceStats(stats: {
    byType: Record<string, number>;
    totalWorldResources: number;
  }): void {
    this.worldResourceStats = stats;
  }

  // Métricas de animales
  private animalStats: {
    bySpecies: Record<string, number>; // Cantidad de animales por especie
    totalAnimals: number; // Total de animales
    byBehavior: Record<string, number>; // Cantidad de animales por comportamiento actual
  } = {
    bySpecies: {},
    totalAnimals: 0,
    byBehavior: {},
  };

  public setAnimalStats(stats: {
    bySpecies: Record<string, number>;
    totalAnimals: number;
    byBehavior: Record<string, number>;
  }): void {
    this.animalStats = stats;
  }

  // Métricas de edificios y zonas
  private buildingStats: {
    byType: Record<string, number>; // Cantidad de edificios por tipo
    totalBuildings: number; // Total de edificios/zonas
    byState: Record<string, number>; // Edificios por estado (construcción, completado, etc.)
  } = {
    byType: {},
    totalBuildings: 0,
    byState: {},
  };

  public setBuildingStats(stats: {
    byType: Record<string, number>;
    totalBuildings: number;
    byState: Record<string, number>;
  }): void {
    this.buildingStats = stats;
  }

  // Métricas sociales y hogares
  private socialStats: {
    activeHouseholds: number; // Hogares activos
    totalRelationships: number; // Total de relaciones
    marriagesTotal: number; // Matrimonios activos
    averageHouseholdSize: number; // Tamaño promedio de hogar
  } = {
    activeHouseholds: 0,
    totalRelationships: 0,
    marriagesTotal: 0,
    averageHouseholdSize: 0,
  };

  public setSocialStats(stats: {
    activeHouseholds: number;
    totalRelationships: number;
    marriagesTotal: number;
    averageHouseholdSize: number;
  }): void {
    this.socialStats = stats;
  }

  // Métricas de genealogía
  private genealogyStats: {
    totalFamilies: number; // Total de familias
    totalGenerations: number; // Generaciones máximas
    averageChildrenPerAgent: number; // Promedio de hijos por agente
  } = {
    totalFamilies: 0,
    totalGenerations: 0,
    averageChildrenPerAgent: 0,
  };

  public setGenealogyStats(stats: {
    totalFamilies: number;
    totalGenerations: number;
    averageChildrenPerAgent: number;
  }): void {
    this.genealogyStats = stats;
  }

  // Métricas de inventarios
  private inventoryStats: {
    totalItems: number; // Total de items en todos los inventarios
    itemsByType: Record<string, number>; // Items por tipo
    averageInventorySize: number; // Tamaño promedio de inventario por agente
  } = {
    totalItems: 0,
    itemsByType: {},
    averageInventorySize: 0,
  };

  public setInventoryStats(stats: {
    totalItems: number;
    itemsByType: Record<string, number>;
    averageInventorySize: number;
  }): void {
    this.inventoryStats = stats;
  }

  // Métricas de batch processing
  private batchStats: {
    animalBatchSize: number; // Tamaño del último batch de animales
    movementBatchSize: number; // Tamaño del último batch de movimiento
    needsBatchSize: number; // Tamaño del último batch de necesidades
    gpuUtilization: number; // Porcentaje de uso de GPU (0-1)
  } = {
    animalBatchSize: 0,
    movementBatchSize: 0,
    needsBatchSize: 0,
    gpuUtilization: 0,
  };

  public setBatchStats(stats: {
    animalBatchSize: number;
    movementBatchSize: number;
    needsBatchSize: number;
    gpuUtilization: number;
  }): void {
    this.batchStats = stats;
  }

  /**
   * Generates a JSON-friendly snapshot for dashboards or REST responses.
   */
  public getSnapshot(): {
    timestamp: number;
    tickRates: Record<
      TickRate,
      { lastMs: number; maxMs: number; avgMs: number }
    >;
    systems: Array<SystemStats & { avgMs: number }>;
    scheduler?: SchedulerStatsSnapshot | null;
    gameLogic: {
      activeAgents: number;
      totalResources: number;
      totalBuildings: number;
    };
    memory: NodeJS.MemoryUsage;
    eventLoopLagMs: number;
  } {
    const tickRates = Object.fromEntries(
      (Object.keys(this.tickStats) as TickRate[]).map((rate) => {
        const stats = this.tickStats[rate];
        const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;
        return [
          rate,
          {
            lastMs: Number(stats.lastMs.toFixed(4)),
            maxMs: Number(stats.maxMs.toFixed(4)),
            avgMs: Number(avgMs.toFixed(4)),
          },
        ];
      }),
    ) as Record<TickRate, { lastMs: number; maxMs: number; avgMs: number }>;

    const systems = Array.from(this.systemStats.values())
      .map((system) => ({
        ...system,
        avgMs: system.count > 0 ? system.totalMs / system.count : 0,
      }))
      .sort((a, b) => b.avgMs - a.avgMs);

    return {
      timestamp: Date.now(),
      tickRates,
      systems,
      scheduler: this.schedulerStats,
      gameLogic: this.gameLogicStats,
      memory: process.memoryUsage(),
      eventLoopLagMs: performance.eventLoopUtilization?.()?.utilization ?? 0,
    };
  }

  /**
   * Serializes metrics using Prometheus exposition format (0.0.4).
   */
  public toPrometheus(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    lines.push(
      "# HELP backend_tick_duration_ms Average tick duration per scheduler rate",
    );
    lines.push("# TYPE backend_tick_duration_ms gauge");
    for (const [rate, stats] of Object.entries(snapshot.tickRates)) {
      lines.push(
        `backend_tick_duration_ms{rate="${rate}"} ${stats.avgMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_tick_duration_max_ms Max tick duration per rate",
    );
    lines.push("# TYPE backend_tick_duration_max_ms gauge");
    for (const [rate, stats] of Object.entries(snapshot.tickRates)) {
      lines.push(
        `backend_tick_duration_max_ms{rate="${rate}"} ${stats.maxMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_system_execution_ms Average execution time per system",
    );
    lines.push("# TYPE backend_system_execution_ms gauge");
    for (const system of snapshot.systems) {
      lines.push(
        `backend_system_execution_ms{rate="${system.rate}",system="${system.name}"} ${system.avgMs.toFixed(6)}`,
      );
    }

    const memory = snapshot.memory;
    lines.push("# HELP backend_memory_bytes Node.js process memory usage");
    lines.push("# TYPE backend_memory_bytes gauge");
    for (const [key, value] of Object.entries(memory)) {
      lines.push(`backend_memory_bytes{type="${key}"} ${value}`);
    }

    if (snapshot.scheduler) {
      lines.push(
        "# HELP backend_scheduler_enabled_systems Number of enabled systems per rate",
      );
      lines.push("# TYPE backend_scheduler_enabled_systems gauge");
      lines.push(
        `backend_scheduler_enabled_systems{rate="FAST"} ${snapshot.scheduler.fast.enabled}`,
      );
      lines.push(
        `backend_scheduler_enabled_systems{rate="MEDIUM"} ${snapshot.scheduler.medium.enabled}`,
      );
      lines.push(
        `backend_scheduler_enabled_systems{rate="SLOW"} ${snapshot.scheduler.slow.enabled}`,
      );

      lines.push(
        "# HELP backend_scheduler_tick_avg_ms Average observed tick duration reported by scheduler",
      );
      lines.push("# TYPE backend_scheduler_tick_avg_ms gauge");
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="FAST"} ${snapshot.scheduler.fast.avgMs.toFixed(6)}`,
      );
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="MEDIUM"} ${snapshot.scheduler.medium.avgMs.toFixed(6)}`,
      );
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="SLOW"} ${snapshot.scheduler.slow.avgMs.toFixed(6)}`,
      );

      lines.push(
        "# HELP backend_scheduler_entity_count Number of entities seen in last scheduler run",
      );
      lines.push("# TYPE backend_scheduler_entity_count gauge");
      lines.push(
        `backend_scheduler_entity_count ${snapshot.scheduler.entityCount}`,
      );
    }

    lines.push(
      "# HELP backend_active_agents_total Total number of active agents",
    );
    lines.push("# TYPE backend_active_agents_total gauge");
    lines.push(
      `backend_active_agents_total ${snapshot.gameLogic.activeAgents}`,
    );

    lines.push(
      "# HELP backend_total_resources Total number of world resources",
    );
    lines.push("# TYPE backend_total_resources gauge");
    lines.push(`backend_total_resources ${snapshot.gameLogic.totalResources}`);

    lines.push(
      "# HELP backend_total_buildings Total number of buildings/zones",
    );
    lines.push("# TYPE backend_total_buildings gauge");
    lines.push(`backend_total_buildings ${snapshot.gameLogic.totalBuildings}`);

    lines.push(
      "# HELP backend_event_loop_utilization Proportion of time event loop was busy",
    );
    lines.push("# TYPE backend_event_loop_utilization gauge");
    lines.push(
      `backend_event_loop_utilization ${snapshot.eventLoopLagMs.toFixed(6)}`,
    );

    lines.push(
      "# HELP backend_subsystem_duration_ms Average execution time per subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_duration_ms gauge");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];
      const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(
        `backend_subsystem_duration_ms{${labels}} ${avgMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_subsystem_calls_total Total calls to subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_calls_total counter");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(`backend_subsystem_calls_total{${labels}} ${stats.count}`);
    }

    lines.push(
      "# HELP backend_subsystem_total_duration_ms Total execution time per subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_total_duration_ms counter");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(
        `backend_subsystem_total_duration_ms{${labels}} ${stats.totalMs.toFixed(6)}`,
      );
    }

    // ==================== NUEVAS MÉTRICAS DETALLADAS ====================

    // Métricas de necesidades
    lines.push(
      "# HELP backend_needs_average Average need value across all agents (0-100)",
    );
    lines.push("# TYPE backend_needs_average gauge");
    lines.push(
      `backend_needs_average{need="hunger"} ${this.needsStats.hunger.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="thirst"} ${this.needsStats.thirst.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="energy"} ${this.needsStats.energy.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="hygiene"} ${this.needsStats.hygiene.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="social"} ${this.needsStats.social.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="fun"} ${this.needsStats.fun.toFixed(2)}`,
    );
    lines.push(
      `backend_needs_average{need="mentalHealth"} ${this.needsStats.mentalHealth.toFixed(2)}`,
    );

    lines.push(
      "# HELP backend_needs_critical_agents Agents with critical need levels (< 20)",
    );
    lines.push("# TYPE backend_needs_critical_agents gauge");
    for (const [need, count] of Object.entries(
      this.needsStats.criticalCount,
    )) {
      lines.push(`backend_needs_critical_agents{need="${need}"} ${count}`);
    }

    // Métricas de IA
    lines.push(
      "# HELP backend_ai_agents_by_goal Agents by current goal type",
    );
    lines.push("# TYPE backend_ai_agents_by_goal gauge");
    for (const [goal, count] of Object.entries(this.aiStats.goalsByType)) {
      lines.push(`backend_ai_agents_by_goal{goal="${goal}"} ${count}`);
    }

    lines.push(
      "# HELP backend_ai_actions_total Total actions executed by type",
    );
    lines.push("# TYPE backend_ai_actions_total counter");
    for (const [action, count] of Object.entries(
      this.aiStats.actionsByType,
    )) {
      lines.push(`backend_ai_actions_total{action="${action}"} ${count}`);
    }

    lines.push("# HELP backend_ai_agents_by_state Agents by AI state");
    lines.push("# TYPE backend_ai_agents_by_state gauge");
    for (const [state, count] of Object.entries(this.aiStats.statesByType)) {
      lines.push(`backend_ai_agents_by_state{state="${state}"} ${count}`);
    }

    lines.push(
      "# HELP backend_ai_planning_failures_total Total AI planning failures",
    );
    lines.push("# TYPE backend_ai_planning_failures_total counter");
    lines.push(
      `backend_ai_planning_failures_total ${this.aiStats.planningFailures}`,
    );

    // Métricas de economía
    lines.push(
      "# HELP backend_economy_total_money Total money in circulation",
    );
    lines.push("# TYPE backend_economy_total_money gauge");
    lines.push(`backend_economy_total_money ${this.economyStats.totalMoney}`);

    lines.push(
      "# HELP backend_economy_money_per_agent Average money per agent",
    );
    lines.push("# TYPE backend_economy_money_per_agent gauge");
    lines.push(
      `backend_economy_money_per_agent ${this.economyStats.moneyByAgent.toFixed(2)}`,
    );

    lines.push(
      "# HELP backend_economy_transactions_total Total economic transactions",
    );
    lines.push("# TYPE backend_economy_transactions_total counter");
    lines.push(
      `backend_economy_transactions_total ${this.economyStats.transactionsTotal}`,
    );

    lines.push(
      "# HELP backend_economy_resources_produced_total Resources produced by type",
    );
    lines.push("# TYPE backend_economy_resources_produced_total counter");
    for (const [resource, amount] of Object.entries(
      this.economyStats.resourcesProduced,
    )) {
      lines.push(
        `backend_economy_resources_produced_total{resource="${resource}"} ${amount.toFixed(2)}`,
      );
    }

    lines.push(
      "# HELP backend_economy_resources_consumed_total Resources consumed by type",
    );
    lines.push("# TYPE backend_economy_resources_consumed_total counter");
    for (const [resource, amount] of Object.entries(
      this.economyStats.resourcesConsumed,
    )) {
      lines.push(
        `backend_economy_resources_consumed_total{resource="${resource}"} ${amount.toFixed(2)}`,
      );
    }

    // Métricas de combate
    lines.push("# HELP backend_combat_active Active combats right now");
    lines.push("# TYPE backend_combat_active gauge");
    lines.push(`backend_combat_active ${this.combatStats.activeCombats}`);

    lines.push(
      "# HELP backend_combat_damage_total Total damage dealt in combat",
    );
    lines.push("# TYPE backend_combat_damage_total counter");
    lines.push(`backend_combat_damage_total ${this.combatStats.totalDamage}`);

    lines.push(
      "# HELP backend_combat_deaths_total Total deaths in combat",
    );
    lines.push("# TYPE backend_combat_deaths_total counter");
    lines.push(`backend_combat_deaths_total ${this.combatStats.totalDeaths}`);

    lines.push(
      "# HELP backend_combat_total Total combats that occurred",
    );
    lines.push("# TYPE backend_combat_total counter");
    lines.push(`backend_combat_total ${this.combatStats.combatsTotal}`);

    // Métricas de recursos del mundo
    lines.push(
      "# HELP backend_world_resources_by_type World resources by type",
    );
    lines.push("# TYPE backend_world_resources_by_type gauge");
    for (const [type, count] of Object.entries(
      this.worldResourceStats.byType,
    )) {
      lines.push(`backend_world_resources_by_type{type="${type}"} ${count}`);
    }

    lines.push(
      "# HELP backend_world_resources_total Total world resource nodes",
    );
    lines.push("# TYPE backend_world_resources_total gauge");
    lines.push(
      `backend_world_resources_total ${this.worldResourceStats.totalWorldResources}`,
    );

    // Métricas de animales
    lines.push("# HELP backend_animals_by_species Animals by species");
    lines.push("# TYPE backend_animals_by_species gauge");
    for (const [species, count] of Object.entries(
      this.animalStats.bySpecies,
    )) {
      lines.push(`backend_animals_by_species{species="${species}"} ${count}`);
    }

    lines.push("# HELP backend_animals_total Total animals in world");
    lines.push("# TYPE backend_animals_total gauge");
    lines.push(`backend_animals_total ${this.animalStats.totalAnimals}`);

    lines.push("# HELP backend_animals_by_behavior Animals by current behavior");
    lines.push("# TYPE backend_animals_by_behavior gauge");
    for (const [behavior, count] of Object.entries(
      this.animalStats.byBehavior,
    )) {
      lines.push(
        `backend_animals_by_behavior{behavior="${behavior}"} ${count}`,
      );
    }

    // Métricas de edificios
    lines.push("# HELP backend_buildings_by_type Buildings by type");
    lines.push("# TYPE backend_buildings_by_type gauge");
    for (const [type, count] of Object.entries(this.buildingStats.byType)) {
      lines.push(`backend_buildings_by_type{type="${type}"} ${count}`);
    }

    lines.push("# HELP backend_buildings_total Total buildings/zones");
    lines.push("# TYPE backend_buildings_total gauge");
    lines.push(`backend_buildings_total ${this.buildingStats.totalBuildings}`);

    lines.push("# HELP backend_buildings_by_state Buildings by state");
    lines.push("# TYPE backend_buildings_by_state gauge");
    for (const [state, count] of Object.entries(
      this.buildingStats.byState,
    )) {
      lines.push(`backend_buildings_by_state{state="${state}"} ${count}`);
    }

    // Métricas sociales
    lines.push("# HELP backend_social_households_active Active households");
    lines.push("# TYPE backend_social_households_active gauge");
    lines.push(
      `backend_social_households_active ${this.socialStats.activeHouseholds}`,
    );

    lines.push(
      "# HELP backend_social_relationships_total Total relationships",
    );
    lines.push("# TYPE backend_social_relationships_total gauge");
    lines.push(
      `backend_social_relationships_total ${this.socialStats.totalRelationships}`,
    );

    lines.push("# HELP backend_social_marriages_total Active marriages");
    lines.push("# TYPE backend_social_marriages_total gauge");
    lines.push(
      `backend_social_marriages_total ${this.socialStats.marriagesTotal}`,
    );

    lines.push(
      "# HELP backend_social_household_avg_size Average household size",
    );
    lines.push("# TYPE backend_social_household_avg_size gauge");
    lines.push(
      `backend_social_household_avg_size ${this.socialStats.averageHouseholdSize.toFixed(2)}`,
    );

    // Métricas de genealogía
    lines.push("# HELP backend_genealogy_families_total Total family lines");
    lines.push("# TYPE backend_genealogy_families_total gauge");
    lines.push(
      `backend_genealogy_families_total ${this.genealogyStats.totalFamilies}`,
    );

    lines.push(
      "# HELP backend_genealogy_generations_max Maximum generations",
    );
    lines.push("# TYPE backend_genealogy_generations_max gauge");
    lines.push(
      `backend_genealogy_generations_max ${this.genealogyStats.totalGenerations}`,
    );

    lines.push(
      "# HELP backend_genealogy_children_avg Average children per agent",
    );
    lines.push("# TYPE backend_genealogy_children_avg gauge");
    lines.push(
      `backend_genealogy_children_avg ${this.genealogyStats.averageChildrenPerAgent.toFixed(2)}`,
    );

    // Métricas de inventario
    lines.push("# HELP backend_inventory_items_total Total items in all inventories");
    lines.push("# TYPE backend_inventory_items_total gauge");
    lines.push(
      `backend_inventory_items_total ${this.inventoryStats.totalItems}`,
    );

    lines.push("# HELP backend_inventory_items_by_type Items by type");
    lines.push("# TYPE backend_inventory_items_by_type gauge");
    for (const [type, count] of Object.entries(
      this.inventoryStats.itemsByType,
    )) {
      lines.push(`backend_inventory_items_by_type{type="${type}"} ${count}`);
    }

    lines.push(
      "# HELP backend_inventory_avg_size Average inventory size per agent",
    );
    lines.push("# TYPE backend_inventory_avg_size gauge");
    lines.push(
      `backend_inventory_avg_size ${this.inventoryStats.averageInventorySize.toFixed(2)}`,
    );

    // Métricas de batch processing
    lines.push(
      "# HELP backend_batch_size Batch size for GPU processing",
    );
    lines.push("# TYPE backend_batch_size gauge");
    lines.push(
      `backend_batch_size{processor="animal"} ${this.batchStats.animalBatchSize}`,
    );
    lines.push(
      `backend_batch_size{processor="movement"} ${this.batchStats.movementBatchSize}`,
    );
    lines.push(
      `backend_batch_size{processor="needs"} ${this.batchStats.needsBatchSize}`,
    );

    lines.push("# HELP backend_gpu_utilization GPU utilization (0-1)");
    lines.push("# TYPE backend_gpu_utilization gauge");
    lines.push(
      `backend_gpu_utilization ${this.batchStats.gpuUtilization.toFixed(4)}`,
    );

    return `${lines.join("\n")}\n`;
  }
}

export const performanceMonitor = new PerformanceMonitor();
