/**
 * Core simulation schema definitions.
 *
 * Defines the structure of entities, resources, and game state components
 * used throughout the simulation system.
 *
 * @module domain/simulation/core/schema
 */

import type {
  Zone,
  MapElement,
  TerrainTile,
  RoadPolyline,
  ObjectLayer,
} from "../../types/game-types";

/**
 * Material resource types available in the game.
 */
export type MaterialType = "wood" | "stone" | "food" | "water";

/**
 * State container for material resources.
 */
export interface MaterialsState {
  wood: number;
  stone: number;
  food: number;
  water: number;
}

/**
 * Complete resource state including materials, energy, currency, and progression.
 */
export interface ResourcesState {
  energy: number;
  materials: MaterialsState;
  currency: number;
  experience: number;
  unlockedFeatures: string[];
}

/**
 * Single dialogue entry in a conversation.
 */
export interface DialogueEntry {
  speaker: string;
  text: string;
  emotion: string;
  activity: string;
}

/**
 * Current state of an active conversation between entities.
 */
export interface ConversationState {
  isActive: boolean;
  participants: string[];
  lastSpeaker: string | null;
  lastDialogue: DialogueEntry | null;
  startTime: number;
}

/**
 * State for connection animations between entities.
 */
export interface ConnectionAnimationState {
  active: boolean;
  startTime: number;
  type: string;
  entityId?: string;
}

/**
 * Entity statistics including health, stamina, and other attributes.
 * Supports dynamic properties via index signature.
 */
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

/**
 * Personality and behavioral traits for entities.
 * Supports dynamic properties via index signature.
 */
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

/**
 * Core entity representation in the simulation.
 * Represents agents, NPCs, and other interactive objects.
 */
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

/**
 * 2D size dimensions.
 */
export interface Size2D {
  width: number;
  height: number;
}

/**
 * Complete simulation game state structure.
 * Contains all entities, zones, resources, and world configuration.
 */
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
