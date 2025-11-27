import {
  QuestStatus,
  QuestDifficulty,
  QuestRewardType,
  QuestRequirementType,
  QuestDialogueStage,
} from "../../../shared/constants/QuestEnums";
import { DialogueSpeaker } from "../../../shared/constants/AmbientEnums";

export interface Quest {
  id: string;
  title: string;
  description: string;
  loreText?: string;
  category?: string;
  difficulty?: QuestDifficulty;
  status: QuestStatus;
  version?: number;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  requirements: QuestRequirement[];
  dialogues: QuestDialogue[];
  timeLimit?: number;
  startedAt?: number;
  completedAt?: number;
  introText?: string;
  progressTexts?: string[];
  completionText?: string;
  failureText?: string;
  estimatedDuration?: number;
  tags?: string[];
  isHidden?: boolean;
  isRepeatable?: boolean;
}

export interface QuestObjective {
  id: string;
  type: string;
  description: string;
  target?: string;
  targetEntity?: string;
  targetLocation?: { x: number; y: number; radius?: number };
  requiredAmount?: number;
  currentAmount?: number;
  isCompleted: boolean;
  isOptional?: boolean;
  completedAt?: number;
  hints?: string[];
  requirements?: {
    stats?: Record<string, number>;
  };
}

export interface QuestReward {
  type: QuestRewardType;
  amount?: number;
  itemId?: string;
  statsBoost?: Record<string, number>;
  title?: string;
  unlockId?: string;
  description?: string;
}

export interface QuestRequirement {
  type: QuestRequirementType;
  questId?: string;
  entityId?: string;
  stat?: string;
  value?: number;
  duration?: number;
  itemId?: string;
  statsRequired?: Record<string, number>;
}

export interface QuestDialogue {
  stage: QuestDialogueStage;
  speaker: DialogueSpeaker;
  text: string;
  mood?: string;
  conditions?: Record<string, unknown>;
}

export interface QuestProgress {
  activeQuests: Map<string, Quest>;
  completedQuests: Map<string, Quest>;
  failedQuests: Map<string, Quest>;
  availableQuests: Map<string, Quest>;
  questHistory: Array<{ questId: string; action: string; timestamp: number }>;
  totalQuestsCompleted: number;
  totalExperienceGained: number;
  unlockedTitles: string[];
}

import { GameEventType } from "../../../shared/constants/EventEnums";

export interface QuestEvent {
  type: GameEventType;
  questId: string;
  objectiveId?: string;
  timestamp: number;
}
