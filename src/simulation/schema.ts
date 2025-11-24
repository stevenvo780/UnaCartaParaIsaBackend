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

export interface SimulationEntity {
  id: string;
  name?: string;
  x: number;
  y: number;
  state?: string;
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
  zones: unknown[];
  mapElements: unknown[];
  currentConversation: ConversationState;
  terrainTiles: unknown[];
  roads: unknown[];
  objectLayers: unknown[];
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
