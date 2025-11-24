import type {
  Zone,
  MapElement,
  TerrainTile,
  RoadPolyline,
  ObjectLayer,
} from "../../types/game-types";

export type MaterialType = "wood" | "stone" | "food" | "water";

export interface MaterialsState {
  wood: number;
  stone: number;
  food: number;
  water: number;
}

export interface ResourcesState {
  energy: number;
  materials: MaterialsState;
  currency: number;
  experience: number;
  unlockedFeatures: string[];
}

export interface DialogueEntry {
  speaker: string;
  text: string;
  emotion: string;
  activity: string;
}

export interface ConversationState {
  isActive: boolean;
  participants: string[];
  lastSpeaker: string | null;
  lastDialogue: DialogueEntry | null;
  startTime: number;
}

export interface ConnectionAnimationState {
  active: boolean;
  startTime: number;
  type: string;
  entityId?: string;
}

export interface EntityStats {
  health?: number;
  morale?: number;
  stress?: number;
  stamina?: number;
  wounds?: number;
  energy?: number;
  hunger?: number;
  thirst?: number;
  [key: string]: number | undefined;
}

export interface EntityTraits {
  aggression?: number;
  cooperation?: number;
  diligence?: number;
  curiosity?: number;
  bravery?: number;
  intelligence?: number;
  charisma?: number;
  stamina?: number;
  [key: string]: number | undefined;
}

export interface SimulationEntity {
  id: string;
  name?: string;
  x: number;
  y: number;
  state?: string;
  position?: { x: number; y: number };
  isDead?: boolean;
  stats?: EntityStats;
  tags?: string[];
  type?: string;
  traits?: EntityTraits;
  immortal?: boolean;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface SimulationGameState {
  entities: SimulationEntity[];
  resonance: number;
  cycles: number;
  lastSave: number;
  togetherTime: number;
  connectionAnimation: ConnectionAnimationState;
  zones: Zone[];
  mapElements: MapElement[];
  currentConversation: ConversationState;
  terrainTiles: TerrainTile[];
  roads: RoadPolyline[];
  objectLayers: ObjectLayer[];
  worldSize: Size2D;
  generatorVersion: string;
  dayTime: number;
  weather: {
    current: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    visibility: number;
    lastChange: number;
    duration: number;
  };
  resources: ResourcesState;
}
