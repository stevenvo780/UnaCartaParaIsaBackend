import { GameState } from "../../types/game-types";
import {
  Quest,
  QuestProgress,
  QuestEvent,
} from "../../types/simulation/quests";
import { simulationEvents, GameEventType } from "../core/events";
import {
  QuestStatus,
  QuestRewardType,
  QuestRequirementType,
  QuestDialogueStage,
  QuestObjectiveType,
  QuestAction,
  QuestID,
} from "../../../shared/constants/QuestEnums";
import {
  DialogueSpeaker,
  DialogueTone,
} from "../../../shared/constants/AmbientEnums";

const QUEST_CATALOG: Quest[] = [
  {
    id: QuestID.TUTORIAL_SURVIVAL,
    title: "First Steps",
    description: "Learn the basics of survival",
    status: QuestStatus.AVAILABLE,
    objectives: [
      {
        id: "obj_1",
        type: QuestObjectiveType.COLLECT_RESOURCE,
        description: "Gather 5 wood",
        target: "wood",
        requiredAmount: 5,
        currentAmount: 0,
        isCompleted: false,
      },
      {
        id: "obj_2",
        type: QuestObjectiveType.COLLECT_RESOURCE,
        description: "Gather 3 food",
        target: "food",
        requiredAmount: 3,
        currentAmount: 0,
        isCompleted: false,
      },
    ],
    rewards: [
      { type: QuestRewardType.EXPERIENCE, amount: 50 },
      { type: QuestRewardType.TITLE, title: "Survivor" },
    ],
    requirements: [],
    dialogues: [
      {
        stage: QuestDialogueStage.INTRO,
        speaker: DialogueSpeaker.SYSTEM,
        text: "Welcome! Let's start by gathering some basic resources.",
        mood: DialogueTone.FRIENDLY,
      },
      {
        stage: QuestDialogueStage.COMPLETION,
        speaker: DialogueSpeaker.SYSTEM,
        text: "Well done! You've learned the basics of survival.",
        mood: DialogueTone.HAPPY,
      },
    ],
  },
  {
    id: QuestID.BUILD_SHELTER,
    title: "A Place to Rest",
    description: "Build your first shelter",
    status: QuestStatus.AVAILABLE,
    objectives: [
      {
        id: "obj_1",
        type: QuestObjectiveType.BUILD_STRUCTURE,
        description: "Build a basic shelter",
        target: "shelter",
        requiredAmount: 1,
        currentAmount: 0,
        isCompleted: false,
      },
    ],
    rewards: [
      { type: QuestRewardType.EXPERIENCE, amount: 100 },
      {
        type: QuestRewardType.UNLOCK_FEATURE,
        unlockId: "advanced_building",
      },
    ],
    requirements: [
      {
        type: QuestRequirementType.QUEST_COMPLETED,
        questId: QuestID.TUTORIAL_SURVIVAL,
      },
    ],
    dialogues: [
      {
        stage: QuestDialogueStage.INTRO,
        speaker: DialogueSpeaker.SYSTEM,
        text: "Now that you can gather resources, let's build a shelter.",
        mood: DialogueTone.ENCOURAGING,
      },
      {
        stage: QuestDialogueStage.COMPLETION,
        speaker: DialogueSpeaker.SYSTEM,
        text: "Excellent! Your shelter will protect you from the elements.",
        mood: DialogueTone.PROUD,
      },
    ],
  },
];

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class QuestSystem {
  private gameState: GameState;
  private questProgress: QuestProgress;
  private gameStartTime: number;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.gameStartTime = Date.now();

    this.questProgress = {
      activeQuests: new Map(),
      completedQuests: new Map(),
      failedQuests: new Map(),
      availableQuests: new Map(),
      questHistory: [],
      totalQuestsCompleted: 0,
      totalExperienceGained: 0,
      unlockedTitles: [],
    };

    this.initializeQuests();
  }

  private initializeQuests(): void {
    QUEST_CATALOG.forEach((quest) => {
      const questCopy = JSON.parse(JSON.stringify(quest)) as Quest;

      if (this.checkQuestRequirements(questCopy)) {
        if (questCopy.status === QuestStatus.AVAILABLE) {
          this.questProgress.availableQuests.set(questCopy.id, questCopy);
        }
      }
    });
  }

  public update(): void {
    const now = Date.now();

    this.questProgress.activeQuests.forEach((quest) => {
      if (quest.timeLimit && quest.startedAt) {
        const elapsedTime = now - quest.startedAt;
        const timeLimit = quest.timeLimit * 1000;

        if (elapsedTime >= timeLimit) {
          this.failQuest(quest.id, "timeout");
          return;
        }
      }

      quest.objectives.forEach((objective) => {
        if (objective.isCompleted) return;

        if (
          objective.type === QuestObjectiveType.SURVIVE_TIME &&
          objective.requiredAmount
        ) {
          const elapsedTime = now - (quest.startedAt || now);
          if (elapsedTime >= objective.requiredAmount * 1000) {
            this.updateObjectiveProgress(quest.id, objective.id);
          }
        }
      });
    });

    if (!this.gameState.quests) {
      this.gameState.quests = {
        active: [],
        available: [],
        completed: [],
        totalCompleted: 0,
        totalExperience: 0,
      };
    }

    this.gameState.quests.active = this.getActiveQuests();
    this.gameState.quests.available = this.getAvailableQuests();
    this.gameState.quests.completed = this.getCompletedQuests();
    this.gameState.quests.totalCompleted =
      this.questProgress.totalQuestsCompleted;
    this.gameState.quests.totalExperience =
      this.questProgress.totalExperienceGained;
  }

  public startQuest(questId: string): { success: boolean; event?: QuestEvent } {
    const quest = this.questProgress.availableQuests.get(questId);
    if (!quest) {
      return { success: false };
    }

    if (this.questProgress.activeQuests.size >= 5) {
      return { success: false };
    }

    this.questProgress.availableQuests.delete(questId);
    quest.status = QuestStatus.ACTIVE;
    quest.startedAt = Date.now();
    this.questProgress.activeQuests.set(questId, quest);

    this.questProgress.questHistory.push({
      questId,
      action: QuestAction.STARTED,
      timestamp: Date.now(),
    });

    const event: QuestEvent = {
      type: GameEventType.QUEST_STARTED,
      questId,
      timestamp: Date.now(),
    };

    simulationEvents.emit(GameEventType.QUEST_STARTED, {
      questId,
      questTitle: quest.title,
      timestamp: Date.now(),
    });

    return { success: true, event };
  }

  public completeQuest(questId: string): {
    success: boolean;
    rewards?: Quest["rewards"];
    event?: QuestEvent;
    unlockedFeatures?: string[];
  } {
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) {
      return { success: false };
    }

    const incompleteObjectives = quest.objectives.filter(
      (obj) => !obj.isCompleted && !obj.isOptional,
    );

    if (incompleteObjectives.length > 0) {
      return { success: false };
    }

    quest.status = QuestStatus.COMPLETED;
    quest.completedAt = Date.now();
    this.questProgress.activeQuests.delete(questId);
    this.questProgress.completedQuests.set(questId, quest);
    this.questProgress.totalQuestsCompleted++;

    const { unlockedFeatures } = this.applyQuestRewards(quest);

    this.questProgress.questHistory.push({
      questId,
      action: QuestAction.COMPLETED,
      timestamp: Date.now(),
    });

    this.checkForNewAvailableQuests();

    const event: QuestEvent = {
      type: GameEventType.QUEST_COMPLETED,
      questId,
      timestamp: Date.now(),
    };

    simulationEvents.emit(GameEventType.QUEST_COMPLETED, {
      questId,
      questTitle: quest.title,
      rewards: quest.rewards,
      unlockedFeatures,
      timestamp: Date.now(),
    });

    return {
      success: true,
      rewards: quest.rewards,
      event,
      unlockedFeatures,
    };
  }

  public updateObjectiveProgress(
    questId: string,
    objectiveId: string,
    amount = 1,
  ): { completed: boolean; event?: QuestEvent } {
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest) return { completed: false };

    const objective = quest.objectives.find((obj) => obj.id === objectiveId);
    if (!objective || objective.isCompleted) return { completed: false };

    if (objective.requiredAmount) {
      objective.currentAmount = (objective.currentAmount || 0) + amount;

      if (objective.currentAmount >= objective.requiredAmount) {
        objective.isCompleted = true;
        objective.completedAt = Date.now();
      }
    } else {
      objective.isCompleted = true;
      objective.completedAt = Date.now();
    }

    if (objective.isCompleted) {
      const event: QuestEvent = {
        type: GameEventType.QUEST_COMPLETED,
        questId,
        objectiveId,
        timestamp: Date.now(),
      };

      this.checkQuestCompletion(questId);

      return { completed: true, event };
    }

    return { completed: false };
  }

  private failQuest(questId: string, _reason: string): QuestEvent | null {
    void _reason;
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest) return null;

    quest.status = QuestStatus.FAILED;
    quest.completedAt = Date.now();

    this.questProgress.activeQuests.delete(questId);
    this.questProgress.failedQuests.set(questId, quest);

    this.questProgress.questHistory.push({
      questId,
      action: QuestAction.FAILED,
      timestamp: Date.now(),
    });

    const event: QuestEvent = {
      type: GameEventType.QUEST_FAILED,
      questId,
      timestamp: Date.now(),
    };

    simulationEvents.emit(GameEventType.QUEST_FAILED, {
      questId,
      questTitle: quest.title,
      reason: _reason,
      timestamp: Date.now(),
    });

    return event;
  }

  private applyQuestRewards(quest: Quest): { unlockedFeatures: string[] } {
    const unlockedFeatures: string[] = [];

    quest.rewards.forEach((reward) => {
      switch (reward.type) {
        case QuestRewardType.EXPERIENCE:
          this.questProgress.totalExperienceGained += reward.amount || 0;
          break;

        case QuestRewardType.TITLE:
          if (reward.title) {
            this.questProgress.unlockedTitles.push(reward.title);
          }
          break;

        case QuestRewardType.UNLOCK_FEATURE:
          if (reward.unlockId) {
            unlockedFeatures.push(reward.unlockId);
          }
          break;
      }
    });

    return { unlockedFeatures };
  }

  private checkQuestCompletion(questId: string): void {
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest) return;

    const incompleteObjectives = quest.objectives.filter(
      (obj) => !obj.isCompleted && !obj.isOptional,
    );

    if (incompleteObjectives.length === 0) {
      this.completeQuest(questId);
    }
  }

  private checkForNewAvailableQuests(): void {
    QUEST_CATALOG.forEach((quest) => {
      if (
        !this.questProgress.availableQuests.has(quest.id) &&
        !this.questProgress.activeQuests.has(quest.id) &&
        !this.questProgress.completedQuests.has(quest.id) &&
        !this.questProgress.failedQuests.has(quest.id)
      ) {
        if (this.checkQuestRequirements(quest)) {
          const questCopy = JSON.parse(JSON.stringify(quest)) as Quest;
          questCopy.status = QuestStatus.AVAILABLE;
          this.questProgress.availableQuests.set(quest.id, questCopy);
        }
      }
    });
  }

  private checkQuestRequirements(quest: Quest): boolean {
    return quest.requirements.every((req) => {
      switch (req.type) {
        case QuestRequirementType.QUEST_COMPLETED:
          return req.questId
            ? this.questProgress.completedQuests.has(req.questId)
            : false;

        case QuestRequirementType.TIME_ELAPSED:
          if (req.duration) {
            const elapsed = Date.now() - this.gameStartTime;
            return elapsed >= req.duration;
          }
          return false;

        default:
          return true;
      }
    });
  }

  public getQuestProgress(): QuestProgress {
    return { ...this.questProgress };
  }

  public getActiveQuests(): Quest[] {
    return Array.from(this.questProgress.activeQuests.values());
  }

  public getAvailableQuests(): Quest[] {
    return Array.from(this.questProgress.availableQuests.values());
  }

  public getCompletedQuests(): Quest[] {
    return Array.from(this.questProgress.completedQuests.values());
  }

  public getQuest(questId: string): Quest | undefined {
    return (
      this.questProgress.activeQuests.get(questId) ||
      this.questProgress.availableQuests.get(questId) ||
      this.questProgress.completedQuests.get(questId) ||
      this.questProgress.failedQuests.get(questId)
    );
  }

  /**
   * Make a quest available if it's not already available, active, completed, or failed
   */
  public makeQuestAvailable(questId: string): boolean {
    if (this.getQuest(questId)) {
      return false;
    }

    const questTemplate = QUEST_CATALOG.find((q) => q.id === questId);
    if (!questTemplate) {
      return false;
    }

    const questCopy = JSON.parse(JSON.stringify(questTemplate)) as Quest;
    questCopy.status = QuestStatus.AVAILABLE;

    if (this.checkQuestRequirements(questCopy)) {
      this.questProgress.availableQuests.set(questId, questCopy);
      return true;
    }

    return false;
  }

  public handleEvent(eventData: {
    type: string;
    entityId: string;
    timestamp: number;
    data: QuestEventData;
  }): void {
    switch (eventData.type) {
      case QuestRequirementType.QUEST_COMPLETED:
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === QuestObjectiveType.TALK_TO_NPC &&
              !objective.isCompleted &&
              (objective.target === eventData.entityId ||
                objective.target === eventData.data.cardId ||
                objective.target === "any")
            ) {
              this.updateObjectiveProgress(quest.id, objective.id);
            }
          });
        });
        break;

      case GameEventType.RESOURCE_GATHERED:
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === QuestObjectiveType.COLLECT_RESOURCE &&
              !objective.isCompleted &&
              objective.target === eventData.data.resourceType
            ) {
              const amount =
                typeof eventData.data.amount === "number"
                  ? eventData.data.amount
                  : 1;
              this.updateObjectiveProgress(quest.id, objective.id, amount);
            }
          });
        });
        break;

      case GameEventType.BUILDING_CONSTRUCTED:
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === QuestObjectiveType.BUILD_STRUCTURE &&
              !objective.isCompleted &&
              objective.target === eventData.data.structureType
            ) {
              this.updateObjectiveProgress(quest.id, objective.id);
            }
          });
        });
        break;
    }
  }

  public cleanup(): void {
    this.questProgress.activeQuests.clear();
    this.questProgress.availableQuests.clear();
    this.questProgress.completedQuests.clear();
    this.questProgress.failedQuests.clear();
    this.questProgress.questHistory = [];
  }
}

export interface QuestEventData {
  cardId?: string;
  dialogueId?: string;
  itemId?: string;
  itemType?: string;
  resourceType?: string;
  structureType?: string;
  amount?: number;
  locationId?: string;
  zoneId?: string;
  [key: string]: string | number | undefined;
}
