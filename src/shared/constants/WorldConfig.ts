import { EntityStat } from "./EntityEnums";
import { ZoneID } from "./ZoneEnums";

export const WORLD_CONFIG = {
  WORLD_WIDTH: 4096,
  WORLD_HEIGHT: 4096,
  get WORLD_CENTER_X() {
    return this.WORLD_WIDTH / 2;
  },
  get WORLD_CENTER_Y() {
    return this.WORLD_HEIGHT / 2;
  },
  ZONE_MARGIN: 100,
  MIN_ZONE_SIZE: 200,
  MAX_ZONE_SIZE: 500,
} as const;
export const ZONE_CONFIG = {
  SMALL: { width: 200, height: 180 },
  MEDIUM: { width: 300, height: 250 },
  LARGE: { width: 400, height: 320 },
  MIN_SPACING: 150,
} as const;

export const WorldUtils = {
  clampToWorld(
    x: number,
    y: number,
    width: number,
    height: number,
  ): { x: number; y: number } {
    const margin = WORLD_CONFIG.ZONE_MARGIN;
    return {
      x: Math.max(
        margin,
        Math.min(x, WORLD_CONFIG.WORLD_WIDTH - width - margin),
      ),
      y: Math.max(
        margin,
        Math.min(y, WORLD_CONFIG.WORLD_HEIGHT - height - margin),
      ),
    };
  },

  getCenter(
    x: number,
    y: number,
    width: number,
    height: number,
  ): { x: number; y: number } {
    return {
      x: x + width / 2,
      y: y + height / 2,
    };
  },

  hasOverlap(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
    minSpacing: number = ZONE_CONFIG.MIN_SPACING,
  ): boolean {
    return !(
      x1 + w1 + minSpacing < x2 ||
      x2 + w2 + minSpacing < x1 ||
      y1 + h1 + minSpacing < y2 ||
      y2 + h2 + minSpacing < y1
    );
  },

  distributeZones(
    zones: Array<{ width: number; height: number }>,
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const gridCols = Math.ceil(Math.sqrt(zones.length));
    const gridRows = Math.ceil(zones.length / gridCols);

    const cellWidth =
      (WORLD_CONFIG.WORLD_WIDTH - WORLD_CONFIG.ZONE_MARGIN * 2) / gridCols;
    const cellHeight =
      (WORLD_CONFIG.WORLD_HEIGHT - WORLD_CONFIG.ZONE_MARGIN * 2) / gridRows;

    zones.forEach((zone, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);

      const cellX = WORLD_CONFIG.ZONE_MARGIN + col * cellWidth;
      const cellY = WORLD_CONFIG.ZONE_MARGIN + row * cellHeight;
      const x = cellX + (cellWidth - zone.width) / 2;
      const y = cellY + (cellHeight - zone.height) / 2;

      positions.push(this.clampToWorld(x, y, zone.width, zone.height));
    });

    return positions;
  },
};
export const ZONE_DEFINITIONS = [
  {
    id: ZoneID.FOOD_ZONE_CENTRAL,
    name: "Zona de Alimentación Central",
    type: "food",
    size: ZONE_CONFIG.LARGE,
    color: "#00FF00",
    effects: { energy: 10, happiness: 5 },
  },
  {
    id: ZoneID.WATER_ZONE_NORTH,
    name: "Fuente de Agua Norte",
    type: "water",
    size: ZONE_CONFIG.MEDIUM,
    color: "#00BFFF",
    effects: { energy: 8, comfort: 6 },
  },
  {
    id: ZoneID.REST_ZONE_SOUTH,
    name: "Área de Descanso Sur",
    type: "rest",
    size: ZONE_CONFIG.LARGE,
    color: "#FF00FF",
    effects: { energy: 15, comfort: 10, happiness: 8 },
  },
  {
    id: ZoneID.WORK_ZONE_LOGGING,
    name: "Campamento Maderero",
    type: "work",
    size: ZONE_CONFIG.MEDIUM,
    color: "#8B4513",
    effects: {},
    properties: { resource: "wood" },
  },
  {
    id: ZoneID.WORK_ZONE_QUARRY,
    name: "Cantera de Piedra",
    type: "work",
    size: ZONE_CONFIG.MEDIUM,
    color: "#808080",
    effects: {},
    properties: { resource: "stone" },
  },
  {
    id: ZoneID.STORAGE_GRANARY_01,
    name: "Granero Principal",
    type: "storage",
    size: ZONE_CONFIG.MEDIUM,
    color: "#D2691E",
    effects: { comfort: 5 },
    properties: {
      stockpileId: ZoneID.STORAGE_GRANARY_01,
      capacity: 500,
      resourceTypes: ["food", "water"],
    },
  },
  {
    id: ZoneID.WATER_WELL_CENTRAL,
    name: "Pozo Central",
    type: "water",
    size: ZONE_CONFIG.SMALL,
    color: "#1E90FF",
    effects: { energy: 10, comfort: 8 },
    properties: { infinite: true, renewalRate: 20 },
  },
  {
    id: ZoneID.FOOD_ZONE_ORCHARD_EAST,
    name: "Huerto del Este",
    type: "food",
    size: ZONE_CONFIG.MEDIUM,
    color: "#7CFC00",
    effects: { energy: 12, happiness: 6 },
  },
  {
    id: ZoneID.FOOD_ZONE_FARM_WEST,
    name: "Granja del Oeste",
    type: "food",
    size: ZONE_CONFIG.LARGE,
    color: "#32CD32",
    effects: { energy: 15, comfort: 5 },
  },
  {
    id: ZoneID.FOOD_ZONE_GARDEN_SOUTH,
    name: "Jardín del Sur",
    type: "food",
    size: ZONE_CONFIG.MEDIUM,
    color: "#00FF7F",
    effects: { energy: 10, mentalHealth: 8 },
  },
  {
    id: ZoneID.WATER_ZONE_LAKE_EAST,
    name: "Lago del Este",
    type: "water",
    size: ZONE_CONFIG.MEDIUM,
    color: "#00CED1",
    effects: { energy: 12, comfort: 10 },
    properties: { infinite: true },
  },
  {
    id: ZoneID.WATER_ZONE_SPRING_WEST,
    name: "Manantial del Oeste",
    type: "water",
    size: ZONE_CONFIG.SMALL,
    color: "#20B2AA",
    effects: { energy: 10, [EntityStat.HEALTH]: 5 },
    properties: { infinite: true, renewalRate: 15 },
  },
  {
    id: ZoneID.DEFENSE_TOWER_NORTH,
    name: "Torre de Vigilancia Norte",
    type: "defense",
    size: ZONE_CONFIG.SMALL,
    color: "#4B0082",
    effects: { safety: 25, courage: 10 },
    properties: { range: 400, guardCapacity: 2 },
  },
  {
    id: ZoneID.DIVINE_TEMPLE_CENTER,
    name: "Templo de la Resonancia",
    type: "spiritual",
    size: ZONE_CONFIG.LARGE,
    color: "#FFD700",
    effects: { mentalHealth: 20, stress: -20, resonance: 15 },
    properties: { divineFavorBonus: 1.5, prayerCapacity: 10 },
  },
  {
    id: ZoneID.MEDICAL_ZONE_HOSPITAL,
    name: "Hospital Central",
    type: "medical",
    size: ZONE_CONFIG.MEDIUM,
    color: "#FF6B6B",
    effects: { [EntityStat.HEALTH]: 20, comfort: 8, mentalHealth: 5 },
  },
  {
    id: ZoneID.TRAINING_ZONE_GYM,
    name: "Gimnasio de Entrenamiento",
    type: "training",
    size: ZONE_CONFIG.MEDIUM,
    color: "#FFA500",
    effects: { stamina: 15, energy: -5, [EntityStat.HEALTH]: 10 },
  },
  {
    id: ZoneID.KNOWLEDGE_ZONE_LIBRARY,
    name: "Gran Biblioteca",
    type: "knowledge",
    size: ZONE_CONFIG.MEDIUM,
    color: "#4ECDC4",
    effects: { intelligence: 12, mentalHealth: 8, boredom: -10 },
  },
  {
    id: ZoneID.SPIRITUAL_ZONE_TEMPLE,
    name: "Templo de Serenidad",
    type: "spiritual",
    size: ZONE_CONFIG.SMALL,
    color: "#9B59B6",
    effects: { mentalHealth: 18, stress: -15, socialSkills: 8 },
  },
  {
    id: ZoneID.MARKET_ZONE_PLAZA,
    name: "Plaza del Mercado",
    type: "market",
    size: ZONE_CONFIG.LARGE,
    color: "#F39C12",
    effects: { socialSkills: 10, happiness: 6, money: 5 },
  },
] as const;
export const ENTITY_STATS = {
  PHYSICAL: [
    { key: EntityStat.HEALTH, icon: "💚", label: "Salud" },
    { key: "energy", icon: "⚡", label: "Energía" },
    { key: "stamina", icon: "🏃", label: "Resistencia" },
    { key: "hunger", icon: "🍖", label: "Hambre" },
    { key: "thirst", icon: "💧", label: "Sed" },
    { key: "sleepiness", icon: "😴", label: "Sueño" },
  ],
  MENTAL: [
    { key: "mentalHealth", icon: "🧠", label: "Mental" },
    { key: "intelligence", icon: "🎓", label: "Inteligencia" },
    { key: "happiness", icon: "😊", label: "Felicidad" },
    { key: "stress", icon: "😰", label: "Estrés" },
    { key: "boredom", icon: "😑", label: "Aburrimiento" },
    { key: "loneliness", icon: "💔", label: "Soledad" },
  ],
  SOCIAL: [
    { key: "socialSkills", icon: "👥", label: "Social" },
    { key: "comfort", icon: "🛋️", label: "Comodidad" },
    { key: "creativity", icon: "🎨", label: "Creatividad" },
    { key: "resonance", icon: "🔗", label: "Resonancia" },
    { key: "courage", icon: "💪", label: "Coraje" },
    { key: "money", icon: "💰", label: "Dinero" },
  ],
  get ALL() {
    return [...this.PHYSICAL, ...this.MENTAL, ...this.SOCIAL];
  },
} as const;
