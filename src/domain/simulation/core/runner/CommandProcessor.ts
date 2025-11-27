import { logger } from "../../../../infrastructure/utils/logger";
import { GameEventNames, simulationEvents } from "../events";
import type {
  SimulationCommand,
  SpawnAgentCommandPayload,
  NeedsCommandPayload,
  RecipeCommandPayload,
  SocialCommandPayload,
  ResearchCommandPayload,
  WorldResourceCommandPayload,
  DialogueCommandPayload,
  BuildingCommandPayload,
  ReputationCommandPayload,
  TaskCommandPayload,
} from "../../../../shared/types/commands/SimulationCommand";
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
      case "SET_TIME_SCALE":
        // Accessing private timeScale via a setter or public property would be ideal,
        // but for now we might need to add a setter to Runner or just access it if we make it public.
        // Assuming we will add setTimeScale to Runner.
        this.runner.setTimeScale(
          Math.max(0.1, Math.min(10, command.multiplier)),
        );
        break;
      case "APPLY_RESOURCE_DELTA":
        this.applyResourceDelta(command.delta);
        break;
      case "GATHER_RESOURCE":
        simulationEvents.emit(GameEventNames.RESOURCE_GATHERED, {
          resourceId: command.resourceId,
          amount: command.amount,
        });
        break;
      case "GIVE_RESOURCE":
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
      case "SPAWN_AGENT":
        this.handleSpawnAgent(command);
        break;
      case "KILL_AGENT":
        this.runner.lifeCycleSystem.removeAgent(command.agentId);
        break;
      case "AGENT_COMMAND":
        this.handleAgentCommand(command);
        break;
      case "ANIMAL_COMMAND":
        this.handleAnimalCommand(command);
        break;
      case "NEEDS_COMMAND":
        this.handleNeedsCommand(command);
        break;
      case "RECIPE_COMMAND":
        this.handleRecipeCommand(command);
        break;
      case "SOCIAL_COMMAND":
        this.handleSocialCommand(command);
        break;
      case "RESEARCH_COMMAND":
        this.handleResearchCommand(command);
        break;
      case "WORLD_RESOURCE_COMMAND":
        this.handleWorldResourceCommand(command);
        break;
      case "DIALOGUE_COMMAND":
        this.handleDialogueCommand(command);
        break;
      case "BUILDING_COMMAND":
        this.handleBuildingCommand(command);
        break;
      case "REPUTATION_COMMAND":
        this.handleReputationCommand(command);
        break;
      case "TASK_COMMAND":
        this.handleTaskCommand(command);
        break;
      case "TIME_COMMAND":
        this.handleTimeCommand(command);
        break;
      case "FORCE_EMERGENCE_EVALUATION":
        this.runner.emergenceSystem.forcePatternEvaluation();
        break;
      case "SAVE_GAME":
        this.runner.saveSimulation().catch((err) => {
          logger.error("Manual save failed:", err);
        });
        break;
      case "PING":
      default:
        break;
    }
  }

  private handleSpawnAgent(
    command: SimulationCommand & { type: "SPAWN_AGENT" },
  ): void {
    logger.info("🔵 SPAWN_AGENT command received", command.payload);
    const spawnPayload = (command.payload ?? {}) as SpawnAgentCommandPayload;

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
      case "MOVE_TO":
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
          simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
            agentId: command.agentId,
            action: "move",
            payload,
          });
        }
        break;
      case "STOP_MOVEMENT":
        this.runner.movementSystem.stopMovement(command.agentId);
        break;
      default:
        break;
    }
  }

  private handleAnimalCommand(
    command: Extract<SimulationCommand, { type: "ANIMAL_COMMAND" }>,
  ): void {
    if (command.command !== "SPAWN_ANIMAL") return;
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
      case "SATISFY_NEED":
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
      case "MODIFY_NEED":
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
      case "UPDATE_CONFIG":
        this.runner.needsSystem.updateConfig(payload as Partial<NeedsConfig>);
        break;
    }
  }

  private handleRecipeCommand(
    command: Extract<SimulationCommand, { type: "RECIPE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as RecipeCommandPayload);
    switch (command.command) {
      case "TEACH_RECIPE":
        if ((payload.agentId || payload.teacherId) && payload.recipeId) {
          this.runner._recipeDiscoverySystem.teachRecipe(
            (payload.agentId as string) ?? (payload.teacherId as string) ?? "",
            payload.recipeId as string,
          );
        }
        break;
      case "SHARE_RECIPE":
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
      case "IMPOSE_TRUCE":
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
      case "SET_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.value === "number") {
          this.runner.socialSystem.setAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.value,
          );
        }
        break;
      case "MODIFY_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.delta === "number") {
          this.runner.socialSystem.modifyAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.delta,
          );
        }
        break;
      case "REMOVE_RELATIONSHIPS":
        if (payload.agentId) {
          this.runner.socialSystem.removeRelationships(
            payload.agentId as string,
          );
        }
        break;
      case "FRIENDLY_INTERACTION":
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
          this.runner.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "friendly",
          );
        }
        break;
      case "HOSTILE_ENCOUNTER":
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
          this.runner.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "hostile",
          );
        }
        break;
    }
  }

  private handleResearchCommand(
    command: Extract<SimulationCommand, { type: "RESEARCH_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ResearchCommandPayload);
    switch (command.command) {
      case "INITIALIZE_LINEAGE":
        if (payload.lineageId) {
          this.runner._researchSystem.initializeLineage(
            payload.lineageId as string,
          );
        }
        break;
      case "RECIPE_DISCOVERED":
        if (payload.recipeId) {
          const lineageId = this.runner.resolveLineageId(
            payload.lineageId as string | undefined,
          );
          const discoveredBy =
            (payload.discoveredBy as string | undefined) || "unknown";

          this.runner._researchSystem.onRecipeDiscovered(
            lineageId,
            payload.recipeId as string,
            discoveredBy,
          );
        }
        break;
    }
  }

  private handleWorldResourceCommand(
    command: Extract<SimulationCommand, { type: "WORLD_RESOURCE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as WorldResourceCommandPayload);
    switch (command.command) {
      case "SPAWN_RESOURCE":
        if (payload.type && payload.position) {
          this.runner.worldResourceSystem.spawnResource(
            payload.type as string,
            payload.position as { x: number; y: number },
            (payload.biome as string) || "grass",
          );
        }
        break;
      case "HARVEST_RESOURCE":
        if (payload.resourceId && payload.agentId) {
          this.runner.worldResourceSystem.harvestResource(
            payload.resourceId as string,
            payload.agentId as string,
          );
        }
        break;
    }
  }

  private handleDialogueCommand(
    command: Extract<SimulationCommand, { type: "DIALOGUE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as DialogueCommandPayload);
    switch (command.command) {
      case "RESPOND_TO_CARD":
        if (payload.cardId && payload.choiceId) {
          this.runner.cardDialogueSystem.respondToCard(
            payload.cardId as string,
            payload.choiceId as string,
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
      case "START_UPGRADE":
        if (payload.zoneId && payload.agentId) {
          this.runner.buildingMaintenanceSystem.startUpgrade(
            payload.zoneId as string,
            payload.agentId as string,
          );
        }
        break;
      case "CANCEL_UPGRADE":
        if (payload.zoneId) {
          this.runner.buildingMaintenanceSystem.cancelUpgrade(
            payload.zoneId as string,
          );
        }
        break;
      case "ENQUEUE_CONSTRUCTION":
        if (payload.buildingType) {
          this.runner.buildingSystem.enqueueConstruction(
            payload.buildingType as BuildingLabel,
          );
        }
        break;
      case "CONSTRUCT_BUILDING":
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
      case "UPDATE_TRUST":
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
      case "CREATE_TASK":
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
      case "CONTRIBUTE_TO_TASK":
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
      case "REMOVE_TASK":
        if (payload.taskId) {
          this.runner.taskSystem.removeTask(payload.taskId as string);
        }
        break;
    }
  }

  private handleTimeCommand(
    command: Extract<SimulationCommand, { type: "TIME_COMMAND" }>,
  ): void {
    if (command.command === "SET_WEATHER" && command.payload?.weatherType) {
      const weatherType = command.payload.weatherType as string;
      if (
        this.runner.timeSystem &&
        typeof this.runner.timeSystem === "object" &&
        "setWeather" in this.runner.timeSystem &&
        typeof this.runner.timeSystem.setWeather === "function"
      ) {
        this.runner.timeSystem.setWeather(
          weatherType as
            | "clear"
            | "cloudy"
            | "rainy"
            | "stormy"
            | "foggy"
            | "snowy",
        );
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
    // Ensure materials is typed as record for index access or cast key
    const typedMaterials = materials as Record<string, number>;

    for (const [key, value] of Object.entries(delta)) {
      const current = typedMaterials[key] ?? 0;
      typedMaterials[key] = current + (value ?? 0);
    }
  }
}
