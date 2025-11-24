import type { WorldResourceInstance } from "../simulation/types/worldResources.js";
import type { GovernanceSnapshot } from "../simulation/types/governance.js";
import type { CombatLogEntry } from "../simulation/types/combat.js";
import type {
  AmbientSnapshot,
  CrisisSnapshot,
  DialogueStateSnapshot,
  ResourceAttractionSnapshot,
} from "../simulation/types/ambient.js";
import type { AgentProfile } from "../simulation/types/agents.js";
import type { SimulationEntity } from "../simulation/schema.js";
import type { SocialGroup } from "../simulation/types/social.js";
import type { MarketOrder, Transaction } from "../simulation/types/economy.js";
import type { AgentRole } from "../simulation/types/roles.js";
import type { LegendRecord } from "../simulation/types/legends.js";
import type { FamilyTree } from "../simulation/types/genealogy.js";
import type { Inventory } from "../simulation/types/economy.js";
import type { TradeOffer, TradeRecord } from "../simulation/types/trade.js";
import type { MarriageGroup, MarriageProposal } from "../simulation/types/marriage.js";
import type { Quest } from "../simulation/types/quests.js";
import type { ActiveConflict, ConflictRecord, ConflictStats } from "../simulation/types/conflict.js";
import type { Animal } from "../simulation/types/animals.js";
import type { TechTreeState } from "../simulation/types/research.js";
import type { CraftingRecipe } from "../simulation/types/recipes.js";
import type { SerializedReputationData } from "../simulation/types/reputation.js";
import type { NormViolation, SanctionRecord, NormComplianceStats } from "../simulation/types/norms.js";

export interface Position {
  x: number;
  y: number;
}

export interface GameMap {
  width: number;
  height: number;
  tileSize: number;
  biomeMap: string[][];
}

export interface ZoneProps {
  resource?: "wood" | "stone" | "food" | "water";
  capacity?: number;
  [key: string]: unknown;
}

export interface Zone {
  id: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  props?: ZoneProps;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size { }

export type InteractionType =
  | "NOURISH"
  | "FEED"
  | "PLAY"
  | "COMFORT"
  | "DISTURB"
  | "WAKE_UP"
  | "LET_SLEEP";

export interface DialogueEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface ConversationState {
  isActive: boolean;
  participants: string[];
  lastSpeaker: string | null;
  lastDialogue: DialogueEntry | null;
  startTime: number;
}

export interface GameResources {
  energy: number;
  materials: {
    wood: number;
    stone: number;
    food: number;
    water: number;
  };
  currency: number;
  experience: number;
  unlockedFeatures: string[];
}

export interface WeatherState {
  current: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  lastChange: number;
  duration: number;
}

export interface TerrainTile {
  x: number;
  y: number;
  assetId: string;
  type: "grass" | "stone" | "water" | "path";
  variant?: number;
  isWalkable?: boolean;
  biome?: string;
}

export interface RoadPolyline {
  id: string;
  points: Position[];
  width: number;
  type: "main" | "secondary" | "path";
}

export interface MapObject {
  id: string;
  type: string;
  x: number;
  y: number;
  properties?: Record<string, unknown>;
}

export interface ObjectLayer {
  id: string;
  name: string;
  objects: MapObject[];
  zIndex: number;
  visible: boolean;
}

export interface MarketState {
  orders: MarketOrder[];
  transactions: Transaction[];
  prices: Record<string, number>;
}

export interface SocialGraphState {
  groups: SocialGroup[];
  relationships: Map<string, Map<string, number>>;
}

export interface RolesState {
  assignments: Map<string, AgentRole>;
  schedules: Map<string, string[]>;
}

export interface LegendsState {
  records: Map<string, LegendRecord>;
  activeLegends: string[];
}

export interface InventoryState {
  global: Inventory;
  stockpiles: Map<string, Inventory>;
}

export interface MapElement {
  id: string;
  type: string;
  position: Position;
  properties?: Record<string, unknown>;
}

export interface TradeState {
  offers: TradeOffer[];
  history: TradeRecord[];
  stats: {
    activeOffers: number;
    totalTrades: number;
    avgTradeValue: number;
  };
}

export interface MarriageState {
  groups: MarriageGroup[];
  proposals: Array<{
    targetId: string;
    proposerId: string;
    timestamp: number;
  }>;
  stats: {
    totalMarriages: number;
    totalMembers: number;
    avgGroupSize: number;
    avgCohesion: number;
    largestGroup: number;
    activeProposals: number;
  };
}

export interface QuestState {
  active: Quest[];
  available: Quest[];
  completed: Quest[];
  totalCompleted: number;
  totalExperience: number;
}

export interface ConflictState {
  active: ActiveConflict[];
  history: ConflictRecord[];
  stats: ConflictStats;
}

export interface ResearchState {
  techTree: TechTreeState;
  lineages: Array<{
    lineageId: string;
    stats: {
      totalCategories: number;
      unlockedCategories: number;
      completedCategories: number;
      totalProgress: number;
      specializations: string[];
    };
  }>;
}

export interface RecipeState {
  discovered: string[];
  agentRecipes: Record<string, Array<{
    recipeId: string;
    discoveredAt: number;
    timesUsed: number;
    successRate: number;
    proficiency: number;
  }>>;
}

export interface ReputationState {
  data: SerializedReputationData;
  stats: {
    agents: number;
    avgReputation: number;
    trustEdges: number;
  };
}

export interface NormsState {
  violations: NormViolation[];
  sanctions: SanctionRecord[];
  stats: NormComplianceStats;
  truces: Array<{
    cardId: string;
    attackerId: string;
    targetId: string;
    expiresAt: number;
  }>;
}

export interface AnimalState {
  animals: Animal[];
  stats: {
    total: number;
    byType: Record<string, number>;
  };
}

export interface GameState {
  agents: AgentProfile[];
  entities: SimulationEntity[];
  zones: Zone[];
  resources: GameResources;
  time: number;
  dayTime: number;
  togetherTime: number;
  cycles: number;
  weather: WeatherState;
  timeOfDay?: string;
  worldResources?: Record<string, WorldResourceInstance>;
  socialGraph?: SocialGraphState;
  market?: MarketState;
  inventory?: InventoryState;
  roles?: RolesState;
  legends?: LegendsState;
  genealogy?: FamilyTree;
  governance?: GovernanceSnapshot;
  combatLog?: CombatLogEntry[];
  resourceAttraction?: ResourceAttractionSnapshot;
  crisisForecast?: CrisisSnapshot;
  ambientMood?: AmbientSnapshot;
  dialogueState?: DialogueStateSnapshot;
  trade?: TradeState;
  marriage?: MarriageState;
  quests?: QuestState;
  conflicts?: ConflictState;
  research?: ResearchState;
  recipes?: RecipeState;
  reputation?: ReputationState;
  norms?: NormsState;
  animals?: AnimalState;

  // Legacy/Frontend fields (kept for compatibility if needed)
  resonance?: number;
  lastSave?: number;
  connectionAnimation?: {
    active: boolean;
    startTime: number;
    type: InteractionType;
    entityId?: string;
  };
  mapElements?: MapElement[];
  mapSeed?: string;
  currentConversation?: ConversationState;
  terrainTiles?: TerrainTile[];
  world?: {
    terrain: Array<
      Array<{
        x: number;
        y: number;
        biome: string;
        assets: {
          terrain: string;
          vegetation?: string[];
          structures?: string[];
        };
        isWalkable: boolean;
      }>
    >;
    config: {
      width: number;
      height: number;
      tileSize: number;
      seed: number;
    };
  };
  roads?: RoadPolyline[];
  objectLayers?: ObjectLayer[];
  worldSize?: Size;
  generatorVersion?: string;
  playerLevel?: number;
  exploredBiomes?: string[];
  unlockedAssets?: string[];
}
