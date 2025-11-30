import { logger } from "../../../../infrastructure/utils/logger";
import { GameEventType, simulationEvents } from "../events";
import { WeatherType } from "../../../../shared/constants/AmbientEnums";
import type {
  SimulationCommand,
  SpawnAgentCommandPayload,
  NeedsCommandPayload,
  RecipeCommandPayload,
  SocialCommandPayload,
  WorldResourceCommandPayload,
  BuildingCommandPayload,
  ReputationCommandPayload,
  TaskCommandPayload,
  ConflictCommandPayload,
} from "../../../../shared/types/commands/SimulationCommand";
import {
  SimulationCommandType,
  NeedsCommandType,
  RecipeCommandType,
  SocialCommandType,
  WorldResourceCommandType,
  BuildingCommandType,
  ReputationCommandType,
  TaskCommandType,
  ConflictCommandType,
  TimeCommandType,
  AgentCommandType,
  AnimalCommandType,
} from "../../../../shared/constants/CommandEnums";
import type { SimulationRunner } from "../SimulationRunner";
import type { GameResources } from "../../../types/game-types";
import type { NeedsConfig } from "../../../types/simulation/needs";
import type { TaskType, TaskMetadata } from "../../../types/simulation/tasks";
import type { BuildingLabel } from "../../../types/simulation/buildings";

export class CommandProcessor {
  constructor(private runner: SimulationRunner) {}

  public process(commands: SimulationCommand[]): void {
    if (commands.length > 0) {
      logger.info(`🎯 Processing ${commands.length} command(s)`);
    }
    while (commands.length > 0) {
      const command = commands.shift();
      if (!command) break;
      logger.info(`📝 Processing command: ${command.type}`, command);
      try {
        this.dispatchCommand(command);
      } catch (error) {
        logger.error(`Failed to process command ${command.type}:`, error);
      }
    }
  }

  private dispatchCommand(command: SimulationCommand): void {
    switch (command.type) {
      case SimulationCommandType.SET_TIME_SCALE:
        this.runner.setTimeScale(
          Math.max(0.1, Math.min(10, command.multiplier)),
        );
        break;
      case SimulationCommandType.APPLY_RESOURCE_DELTA:
        this.applyResourceDelta(command.delta);
        break;
      case SimulationCommandType.GATHER_RESOURCE:
        simulationEvents.emit(GameEventType.RESOURCE_GATHERED, {
          resourceId: command.resourceId,
          amount: command.amount,
        });
        break;
      case SimulationCommandType.GIVE_RESOURCE:
        if (
          command.payload.agentId &&
          command.payload.resource &&
          command.payload.amount
        ) {
          this.runner.inventorySystem.addResource(
            command.payload.agentId,
            command.payload.resource,
            command.payload.amount,
          );
        }
        break;
      case SimulationCommandType.SPAWN_AGENT:
        this.handleSpawnAgent(command);
        break;
      case SimulationCommandType.KILL_AGENT:
        this.runner.lifeCycleSystem.removeAgent(command.agentId);
        break;
      case SimulationCommandType.AGENT_COMMAND:
        this.handleAgentCommand(command);
        break;
      case SimulationCommandType.ANIMAL_COMMAND:
        this.handleAnimalCommand(command);
        break;
      case SimulationCommandType.NEEDS_COMMAND:
        this.handleNeedsCommand(command);
        break;
      case SimulationCommandType.RECIPE_COMMAND:
        this.handleRecipeCommand(command);
        break;
      case SimulationCommandType.SOCIAL_COMMAND:
        this.handleSocialCommand(command);
        break;
      case SimulationCommandType.RESEARCH_COMMAND:
        logger.warn("RESEARCH_COMMAND ignored - system removed");
        break;
      case SimulationCommandType.WORLD_RESOURCE_COMMAND:
        this.handleWorldResourceCommand(command);
        break;
      case SimulationCommandType.DIALOGUE_COMMAND:
        logger.warn("DIALOGUE_COMMAND ignored - system removed");
        break;
      case SimulationCommandType.BUILDING_COMMAND:
        this.handleBuildingCommand(command);
        break;
      case SimulationCommandType.REPUTATION_COMMAND:
        this.handleReputationCommand(command);
        break;
      case SimulationCommandType.TASK_COMMAND:
        this.handleTaskCommand(command);
        break;
      case SimulationCommandType.CONFLICT_COMMAND:
        this.handleConflictCommand(command);
        break;
      case SimulationCommandType.TIME_COMMAND:
        this.handleTimeCommand(command);
        break;
      case SimulationCommandType.FORCE_EMERGENCE_EVALUATION:
        logger.warn(
          "FORCE_EMERGENCE_EVALUATION command ignored - system removed",
        );
        break;
      case SimulationCommandType.SAVE_GAME:
        this.runner.saveSimulation().catch((err) => {
          logger.error("Manual save failed:", err);
        });
        break;
      case SimulationCommandType.PING:
      default:
        break;
    }
  }

  private handleSpawnAgent(command: SimulationCommand): void {
    if (command.type !== SimulationCommandType.SPAWN_AGENT) return;
    const spawnCommand = command as {
      type: SimulationCommandType.SPAWN_AGENT;
      payload?: SpawnAgentCommandPayload;
    };
    logger.info("🔵 SPAWN_AGENT command received", spawnCommand.payload);
    const spawnPayload = (spawnCommand.payload ??
      {}) as SpawnAgentCommandPayload;

    const agentPayload: Partial<
      import("../../../types/simulation/agents").AgentProfile
    > = {
      ...(spawnPayload as Partial<
        import("../../../types/simulation/agents").AgentProfile
      >),
    };

    if (!agentPayload.id && spawnPayload.requestId) {
      agentPayload.id = spawnPayload.requestId;
    }

    logger.info("🟢 Spawning agent with payload:", agentPayload);
    const newAgent = this.runner.lifeCycleSystem.spawnAgent(agentPayload);
    logger.info(`✅ Agent spawned successfully: ${newAgent.id}`, {
      totalAgents: this.runner.state.agents.length,
    });
  }

  private handleAgentCommand(
    command: Extract<SimulationCommand, { type: "AGENT_COMMAND" }>,
  ): void {
    if (!command.agentId) return;
    if (!this.runner.ensureMovementState(command.agentId)) return;

    const payload = command.payload;

    switch (command.command) {
      case AgentCommandType.MOVE_TO:
        if (
          payload &&
          typeof payload.x === "number" &&
          typeof payload.y === "number"
        ) {
          this.runner.movementSystem.moveToPoint(
            command.agentId,
            payload.x,
            payload.y,
          );
          simulationEvents.emit(GameEventType.AGENT_ACTION_COMMANDED, {
            agentId: command.agentId,
            action: "move",
            payload,
          });
        }
        break;
      case AgentCommandType.STOP_MOVEMENT:
        this.runner.movementSystem.stopMovement(command.agentId);
        break;
      default:
        break;
    }
  }

  private handleAnimalCommand(
    command: Extract<SimulationCommand, { type: "ANIMAL_COMMAND" }>,
  ): void {
    if (command.command !== AnimalCommandType.SPAWN_ANIMAL) return;
    const payload = command.payload;
    if (
      !payload ||
      typeof payload.type !== "string" ||
      !payload.position ||
      typeof payload.position.x !== "number" ||
      typeof payload.position.y !== "number"
    ) {
      return;
    }

    this.runner.animalSystem.spawnAnimal(
      payload.type,
      payload.position,
      payload.biome as string | undefined,
    );
  }

  private handleNeedsCommand(
    command: Extract<SimulationCommand, { type: "NEEDS_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as NeedsCommandPayload);
    switch (command.command) {
      case NeedsCommandType.SATISFY_NEED:
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.amount === "number"
        ) {
          this.runner.needsSystem.satisfyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.amount,
          );
        }
        break;
      case NeedsCommandType.MODIFY_NEED:
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.delta === "number"
        ) {
          this.runner.needsSystem.modifyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.delta,
          );
        }
        break;
      case NeedsCommandType.UPDATE_CONFIG:
        this.runner.needsSystem.updateConfig(payload as Partial<NeedsConfig>);
        break;
    }
  }

  private handleRecipeCommand(
    command: Extract<SimulationCommand, { type: "RECIPE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as RecipeCommandPayload);
    switch (command.command) {
      case RecipeCommandType.TEACH_RECIPE:
        if ((payload.agentId || payload.teacherId) && payload.recipeId) {
          this.runner._recipeDiscoverySystem.teachRecipe(
            (payload.agentId as string) ?? (payload.teacherId as string) ?? "",
            payload.recipeId as string,
          );
        }
        break;
      case RecipeCommandType.SHARE_RECIPE:
        {
          const teacherId =
            (payload.teacherId as string | undefined) ??
            ((payload as Record<string, unknown>).fromAgentId as
              | string
              | undefined);
          const studentId =
            (payload.studentId as string | undefined) ??
            ((payload as Record<string, unknown>).toAgentId as
              | string
              | undefined);

          if (teacherId && studentId && payload.recipeId) {
            this.runner._recipeDiscoverySystem.shareRecipe(
              teacherId,
              studentId,
              payload.recipeId as string,
            );
          }
        }
        break;
    }
  }

  private handleSocialCommand(
    command: Extract<SimulationCommand, { type: "SOCIAL_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as SocialCommandPayload);
    switch (command.command) {
      case SocialCommandType.IMPOSE_TRUCE:
        if (
          payload.aId &&
          payload.bId &&
          typeof payload.durationMs === "number"
        ) {
          this.runner.socialSystem.imposeTruce(
            payload.aId as string,
            payload.bId as string,
            payload.durationMs,
          );
        }
        break;
      case SocialCommandType.SET_AFFINITY:
        if (payload.aId && payload.bId && typeof payload.value === "number") {
          this.runner.socialSystem.setAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.value,
          );
        }
        break;
      case SocialCommandType.MODIFY_AFFINITY:
        if (payload.aId && payload.bId && typeof payload.delta === "number") {
          this.runner.socialSystem.modifyAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.delta,
          );
        }
        break;
      case SocialCommandType.REMOVE_RELATIONSHIPS:
        if (payload.agentId) {
          this.runner.socialSystem.removeRelationships(
            payload.agentId as string,
          );
        }
        break;
      case SocialCommandType.FRIENDLY_INTERACTION:
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.runner.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            (payload.magnitude as number) || 0.1,
          );
          // InteractionGameSystem eliminated - interactions handled by SocialSystem
        }
        break;
      case SocialCommandType.HOSTILE_ENCOUNTER:
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.runner.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            -(payload.magnitude as number) || -0.1,
          );
          // InteractionGameSystem eliminated - interactions handled by SocialSystem
        }
        break;
    }
  }

  private handleWorldResourceCommand(
    command: Extract<SimulationCommand, { type: "WORLD_RESOURCE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as WorldResourceCommandPayload);
    switch (command.command) {
      case WorldResourceCommandType.SPAWN_RESOURCE:
        if (payload.type && payload.position) {
          this.runner.worldResourceSystem.spawnResource(
            payload.type as string,
            payload.position as { x: number; y: number },
            (payload.biome as string) || "grass",
          );
        }
        break;
      case WorldResourceCommandType.HARVEST_RESOURCE:
        if (payload.resourceId && payload.agentId) {
          this.runner.worldResourceSystem.harvestResource(
            payload.resourceId as string,
            payload.agentId as string,
          );
        }
        break;
    }
  }

  private handleBuildingCommand(
    command: Extract<SimulationCommand, { type: "BUILDING_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as BuildingCommandPayload);
    switch (command.command) {
      case BuildingCommandType.START_UPGRADE:
        if (payload.zoneId && payload.agentId) {
          // BuildingMaintenanceSystem merged into BuildingSystem
          this.runner.buildingSystem.startUpgrade(
            payload.zoneId as string,
            payload.agentId as string,
          );
        }
        break;
      case BuildingCommandType.CANCEL_UPGRADE:
        if (payload.zoneId) {
          // BuildingMaintenanceSystem merged into BuildingSystem
          this.runner.buildingSystem.cancelUpgrade(
            payload.zoneId as string,
          );
        }
        break;
      case BuildingCommandType.ENQUEUE_CONSTRUCTION:
        if (payload.buildingType) {
          this.runner.buildingSystem.enqueueConstruction(
            payload.buildingType as BuildingLabel,
          );
        }
        break;
      case BuildingCommandType.CONSTRUCT_BUILDING:
        if (payload.buildingType) {
          this.runner.buildingSystem.constructBuilding(
            payload.buildingType as BuildingLabel,
            payload.position as { x: number; y: number } | undefined,
          );
        }
        break;
    }
  }

  private handleReputationCommand(
    command: Extract<SimulationCommand, { type: "REPUTATION_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ReputationCommandPayload);
    switch (command.command) {
      case ReputationCommandType.UPDATE_TRUST:
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.delta === "number"
        ) {
          this.runner.reputationSystem.updateTrust(
            payload.agentA as string,
            payload.agentB as string,
            payload.delta,
          );
        }
        break;
    }
  }

  private handleTaskCommand(
    command: Extract<SimulationCommand, { type: "TASK_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as TaskCommandPayload);
    switch (command.command) {
      case TaskCommandType.CREATE_TASK:
        if (payload.type && typeof payload.requiredWork === "number") {
          this.runner.taskSystem.createTask({
            type: payload.type as TaskType,
            requiredWork: payload.requiredWork,
            bounds: payload.bounds as
              | { x: number; y: number; width: number; height: number }
              | undefined,
            zoneId: payload.zoneId as string | undefined,
            requirements: payload.requirements as
              | {
                  resources?: {
                    wood?: number;
                    stone?: number;
                    food?: number;
                    water?: number;
                  };
                  minWorkers?: number;
                }
              | undefined,
            metadata: payload.metadata as TaskMetadata | undefined,
            targetAnimalId: payload.targetAnimalId as string | undefined,
          });
        }
        break;
      case TaskCommandType.CONTRIBUTE_TO_TASK:
        if (
          payload.taskId &&
          payload.agentId &&
          typeof payload.contribution === "number"
        ) {
          this.runner.taskSystem.contributeToTask(
            payload.taskId as string,
            payload.agentId as string,
            payload.contribution as number,
            (payload.socialSynergyMultiplier as number) || 1.0,
          );
        }
        break;
      case TaskCommandType.REMOVE_TASK:
        if (payload.taskId) {
          this.runner.taskSystem.removeTask(payload.taskId as string);
        }
        break;
    }
  }

  private handleTimeCommand(
    command: Extract<SimulationCommand, { type: "TIME_COMMAND" }>,
  ): void {
    if (
      command.command === TimeCommandType.SET_WEATHER &&
      command.payload?.weatherType
    ) {
      const weatherType = command.payload.weatherType as string;
      if (
        this.runner.timeSystem &&
        typeof this.runner.timeSystem === "object" &&
        "setWeather" in this.runner.timeSystem &&
        typeof this.runner.timeSystem.setWeather === "function"
      ) {
        this.runner.timeSystem.setWeather(weatherType as WeatherType);
        logger.info(`Weather set to ${weatherType} via TIME_COMMAND`);
      } else {
        logger.warn("TimeSystem.setWeather not available");
      }
    }
  }

  private applyResourceDelta(delta: Partial<GameResources["materials"]>): void {
    if (!this.runner.state.resources) {
      return;
    }
    const materials = this.runner.state.resources.materials;
    const typedMaterials = materials as Record<string, number>;

    for (const [key, value] of Object.entries(delta)) {
      const current = typedMaterials[key] ?? 0;
      typedMaterials[key] = current + (value ?? 0);
    }
  }

  private handleConflictCommand(
    command: Extract<SimulationCommand, { type: "CONFLICT_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ConflictCommandPayload);
    switch (command.command) {
      case ConflictCommandType.RESOLVE_CONFLICT:
        if (payload.cardId && payload.choice) {
          this.runner.conflictResolutionSystem.resolveConflict(
            payload.cardId,
            payload.choice,
          );
        }
        break;
    }
  }
}
