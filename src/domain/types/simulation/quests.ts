export interface Quest {
  id: string;
  title: string;
  description: string;
  loreText?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard" | "daily";
  status: "available" | "active" | "completed" | "failed" | "not_started";
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
  type:
    | "experience"
    | "money"
    | "item"
    | "stats_boost"
    | "title"
    | "unlock_feature";
  amount?: number;
  itemId?: string;
  statsBoost?: Record<string, number>;
  title?: string;
  unlockId?: string;
}

export interface QuestRequirement {
  type: "quest_completed" | "stats_threshold" | "time_elapsed" | "item_owned";
  questId?: string;
  entityId?: string;
  stat?: string;
  value?: number;
  duration?: number;
  itemId?: string;
}

export interface QuestDialogue {
  stage: "intro" | "progress" | "completion" | "failure";
  speaker: string;
  text: string;
  mood?: string;
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

export interface QuestEvent {
  type: string;
  questId: string;
  objectiveId?: string;
  timestamp: number;
}
