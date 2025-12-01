import type { ZoneType } from "@/shared/types/simulation/zones";
import type { EntityStats } from "../simulation/core/schema";
import { ZoneSpriteKey } from "../../shared/constants/SpriteEnums";

export interface ZonePropertyConfig {
  name: string;
  color: string;
  attractiveness: number;
  effects?: Partial<Record<keyof EntityStats, number>>;
  spriteKey: ZoneSpriteKey;
  capacity?: number;
  stockpileCapacity?: number;
}

export const ZONE_PROPERTIES: Record<ZoneType, ZonePropertyConfig> = {
  shelter: {
    name: "Shelter",
    color: "#8B7355",
    attractiveness: 5,
    effects: { energy: 4, comfort: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SHELTER,
    capacity: 4,
    stockpileCapacity: 50,
  },

  bedroom: {
    name: "Bedroom",
    color: "#9370DB",
    attractiveness: 8,
    effects: { energy: 7, comfort: 5, happiness: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_BEDROOM,
    capacity: 2,
    stockpileCapacity: 30,
  },

  living: {
    name: "Living Room",
    color: "#FFB347",
    attractiveness: 7,
    effects: { comfort: 4, happiness: 3, resonance: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_LIVING,
    capacity: 6,
  },

  bathroom: {
    name: "Bathroom",
    color: "#87CEEB",
    attractiveness: 6,
    effects: { hygiene: 8, comfort: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_BATHROOM,
    capacity: 1,
  },

  work: {
    name: "Workshop",
    color: "#CC8844",
    attractiveness: 6,
    effects: { stamina: 2, focus: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_WORKBENCH,
    capacity: 4,
    stockpileCapacity: 200,
  },

  kitchen: {
    name: "Kitchen",
    color: "#FF6B6B",
    attractiveness: 7,
    effects: { hunger: 8, happiness: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_KITCHEN,
    capacity: 3,
    stockpileCapacity: 150,
  },

  office: {
    name: "Office",
    color: "#4ECDC4",
    attractiveness: 5,
    effects: { focus: 5, energy: -1 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_OFFICE,
    capacity: 2,
  },

  medical: {
    name: "Medical Bay",
    color: "#E74C3C",
    attractiveness: 8,
    effects: { health: 10, stamina: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_MEDICAL,
    capacity: 3,
    stockpileCapacity: 100,
  },

  gym: {
    name: "Gym",
    color: "#3498DB",
    attractiveness: 6,
    effects: { stamina: 5, health: 3, energy: -2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_GYM,
    capacity: 5,
  },

  rest: {
    name: "Rest Area",
    color: "#AA66FF",
    attractiveness: 7,
    effects: { energy: 6, comfort: 3, happiness: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_HOUSE,
    capacity: 4,
    stockpileCapacity: 100,
  },

  library: {
    name: "Library",
    color: "#8E44AD",
    attractiveness: 6,
    effects: { focus: 7, knowledge: 5, resonance: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_LIBRARY,
    capacity: 8,
  },

  education: {
    name: "School",
    color: "#27AE60",
    attractiveness: 7,
    effects: { knowledge: 8, focus: 4, resonance: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_EDUCATION,
    capacity: 12,
  },

  training: {
    name: "Training Hall",
    color: "#E67E22",
    attractiveness: 6,
    effects: { stamina: 4, focus: 3, health: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_TRAINING,
    capacity: 8,
  },

  knowledge: {
    name: "Knowledge Center",
    color: "#9B59B6",
    attractiveness: 7,
    effects: { knowledge: 9, focus: 5, resonance: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_KNOWLEDGE,
    capacity: 6,
  },

  social: {
    name: "Social Hub",
    color: "#F39C12",
    attractiveness: 8,
    effects: { happiness: 6, resonance: 5, comfort: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SOCIAL,
    capacity: 10,
  },

  recreation: {
    name: "Recreation Center",
    color: "#1ABC9C",
    attractiveness: 8,
    effects: { happiness: 7, energy: 3, resonance: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_RECREATION,
    capacity: 12,
  },

  entertainment: {
    name: "Entertainment Hall",
    color: "#E91E63",
    attractiveness: 9,
    effects: { happiness: 8, energy: 2, resonance: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_ENTERTAINMENT,
    capacity: 15,
  },

  fun: {
    name: "Fun Zone",
    color: "#FF5722",
    attractiveness: 9,
    effects: { happiness: 9, energy: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_FUN,
    capacity: 10,
  },

  play: {
    name: "Playground",
    color: "#FFEB3B",
    attractiveness: 8,
    effects: { happiness: 7, energy: 4, comfort: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_PLAY,
    capacity: 8,
  },

  food: {
    name: "Food Storage",
    color: "#8BC34A",
    attractiveness: 5,
    effects: { hunger: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_FOOD,
    capacity: 2,
    stockpileCapacity: 500,
  },

  water: {
    name: "Water Storage",
    color: "#03A9F4",
    attractiveness: 5,
    effects: { thirst: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_WATER,
    capacity: 2,
    stockpileCapacity: 400,
  },

  storage: {
    name: "Warehouse",
    color: "#795548",
    attractiveness: 3,
    effects: {},
    spriteKey: ZoneSpriteKey.AGENT_BUILT_STORAGE,
    capacity: 2,
    stockpileCapacity: 1000,
  },

  market: {
    name: "Market",
    color: "#FFC107",
    attractiveness: 7,
    effects: { happiness: 4, resonance: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_MARKET,
    capacity: 8,
    stockpileCapacity: 300,
  },

  defense: {
    name: "Defense Tower",
    color: "#607D8B",
    attractiveness: 4,
    effects: { stamina: 3, focus: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_DEFENSE,
    capacity: 3,
    stockpileCapacity: 100,
  },

  security: {
    name: "Security Post",
    color: "#424242",
    attractiveness: 4,
    effects: { stamina: 2, focus: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SECURITY,
    capacity: 2,
  },

  spiritual: {
    name: "Spiritual Sanctuary",
    color: "#7E57C2",
    attractiveness: 7,
    effects: { resonance: 8, happiness: 4, comfort: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SPIRITUAL,
    capacity: 10,
  },

  energy: {
    name: "Energy Generator",
    color: "#FFEB3B",
    attractiveness: 3,
    effects: { energy: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_ENERGY,
    capacity: 1,
  },

  hygiene: {
    name: "Hygiene Station",
    color: "#B2DFDB",
    attractiveness: 6,
    effects: { hygiene: 10, health: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_HYGIENE,
    capacity: 2,
  },

  comfort: {
    name: "Comfort Lounge",
    color: "#BCAAA4",
    attractiveness: 8,
    effects: { comfort: 8, happiness: 3, energy: 2 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_COMFORT,
    capacity: 6,
  },

  bath: {
    name: "Bath",
    color: "#87CEEB",
    attractiveness: 7,
    effects: { hygiene: 10, comfort: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_BATHROOM,
    capacity: 2,
  },

  well: {
    name: "Well",
    color: "#4682B4",
    attractiveness: 6,
    effects: { hygiene: 8, thirst: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_WELL,
    capacity: 1,
  },

  gathering: {
    name: "Gathering Place",
    color: "#9370DB",
    attractiveness: 8,
    effects: { social: 6, happiness: 4, resonance: 3 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SOCIAL,
    capacity: 12,
  },

  tavern: {
    name: "Tavern",
    color: "#8B4513",
    attractiveness: 9,
    effects: { social: 8, happiness: 6, fun: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_TAVERN,
    capacity: 15,
    stockpileCapacity: 200,
  },

  festival: {
    name: "Festival Grounds",
    color: "#FFD700",
    attractiveness: 10,
    effects: { happiness: 10, fun: 9, resonance: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_ENTERTAINMENT,
    capacity: 20,
  },

  temple: {
    name: "Temple",
    color: "#7E57C2",
    attractiveness: 9,
    effects: { resonance: 10, happiness: 5, comfort: 4 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SPIRITUAL,
    capacity: 12,
  },

  sanctuary: {
    name: "Sanctuary",
    color: "#9C27B0",
    attractiveness: 9,
    effects: { resonance: 9, mentalHealth: 8, comfort: 5 },
    spriteKey: ZoneSpriteKey.AGENT_BUILT_SPIRITUAL,
    capacity: 8,
  },

  wild: {
    name: "Wild Area",
    color: "#228B22",
    attractiveness: 3,
    effects: {},
    spriteKey: ZoneSpriteKey.WILD,
    capacity: 0,
  },
};

export function getZoneProperties(zoneType: ZoneType): ZonePropertyConfig {
  return (
    ZONE_PROPERTIES[zoneType] || {
      name: "Unknown Building",
      color: "#808080",
      attractiveness: 3,
      effects: {},
      spriteKey: "house",
      capacity: 2,
    }
  );
}
