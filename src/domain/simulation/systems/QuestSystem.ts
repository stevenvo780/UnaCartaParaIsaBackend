import { GameState } from "../../types/game-types";
import {
  Quest,
  QuestProgress,
  QuestEvent,
} from "../../types/simulation/quests";
// QuestObjective removed from imports as it's not used in this file

const QUEST_CATALOG: Quest[] = [
  {
    id: "tutorial_survival",
    title: "First Steps",
    description: "Learn the basics of survival",
    status: "available",
    objectives: [
      {
        id: "obj_1",
        type: "collect_resource",
        description: "Gather 5 wood",
        target: "wood",
        requiredAmount: 5,
        currentAmount: 0,
        isCompleted: false,
      },
      {
        id: "obj_2",
        type: "collect_resource",
        description: "Gather 3 food",
        target: "food",
        requiredAmount: 3,
        currentAmount: 0,
        isCompleted: false,
      },
    ],
    rewards: [
      { type: "experience", amount: 50 },
      { type: "title", title: "Survivor" },
    ],
    requirements: [],
    dialogues: [
      {
        stage: "intro",
        speaker: "Guide",
        text: "Welcome! Let's start by gathering some basic resources.",
        mood: "friendly",
      },
      {
        stage: "completion",
        speaker: "Guide",
        text: "Well done! You've learned the basics of survival.",
        mood: "happy",
      },
    ],
  },
  {
    id: "build_shelter",
    title: "A Place to Rest",
    description: "Build your first shelter",
    status: "available",
    objectives: [
      {
        id: "obj_1",
        type: "build_structure",
        description: "Build a basic shelter",
        target: "shelter",
        requiredAmount: 1,
        currentAmount: 0,
        isCompleted: false,
      },
    ],
    rewards: [
      { type: "experience", amount: 100 },
      { type: "unlock_feature", unlockId: "advanced_building" },
    ],
    requirements: [{ type: "quest_completed", questId: "tutorial_survival" }],
    dialogues: [
      {
        stage: "intro",
        speaker: "Guide",
        text: "Now that you can gather resources, let's build a shelter.",
        mood: "encouraging",
      },
      {
        stage: "completion",
        speaker: "Guide",
        text: "Excellent! Your shelter will protect you from the elements.",
        mood: "proud",
      },
    ],
  },
];

export class QuestSystem {
  private gameState: GameState;
  private questProgress: QuestProgress;
  private gameStartTime: number;

  constructor(gameState: GameState) {
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
        if (questCopy.status === "available") {
          this.questProgress.availableQuests.set(questCopy.id, questCopy);
        }
      }
    });
  }

  public update(): void {
    const now = Date.now();

    this.questProgress.activeQuests.forEach((quest) => {
      // Check timeouts
      if (quest.timeLimit && quest.startedAt) {
        const elapsedTime = now - quest.startedAt;
        const timeLimit = quest.timeLimit * 1000;

        if (elapsedTime >= timeLimit) {
          this.failQuest(quest.id, "timeout");
          return;
        }
      }

      // Check time-based objectives
      quest.objectives.forEach((objective) => {
        if (objective.isCompleted) return;

        if (objective.type === "survive_time" && objective.requiredAmount) {
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
    quest.status = "active";
    quest.startedAt = Date.now();
    this.questProgress.activeQuests.set(questId, quest);

    this.questProgress.questHistory.push({
      questId,
      action: "started",
      timestamp: Date.now(),
    });

    const event: QuestEvent = {
      type: "QUEST_STARTED",
      questId,
      timestamp: Date.now(),
    };

    return { success: true, event };
  }

  public completeQuest(questId: string): {
    success: boolean;
    rewards?: Quest["rewards"];
    event?: QuestEvent;
    unlockedFeatures?: string[];
  } {
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest || quest.status !== "active") {
      return { success: false };
    }

    const incompleteObjectives = quest.objectives.filter(
      (obj) => !obj.isCompleted && !obj.isOptional,
    );

    if (incompleteObjectives.length > 0) {
      return { success: false };
    }

    quest.status = "completed";
    quest.completedAt = Date.now();
    this.questProgress.activeQuests.delete(questId);
    this.questProgress.completedQuests.set(questId, quest);
    this.questProgress.totalQuestsCompleted++;

    const { unlockedFeatures } = this.applyQuestRewards(quest);

    this.questProgress.questHistory.push({
      questId,
      action: "completed",
      timestamp: Date.now(),
    });

    this.checkForNewAvailableQuests();

    const event: QuestEvent = {
      type: "QUEST_COMPLETED",
      questId,
      timestamp: Date.now(),
    };

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
        type: "QUEST_OBJECTIVE_COMPLETED",
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
    // reason parameter kept for API compatibility
    void _reason;
    const quest = this.questProgress.activeQuests.get(questId);
    if (!quest) return null;

    quest.status = "failed";
    quest.completedAt = Date.now();

    this.questProgress.activeQuests.delete(questId);
    this.questProgress.failedQuests.set(questId, quest);

    this.questProgress.questHistory.push({
      questId,
      action: "failed",
      timestamp: Date.now(),
    });

    return {
      type: "QUEST_FAILED",
      questId,
      timestamp: Date.now(),
    };
  }

  private applyQuestRewards(quest: Quest): { unlockedFeatures: string[] } {
    const unlockedFeatures: string[] = [];

    quest.rewards.forEach((reward) => {
      switch (reward.type) {
        case "experience":
          this.questProgress.totalExperienceGained += reward.amount || 0;
          break;

        case "title":
          if (reward.title) {
            this.questProgress.unlockedTitles.push(reward.title);
          }
          break;

        case "unlock_feature":
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
          questCopy.status = "available";
          this.questProgress.availableQuests.set(quest.id, questCopy);
        }
      }
    });
  }

  private checkQuestRequirements(quest: Quest): boolean {
    return quest.requirements.every((req) => {
      switch (req.type) {
        case "quest_completed":
          return req.questId
            ? this.questProgress.completedQuests.has(req.questId)
            : false;

        case "time_elapsed":
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
    // Check if quest is already in any state
    if (this.getQuest(questId)) {
      return false;
    }

    const questTemplate = QUEST_CATALOG.find((q) => q.id === questId);
    if (!questTemplate) {
      return false;
    }

    const questCopy = JSON.parse(JSON.stringify(questTemplate)) as Quest;
    questCopy.status = "available";

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
    data: Record<string, unknown>;
  }): void {
    switch (eventData.type) {
      case "dialogue_completed":
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === "talk_to_npc" &&
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

      case "resource_collected":
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === "collect_resource" &&
              !objective.isCompleted &&
              objective.target === eventData.data.resourceType
            ) {
              this.updateObjectiveProgress(
                quest.id,
                objective.id,
                (eventData.data.amount as number) || 1,
              );
            }
          });
        });
        break;

      case "structure_built":
        this.questProgress.activeQuests.forEach((quest) => {
          quest.objectives.forEach((objective) => {
            if (
              objective.type === "build_structure" &&
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
