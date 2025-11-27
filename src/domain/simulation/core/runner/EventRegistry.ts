import { GameEventNames, simulationEvents } from "../events";
import type { SimulationEventPayload } from "../../../../shared/types/commands/SimulationCommand";
import { logger } from "../../../../infrastructure/utils/logger";
import type { SimulationRunner } from "../SimulationRunner";
import { ResourceType } from "../../../../shared/constants/ResourceEnums";
import { GameEventType } from "../../../../shared/constants/EventEnums";
import { RoleType } from "../../../../shared/constants/RoleEnums";
import { TaskType } from "../../../../shared/constants/TaskEnums";
import { LifeStage } from "../../../../shared/constants/AgentEnums";
import { ActionType } from "../../../../shared/constants/AIEnums";

/**
 * Central registry for simulation event listeners.
 *
 * Manages all event subscriptions and ensures proper cleanup. Handles cross-system
 * coordination when events occur (e.g., agent death triggers inventory drop, role
 * removal, genealogy updates). Captures events for snapshot inclusion.
 *
 * Features:
 * - Automatic cleanup of all registered listeners
 * - Event capture for snapshot serialization
 * - Cross-system coordination (genealogy, inventory, roles, AI, etc.)
 * - Reputation updates based on agent actions
 *
 * @see SimulationRunner for event emission
 * @see simulationEvents for the global event emitter
 */
export class EventRegistry {
  private eventCleanups: (() => void)[] = [];
  private eventCaptureListener?: (eventName: string, payload: unknown) => void;

  constructor(private runner: SimulationRunner) {}

  private registerEvent(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => void,
  ): void {
    simulationEvents.on(eventName, handler);
    this.eventCleanups.push(() => simulationEvents.off(eventName, handler));
  }

  public setupEventListeners(): void {
    this.registerEvent(
      GameEventNames.AGENT_ACTION_COMPLETE,
      (data: { agentId: string; action: string }) => {
        if (data.action === ActionType.BIRTH) {
          const agent = this.runner.entityIndex.getAgent(data.agentId);
          if (agent) {
            this.runner._genealogySystem.registerBirth(
              agent,
              agent.parents?.father,
              agent.parents?.mother,
            );
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.AGENT_BIRTH,
      (data: { entityId: string; parentIds: [string, string] | null }) => {
        // AppearanceGenerationSystem removed - appearance generation disabled
        // Previously generated appearance based on parent genetics
        logger.debug(
          `Agent birth event for ${data.entityId} - appearance generation skipped`,
        );
      },
    );

    this.registerEvent(
      GameEventNames.COMBAT_KILL,
      (data: { targetId: string }) => {
        this.runner._genealogySystem.recordDeath(data.targetId);
      },
    );

    this.registerEvent(
      GameEventNames.AGENT_DEATH,
      (data: { entityId: string; reason?: string }) => {
        this.runner.entityIndex.markEntityDead(data.entityId);
        this.runner._genealogySystem.recordDeath(data.entityId);
        this.runner.entityIndex.removeEntity(data.entityId);
      },
    );

    this.registerEvent(
      GameEventNames.INVENTORY_DROPPED,
      (data: {
        agentId: string;
        position?: { x: number; y: number };
        inventory: { wood: number; stone: number; food: number; water: number };
        timestamp: number;
      }) => {
        const household = this.runner.householdSystem.getHouseFor(data.agentId);
        if (household) {
          const deposited = this.runner.householdSystem.depositToHousehold(
            household.id,
            data.inventory,
          );
          if (deposited) {
            logger.info(
              `📦 Inventory from deceased agent ${data.agentId} deposited to household ${household.id}`,
            );
          }
        } else {
          const freeHouse = this.runner.householdSystem.findFreeHouse();
          if (freeHouse) {
            this.runner.householdSystem.depositToHousehold(
              freeHouse.zoneId,
              data.inventory,
            );
            logger.info(
              `📦 Inventory from deceased agent ${data.agentId} deposited to community storage ${freeHouse.zoneId}`,
            );
          } else {
            logger.warn(
              `⚠️ No household found for dropped inventory from agent ${data.agentId} - resources lost`,
            );
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.AGENT_RESPAWNED,
      (data: { agentId: string; timestamp: number }) => {
        this.runner.aiSystem.setAgentOffDuty(data.agentId, false);

        const agent = this.runner.entityIndex.getAgent(data.agentId);
        if (
          agent?.position &&
          !this.runner.movementSystem.hasMovementState(data.agentId)
        ) {
          this.runner.movementSystem.initializeEntityMovement(
            data.agentId,
            agent.position,
          );
        }
      },
    );

    this.registerEvent(
      GameEventNames.ANIMAL_HUNTED,
      (data: { animalId: string; hunterId: string; foodValue?: number }) => {
        if (data.hunterId && data.foodValue) {
          const inventory = this.runner.inventorySystem.getAgentInventory(
            data.hunterId,
          );
          if (inventory) {
            const foodToAdd = Math.floor(data.foodValue || 5);
            this.runner.inventorySystem.addResource(
              data.hunterId,
              ResourceType.FOOD,
              foodToAdd,
            );
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.RESOURCE_GATHERED,
      (data: {
        resourceId: string;
        resourceType: string;
        harvesterId?: string;
        position?: { x: number; y: number };
      }) => {
        if (data.harvesterId) {
          this.runner.questSystem.handleEvent({
            type: GameEventType.RESOURCE_GATHERED,
            entityId: data.harvesterId,
            timestamp: Date.now(),
            data: {
              resourceType: data.resourceType,
              amount: 1,
            },
          });
        }
      },
    );

    this.registerEvent(
      GameEventNames.BUILDING_CONSTRUCTED,
      (data: {
        jobId: string;
        zoneId: string;
        label: string;
        completedAt: number;
      }) => {
        const job = this.runner.buildingSystem.getConstructionJob(data.jobId);
        if (job?.taskId) {
          const task = this.runner.taskSystem.getTask(job.taskId);
          if (task && task.contributors) {
            task.contributors.forEach((_contribution, agentId) => {
              this.runner.questSystem.handleEvent({
                type: GameEventType.BUILDING_CONSTRUCTED,
                entityId: agentId,
                timestamp: Date.now(),
                data: {
                  structureType: data.label,
                },
              });
            });
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.DIALOGUE_CARD_RESPONDED,
      (data: { cardId: string; choiceId: string }) => {
        const dialogueState = this.runner.state.dialogueState;
        if (dialogueState?.active) {
          const card = dialogueState.active.find((c) => c.id === data.cardId);
          if (card && card.participants && card.participants.length > 0) {
            this.runner.questSystem.handleEvent({
              type: GameEventType.DIALOGUE_CARD_RESPONDED,
              entityId: card.participants[0],
              timestamp: Date.now(),
              data: {
                cardId: data.cardId,
              },
            });
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.NEED_CRITICAL,
      (data: { agentId: string; need: string; value: number }) => {
        const aiState = this.runner.aiSystem.getAIState(data.agentId);
        if (aiState && !aiState.currentGoal) {
          this.runner.aiSystem.forceGoalReevaluation(data.agentId);
        }
      },
    );

    this.registerEvent(
      GameEventNames.PATHFINDING_FAILED,
      (data: {
        entityId: string;
        targetZoneId: string;
        reason: string;
        timestamp: number;
      }) => {
        const aiState = this.runner.aiSystem.getAIState(data.entityId);
        if (aiState?.currentGoal?.targetZoneId === data.targetZoneId) {
          this.runner.aiSystem.failCurrentGoal(data.entityId);
        }
      },
    );

    this.registerEvent(
      GameEventNames.TASK_STALLED,
      (data: {
        taskId: string;
        taskType: string;
        zoneId?: string;
        stalledDuration: number;
        timestamp: number;
      }) => {
        const task = this.runner.taskSystem.getTask(data.taskId);
        if (task?.contributors) {
          for (const agentId of task.contributors.keys()) {
            const aiState = this.runner.aiSystem.getAIState(agentId);
            if (aiState?.currentGoal?.data?.taskId === data.taskId) {
              this.runner.aiSystem.failCurrentGoal(agentId);
            }
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.MOVEMENT_ARRIVED_AT_ZONE,
      (data: { entityId: string; zoneId: string }) => {
        this.runner.aiSystem.notifyEntityArrived(data.entityId, data.zoneId);
      },
    );

    this.registerEvent(
      GameEventNames.CRISIS_IMMEDIATE_WARNING,
      (_data: {
        prediction: {
          type: string;
          probability: number;
          severity: number;
          recommendedActions: string[];
        };
        timestamp: number;
      }) => {
        for (const agent of this.runner.state.agents) {
          this.runner.aiSystem.forceGoalReevaluation(agent.id);
        }
      },
    );

    this.registerEvent(
      GameEventNames.CRISIS_PREDICTION,
      (data: {
        prediction: {
          type: string;
          probability: number;
          severity: number;
          recommendedActions: string[];
        };
        timestamp: number;
      }) => {
        if (data.prediction.probability >= 0.6) {
          const relevantAgents: Array<{ id: string }> = [];
          for (const agent of this.runner.agentRegistry.getAllProfiles()) {
            const role = this.runner.roleSystem.getAgentRole(agent.id);
            if (!role) continue;
            if (
              [
                RoleType.GUARD,
                RoleType.BUILDER,
                RoleType.FARMER,
                RoleType.GATHERER,
              ].includes(role.roleType as RoleType)
            ) {
              relevantAgents.push(agent);
              if (relevantAgents.length >= 3) break;
            }
          }

          for (const agent of relevantAgents) {
            this.runner.aiSystem.forceGoalReevaluation(agent.id);
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.BUILDING_CONSTRUCTION_STARTED,
      (data: {
        jobId: string;
        zoneId: string;
        label: string;
        completesAt: number;
      }) => {
        const job = this.runner.buildingSystem.getConstructionJob(data.jobId);
        if (job?.taskId) {
          const task = this.runner.taskSystem.getTask(job.taskId);
          if (task && task.contributors) {
            task.contributors.forEach((_contribution, agentId) => {
              this.runner.questSystem.handleEvent({
                type: GameEventType.BUILDING_CONSTRUCTION_STARTED,
                entityId: agentId,
                timestamp: Date.now(),
                data: {
                  structureType: data.label,
                  jobId: data.jobId,
                },
              });
            });
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.AGENT_AGED,
      (data: {
        entityId: string;
        newAge: number;
        previousStage: string;
        currentStage: string;
      }) => {
        const agent = this.runner.entityIndex.getAgent(data.entityId);
        if (!agent) return;

        if (
          data.currentStage === LifeStage.ADULT &&
          data.previousStage === LifeStage.CHILD
        ) {
          const role = this.runner.roleSystem.getAgentRole(data.entityId);
          if (!role) {
            this.runner.roleSystem.assignBestRole(agent);
          }
          const house = this.runner.householdSystem.getHouseFor(data.entityId);
          if (!house) {
            this.runner.householdSystem.assignToHouse(data.entityId, "other");
          }
        }
        if (data.currentStage === LifeStage.ELDER) {
          const role = this.runner.roleSystem.getAgentRole(data.entityId);
          if (role) {
            const physicalRoles = [
              RoleType.LOGGER,
              RoleType.QUARRYMAN,
              RoleType.BUILDER,
              RoleType.GUARD,
            ];
            if (physicalRoles.includes(role.roleType as RoleType)) {
              const agent = this.runner.entityIndex.getAgent(data.entityId);
              if (agent) {
                this.runner.roleSystem.reassignRole(
                  data.entityId,
                  RoleType.GATHERER,
                );
              }
            }
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.TIME_CHANGED,
      (data: {
        time: {
          phase: string;
          hour: number;
          temperature: number;
        };
        timestamp: number;
      }) => {
        const period = data.time?.phase || "";
        if (period === "night" || period === "deep_night") {
          for (const agent of this.runner.state.agents) {
            const aiState = this.runner.aiSystem.getAIState(agent.id);
            if (aiState && !aiState.currentGoal && !aiState.offDuty) {
              const needs = this.runner.needsSystem.getNeeds(agent.id);
              if (needs && needs.energy < 70) {
                this.runner.aiSystem.forceGoalReevaluation(agent.id);
              }
            }
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.TASK_COMPLETED,
      (data: {
        taskId: string;
        completedBy: string[];
        completedAt: number;
        timestamp: number;
        cancelled?: boolean;
        reason?: string;
      }) => {
        if (data.cancelled) return;

        for (const agentId of data.completedBy) {
          this.runner.reputationSystem.updateReputation(
            agentId,
            0.05,
            "task_completed",
          );
        }

        for (const agentId of data.completedBy) {
          this.runner.questSystem.handleEvent({
            type: GameEventType.TASK_COMPLETED,
            entityId: agentId,
            timestamp: data.timestamp,
            data: { taskId: data.taskId },
          });
        }
      },
    );

    this.registerEvent(
      GameEventNames.KNOWLEDGE_LEARNED,
      (data: {
        agentId: string;
        knowledgeId: string;
        knowledgeType: string;
        timestamp: number;
      }) => {
        const aiState = this.runner.aiSystem.getAIState(data.agentId);
        if (aiState) {
          if (!aiState.memory.knownResourceLocations) {
            aiState.memory.knownResourceLocations = new Map();
          }
          aiState.memory.lastMemoryCleanup = Date.now();
        }
        this.runner.aiSystem.forceGoalReevaluation(data.agentId);
      },
    );

    this.registerEvent(
      GameEventNames.ROLE_ASSIGNED,
      (data: {
        agentId: string;
        roleType: string;
        roleId?: string;
        timestamp: number;
      }) => {
        if (
          data.roleType === RoleType.LEADER ||
          data.roleType === RoleType.GUARD
        ) {
          this.runner.reputationSystem.updateReputation(
            data.agentId,
            0.1,
            `role_assigned_${data.roleType}`,
          );
        }
      },
    );

    this.registerEvent(
      GameEventNames.NORM_SANCTION_APPLIED,
      (data: {
        agentId: string;
        violationType: string;
        reputationPenalty: number;
        trustPenalty?: number;
        truceDuration?: number;
        timestamp: number;
      }) => {
        this.runner.reputationSystem.updateReputation(
          data.agentId,
          data.reputationPenalty,
          `norm_violation_${data.violationType}`,
        );
      },
    );

    this.registerEvent(
      GameEventNames.CONFLICT_TRUCE_ACCEPTED,
      (data: {
        cardId: string;
        attackerId: string;
        targetId: string;
        truceBonus?: number;
        timestamp: number;
      }) => {
        this.runner.socialSystem.modifyAffinity(
          data.attackerId,
          data.targetId,
          data.truceBonus || 0.1,
        );
        this.runner.reputationSystem.updateReputation(
          data.targetId,
          0.02,
          "truce_accepted",
        );
      },
    );

    this.registerEvent(
      GameEventNames.CONFLICT_TRUCE_REJECTED,
      (data: {
        cardId: string;
        attackerId: string;
        targetId: string;
        timestamp: number;
      }) => {
        this.runner.socialSystem.modifyAffinity(
          data.attackerId,
          data.targetId,
          -0.15,
        );
      },
    );

    this.registerEvent(
      GameEventNames.COMBAT_HIT,
      (data: {
        attackerId: string;
        targetId: string;
        damage: number;
        weaponId?: string;
        timestamp: number;
      }) => {
        this.runner.needsSystem.modifyNeed(data.targetId, "energy", -5);
        this.runner.socialSystem.modifyAffinity(
          data.attackerId,
          data.targetId,
          -0.2,
        );
      },
    );

    this.registerEvent(
      GameEventNames.TASK_CREATED,
      (data: {
        taskId: string;
        taskType: string;
        zoneId?: string;
        createdBy?: string;
        timestamp: number;
      }) => {
        if (
          data.taskType === TaskType.BUILD_HOUSE ||
          data.taskType === TaskType.REPAIR_BUILDING
        ) {
          this.runner.questSystem.handleEvent({
            type: GameEventType.TASK_CREATED,
            entityId: data.createdBy || "system",
            timestamp: data.timestamp,
            data: { taskId: data.taskId, taskType: data.taskType },
          });
        }
      },
    );

    this.registerEvent(
      GameEventNames.TASK_PROGRESS,
      (data: {
        taskId: string;
        agentId: string;
        contribution: number;
        progress: number;
        timestamp: number;
      }) => {
        const task = this.runner.taskSystem.getTask(data.taskId);
        if (task && task.contributors) {
          const contributorCount = task.contributors.size;
          if (contributorCount > 1 && data.contribution > 10) {
            this.runner.reputationSystem.updateReputation(
              data.agentId,
              0.01,
              "collaborative_work",
            );
          }
        }
      },
    );

    this.registerEvent(
      GameEventNames.BUILDING_REPAIRED,
      (data: {
        zoneId: string;
        buildingType: string;
        repairedBy: string;
        health: number;
        maxHealth: number;
        timestamp: number;
      }) => {
        this.runner.reputationSystem.updateReputation(
          data.repairedBy,
          0.03,
          "building_repaired",
        );
      },
    );

    this.eventCaptureListener = (eventName: string, payload: unknown): void => {
      this.runner.capturedEvents.push({
        type: eventName as GameEventType,
        payload: payload as SimulationEventPayload | undefined,
        timestamp: Date.now(),
      });
    };

    Object.values(GameEventNames).forEach((eventName) => {
      simulationEvents.on(eventName, (payload: unknown) => {
        if (this.eventCaptureListener) {
          this.eventCaptureListener(eventName, payload);
        }
      });
    });
  }

  public cleanup(): void {
    this.eventCleanups.forEach((cleanup) => cleanup());
    this.eventCleanups = [];
  }
}
