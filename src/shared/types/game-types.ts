/**
 * Core game type definitions.
 *
 * Defines the complete game state structure, including agents, entities,
 * zones, resources, and all simulation subsystems.
 *
 * @module shared/types/game-types
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
import type { SimulationEntity } from "@/domain/simulation/core/schema";
import type { SocialGroup } from "./simulation/social";
import type { MarketOrder, Transaction } from "./simulation/economy";
import type { AgentRole } from "./simulation/roles";
import type { LegendRecord } from "./simulation/legends";
import type { FamilyTree, SerializedFamilyTree } from "./simulation/genealogy";
import type { Inventory } from "./simulation/economy";
import { ZoneType } from "../../shared/constants/ZoneEnums";
import { ResourceType } from "../../shared/constants/ResourceEnums";
import { TileType } from "../../shared/constants/TileTypeEnums";
import { StockpileType } from "../../shared/constants/ZoneEnums";
import type { TaskType } from "./simulation/tasks";
import { InteractionType } from "../../shared/constants/InteractionEnums";
import { WeatherType } from "../../shared/constants/AmbientEnums";
import { TimeOfDayPhase } from "../../shared/constants/TimeEnums";
import { BiomeType } from "../../shared/constants/BiomeEnums";
import { KnowledgeNodeType } from "../../shared/constants/KnowledgeEnums";
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
  resource?: ResourceType;
  capacity?: number;
  efficiency?: number;
  quality?: number;
  ownerId?: string;
  accessLevel?: "public" | "private" | "restricted";
  [key: string]: string | number | ResourceType | undefined;
}

export interface Zone {
  id: string;
  type: ZoneType;
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

/**
 * Re-export InteractionType enum for backward compatibility.
 * @deprecated Import directly from InteractionEnums instead.
 */
export { InteractionType } from "../../shared/constants/InteractionEnums";

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
    rare_materials: number;
    metal: number;
    iron_ore: number;
    copper_ore: number;
  };
  currency: number;
  experience: number;
  unlockedFeatures: string[];
}

export interface WeatherState {
  current: WeatherType;
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
  type: TileType;
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
  resourceType?: ResourceType;
  capacity?: number;
  [key: string]: string | number | boolean | ResourceType | undefined;
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
  relationships: Record<string, Record<string, number>>;
}

export interface RolesState {
  assignments: Map<string, AgentRole>;
  schedules: Map<string, string[]>;
}

export interface LegendsState {
  records: Map<string, LegendRecord>;
  activeLegends: string[];
}

export interface StockpileSnapshot {
  inventory: Inventory;
  capacity: number;
  type: StockpileType;
  zoneId: string;
}

export interface InventoryState {
  global: Inventory;
  stockpiles: Record<string, StockpileSnapshot>;
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
  | { type: KnowledgeNodeType.FACT; content: string; category?: string }
  | { type: KnowledgeNodeType.RECIPE; recipeId: string; ingredients: string[] }
  | {
      type: KnowledgeNodeType.LOCATION;
      x: number;
      y: number;
      zoneId?: string;
    }
  | { type: KnowledgeNodeType.PERSON; agentId: string; relationship?: string };

export interface KnowledgeGraphState {
  nodes: Array<{
    id: string;
    type: KnowledgeNodeType;
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
    type: TaskType;
    progress: number;
    requiredWork: number;
    completed: boolean;
    zoneId?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    requirements?: {
      resources?: {
        wood?: number;
        stone?: number;
        food?: number;
        water?: number;
      };
      minWorkers?: number;
    };
    metadata?: Record<string, string | number | boolean | string[] | undefined>;
    contributors?: Array<{ agentId: string; contribution: number }>;
    cancelled?: boolean;
    cancellationReason?: string;
    lastContribution?: number;
    createdAt?: number;
    targetAnimalId?: string;
  }>;
  stats: {
    total: number;
    active: number;
    completed: number;
    stalled: number;
    avgProgress: number;
  };
}

/**
 * Complete game state containing all simulation data.
 *
 * This is the root state object that holds all agents, entities, zones,
 * resources, and subsystem states. Used for serialization and client synchronization.
 */
/**
 * Crafting data sent in snapshots to frontend
 */
export interface EnhancedCraftingState {
  activeJobs: Array<{
    id: string;
    agentId: string;
    recipeId: string;
    finishesAt: number;
    progress: number;
  }>;
  knownRecipes: Record<string, string[]>;
  equippedWeapons?: Record<string, string>;
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
  timeOfDay?: TimeOfDayPhase;
  enhancedCrafting?: EnhancedCraftingState;
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

  conflicts?: ConflictState;
  research?: ResearchState;
  recipes?: RecipeState;
  reputation?: ReputationState;
  norms?: NormsState;
  animals?: AnimalState;
  knowledgeGraph?: KnowledgeGraphState;
  tasks?: TaskState;

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
  exploredBiomes?: BiomeType[];
  unlockedAssets?: string[];
}
