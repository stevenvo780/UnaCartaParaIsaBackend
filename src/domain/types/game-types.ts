/**
 * Core game type definitions.
 *
 * Defines the complete game state structure, including agents, entities,
 * zones, resources, and all simulation subsystems.
 *
 * @module domain/types/game-types
 */

import type { WorldResourceInstance } from "./simulation/worldResources";
import type { GovernanceSnapshot } from "./simulation/governance";
import type { CombatLogEntry } from "./simulation/combat";
import type {
  AmbientSnapshot,
  CrisisSnapshot,
  DialogueStateSnapshot,
  ResourceAttractionSnapshot,
} from "./simulation/ambient";
import type { AgentProfile } from "./simulation/agents";
import type { SimulationEntity } from "../simulation/core/schema";
import type { SocialGroup } from "./simulation/social";
import type { MarketOrder, Transaction } from "./simulation/economy";
import type { AgentRole } from "./simulation/roles";
import type { LegendRecord } from "./simulation/legends";
import type { FamilyTree, SerializedFamilyTree } from "./simulation/genealogy";
import type { Inventory } from "./simulation/economy";
/**
 * Economy system state tracking work actions and resource production.
 */
export interface EconomyState {
  totalWorkActions: number;
  totalResourcesProduced: {
    wood: number;
    stone: number;
    food: number;
    water: number;
  };
  averageYield: {
    wood: number;
    stone: number;
    food: number;
    water: number;
  };
  totalSalariesPaid: number;
  activeWorkers: number;
}
import type { TradeOffer, TradeRecord } from "./simulation/trade";
import type { MarriageGroup } from "./simulation/marriage";
import type { Quest } from "./simulation/quests";
import type {
  ActiveConflict,
  ConflictRecord,
  ConflictStats,
} from "./simulation/conflict";
import type { Animal } from "./simulation/animals";
import type { TechTreeState } from "./simulation/research";
import type { SerializedReputationData } from "./simulation/reputation";
import type {
  NormViolation,
  SanctionRecord,
  NormComplianceStats,
} from "./simulation/norms";

/**
 * 2D position coordinates.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * World map configuration.
 */
export interface GameMap {
  width: number;
  height: number;
  tileSize: number;
  biomeMap: string[][];
}

export interface ZoneProps {
  resource?: "wood" | "stone" | "food" | "water";
  capacity?: number;
  efficiency?: number;
  quality?: number;
  ownerId?: string;
  accessLevel?: "public" | "private" | "restricted";
  [key: string]: string | number | undefined;
}

export interface Zone {
  id: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  props?: ZoneProps;
  metadata?: Record<string, unknown>;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Rectangle with position and size.
 */
export interface Rect extends Position, Size {}

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

export interface SimulationTerrainTile {
  x: number;
  y: number;
  biome: string;
  assets: {
    terrain: string;
    vegetation?: string[];
    structures?: string[];
  };
  isWalkable: boolean;
}

export interface RoadPolyline {
  id: string;
  points: Position[];
  width: number;
  type: "main" | "secondary" | "path";
}

export interface MapObjectProperties {
  name?: string;
  description?: string;
  interactable?: boolean;
  resourceType?: string;
  capacity?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface MapObject {
  id: string;
  type: string;
  x: number;
  y: number;
  properties?: MapObjectProperties;
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
  stockpiles: Record<string, Inventory>;
  agents: Record<string, Inventory>;
}

export interface MapElement {
  id: string;
  type: string;
  position: Position;
  width?: number;
  height?: number;
  properties?: MapObjectProperties;
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
  activeConflicts?: ActiveConflict[];
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
  agentRecipes: Record<
    string,
    Array<{
      recipeId: string;
      discoveredAt: number;
      timesUsed: number;
      successRate: number;
      proficiency: number;
    }>
  >;
  globalDiscovered?: string[];
}

export interface ReputationState {
  data: SerializedReputationData;
  stats: {
    agents: number;
    avgReputation: number;
    trustEdges: number;
  };
  reputations?: Array<{
    agentId: string;
    agentName: string;
    reputation: number;
    rank: number;
    lastUpdated: number;
  }>;
  trust?: Array<{
    sourceId: string;
    targets: Array<{
      sourceId: string;
      targetId: string;
      trust: number;
    }>;
  }>;
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

export type KnowledgeNodeData =
  | { type: "fact"; content: string; category?: string }
  | { type: "recipe"; recipeId: string; ingredients: string[] }
  | { type: "location"; x: number; y: number; zoneId?: string }
  | { type: "person"; agentId: string; relationship?: string };

export interface KnowledgeGraphState {
  nodes: Array<{
    id: string;
    type: "fact" | "recipe" | "location" | "person";
    data: KnowledgeNodeData;
    discoveredBy: string[];
    discoveryTime: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    weight: number;
    type: "related" | "prerequisite" | "derived";
    cor: number;
  }>;
}

export interface TaskState {
  tasks: Array<{
    id: string;
    type: string;
    progress: number;
    requiredWork: number;
    completed: boolean;
    zoneId?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }>;
  stats: {
    total: number;
    active: number;
    completed: number;
    stalled: number;
    avgProgress: number;
  };
}

export interface TrailSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  intensity: number;
  lastUsed: number;
  purpose: "work" | "rest" | "trade" | "social" | "emergency" | "unknown";
  usageCount: number;
}

export interface HeatMapCell {
  x: number;
  y: number;
  heat: number;
  lastUpdate: number;
}

export interface TrailState {
  trails: TrailSegment[];
  heatMap: HeatMapCell[];
  stats: {
    totalTrails: number;
    activeTrails: number;
    hottestPath: string;
    averageIntensity: number;
    totalCells: number;
  };
}

/**
 * Complete game state containing all simulation data.
 *
 * This is the root state object that holds all agents, entities, zones,
 * resources, and subsystem states. Used for serialization and client synchronization.
 */
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
  economy?: EconomyState;
  roles?: RolesState;
  legends?: LegendsState;
  genealogy?: FamilyTree | SerializedFamilyTree;
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
  knowledgeGraph?: KnowledgeGraphState;
  tasks?: TaskState;
  trails?: TrailState;

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
    terrain: SimulationTerrainTile[][];
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
