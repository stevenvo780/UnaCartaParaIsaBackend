import type { WorldResourceInstance } from "../simulation/types/worldResources.js";

export interface Position {
  x: number;
  y: number;
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

export interface ConversationState {
  isActive: boolean;
  participants: string[];
  lastSpeaker: string | null;
  lastDialogue: any | null;
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

export interface ObjectLayer {
  id: string;
  name: string;
  objects: any[];
  zIndex: number;
  visible: boolean;
}

export interface GameState {
  agents: any[]; // Ideally typed as AgentProfile[]
  entities: any[];
  zones: any[];
  resources: GameResources;
  time: number;
  dayTime: number;
  togetherTime: number;
  cycles: number;
  weather: WeatherState;
  worldResources?: Record<string, WorldResourceInstance>;
  socialGraph?: any;
  market?: any;
  inventory?: any;
  roles?: any;
  legends?: any;
  genealogy?: any;

  // Legacy/Frontend fields (kept for compatibility if needed)
  resonance?: number;
  lastSave?: number;
  connectionAnimation?: {
    active: boolean;
    startTime: number;
    type: InteractionType;
    entityId?: string;
  };
  mapElements?: any[];
  mapSeed?: string;
  currentConversation?: ConversationState;
  terrainTiles?: TerrainTile[];
  roads?: RoadPolyline[];
  objectLayers?: ObjectLayer[];
  worldSize?: Size;
  generatorVersion?: string;
  playerLevel?: number;
  exploredBiomes?: string[];
  unlockedAssets?: string[];
}
