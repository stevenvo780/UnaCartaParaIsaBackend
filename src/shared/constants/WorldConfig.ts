import { EntityStat } from "./EntityEnums";
import { ZoneID, ZoneType } from "./ZoneEnums";

import { ResourceType } from "@/shared/constants/ResourceEnums";
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
    type: ZoneType.FOOD,
    size: ZONE_CONFIG.LARGE,
    color: "#00FF00",
    effects: { energy: 10, happiness: 5 },
  },
  {
    id: ZoneID.WATER_ZONE_NORTH,
    name: "Fuente de Agua Norte",
    type: ZoneType.WATER,
    size: ZONE_CONFIG.MEDIUM,
    color: "#00BFFF",
    effects: { energy: 8, comfort: 6 },
  },
  {
    id: ZoneID.REST_ZONE_SOUTH,
    name: "Área de Descanso Sur",
    type: ZoneType.REST,
    size: ZONE_CONFIG.LARGE,
    color: "#FF00FF",
    effects: { energy: 15, comfort: 10, happiness: 8 },
  },
  {
    id: ZoneID.WORK_ZONE_LOGGING,
    name: "Campamento Maderero",
    type: ZoneType.WORK,
    size: ZONE_CONFIG.MEDIUM,
    color: "#8B4513",
    effects: {},
    properties: { resource: ResourceType.WOOD },
  },
  {
    id: ZoneID.WORK_ZONE_QUARRY,
    name: "Cantera de Piedra",
    type: ZoneType.WORK,
    size: ZONE_CONFIG.MEDIUM,
    color: "#808080",
    effects: {},
    properties: { resource: ResourceType.STONE },
  },
  {
    id: ZoneID.STORAGE_GRANARY_01,
    name: "Granero Principal",
    type: ZoneType.STORAGE,
    size: ZONE_CONFIG.MEDIUM,
    color: "#D2691E",
    effects: { comfort: 5 },
    properties: {
      stockpileId: ZoneID.STORAGE_GRANARY_01,
      capacity: 500,
      resourceTypes: ["food", ResourceType.WATER],
    },
  },
  {
    id: ZoneID.WATER_WELL_CENTRAL,
    name: "Pozo Central",
    type: ZoneType.WATER,
    size: ZONE_CONFIG.SMALL,
    color: "#1E90FF",
    effects: { energy: 10, comfort: 8 },
    properties: { infinite: true, renewalRate: 20 },
  },
  {
    id: ZoneID.FOOD_ZONE_ORCHARD_EAST,
    name: "Huerto del Este",
    type: ZoneType.FOOD,
    size: ZONE_CONFIG.MEDIUM,
    color: "#7CFC00",
    effects: { energy: 12, happiness: 6 },
  },
  {
    id: ZoneID.FOOD_ZONE_FARM_WEST,
    name: "Granja del Oeste",
    type: ZoneType.FOOD,
    size: ZONE_CONFIG.LARGE,
    color: "#32CD32",
    effects: { energy: 15, comfort: 5 },
  },
  {
    id: ZoneID.FOOD_ZONE_GARDEN_SOUTH,
    name: "Jardín del Sur",
    type: ZoneType.FOOD,
    size: ZONE_CONFIG.MEDIUM,
    color: "#00FF7F",
    effects: { energy: 10, mentalHealth: 8 },
  },
  {
    id: ZoneID.WATER_ZONE_LAKE_EAST,
    name: "Lago del Este",
    type: ZoneType.WATER,
    size: ZONE_CONFIG.MEDIUM,
    color: "#00CED1",
    effects: { energy: 12, comfort: 10 },
    properties: { infinite: true },
  },
  {
    id: ZoneID.WATER_ZONE_SPRING_WEST,
    name: "Manantial del Oeste",
    type: ZoneType.WATER,
    size: ZONE_CONFIG.SMALL,
    color: "#20B2AA",
    effects: { energy: 10, [EntityStat.HEALTH]: 5 },
    properties: { infinite: true, renewalRate: 15 },
  },
  {
    id: ZoneID.DEFENSE_TOWER_NORTH,
    name: "Torre de Vigilancia Norte",
    type: ZoneType.DEFENSE,
    size: ZONE_CONFIG.SMALL,
    color: "#4B0082",
    effects: { safety: 25, courage: 10 },
    properties: { range: 400, guardCapacity: 2 },
  },
  {
    id: ZoneID.DIVINE_TEMPLE_CENTER,
    name: "Templo de la Resonancia",
    type: ZoneType.SPIRITUAL,
    size: ZONE_CONFIG.LARGE,
    color: "#FFD700",
    effects: { mentalHealth: 20, stress: -20, resonance: 15 },
    properties: { divineFavorBonus: 1.5, prayerCapacity: 10 },
  },
  {
    id: ZoneID.MEDICAL_ZONE_HOSPITAL,
    name: "Hospital Central",
    type: ZoneType.MEDICAL,
    size: ZONE_CONFIG.MEDIUM,
    color: "#FF6B6B",
    effects: { [EntityStat.HEALTH]: 20, comfort: 8, mentalHealth: 5 },
  },
  {
    id: ZoneID.TRAINING_ZONE_GYM,
    name: "Gimnasio de Entrenamiento",
    type: ZoneType.TRAINING,
    size: ZONE_CONFIG.MEDIUM,
    color: "#FFA500",
    effects: { stamina: 15, energy: -5, [EntityStat.HEALTH]: 10 },
  },
  {
    id: ZoneID.KNOWLEDGE_ZONE_LIBRARY,
    name: "Gran Biblioteca",
    type: ZoneType.KNOWLEDGE,
    size: ZONE_CONFIG.MEDIUM,
    color: "#4ECDC4",
    effects: { intelligence: 12, mentalHealth: 8, boredom: -10 },
  },
  {
    id: ZoneID.SPIRITUAL_ZONE_TEMPLE,
    name: "Templo de Serenidad",
    type: ZoneType.SPIRITUAL,
    size: ZONE_CONFIG.SMALL,
    color: "#9B59B6",
    effects: { mentalHealth: 18, stress: -15, socialSkills: 8 },
  },
  {
    id: ZoneID.MARKET_ZONE_PLAZA,
    name: "Plaza del Mercado",
    type: ZoneType.MARKET,
    size: ZONE_CONFIG.LARGE,
    color: "#F39C12",
    effects: { socialSkills: 10, happiness: 6, money: 5 },
  },
] as const;
export const ENTITY_STATS = {
  PHYSICAL: [
    { key: EntityStat.HEALTH, icon: "💚", label: "Salud" },
    { key: EntityStat.ENERGY, icon: "⚡", label: "Energía" },
    { key: EntityStat.STAMINA, icon: "🏃", label: "Resistencia" },
    { key: EntityStat.HUNGER, icon: "🍖", label: "Hambre" },
    { key: EntityStat.THIRST, icon: "💧", label: "Sed" },
    { key: EntityStat.SLEEPINESS, icon: "😴", label: "Sueño" },
  ],
  MENTAL: [
    { key: "mentalHealth", icon: "🧠", label: "Mental" },
    { key: EntityStat.INTELLIGENCE, icon: "🎓", label: "Inteligencia" },
    { key: EntityStat.HAPPINESS, icon: "😊", label: "Felicidad" },
    { key: EntityStat.STRESS, icon: "😰", label: "Estrés" },
    { key: EntityStat.BOREDOM, icon: "😑", label: "Aburrimiento" },
    { key: EntityStat.LONELINESS, icon: "💔", label: "Soledad" },
  ],
  SOCIAL: [
    { key: "socialSkills", icon: "👥", label: "Social" },
    { key: EntityStat.COMFORT, icon: "🛋️", label: "Comodidad" },
    { key: EntityStat.CREATIVITY, icon: "🎨", label: "Creatividad" },
    { key: EntityStat.RESONANCE, icon: "🔗", label: "Resonancia" },
    { key: EntityStat.COURAGE, icon: "💪", label: "Coraje" },
    { key: EntityStat.MONEY, icon: "💰", label: "Dinero" },
  ],
  get ALL() {
    return [...this.PHYSICAL, ...this.MENTAL, ...this.SOCIAL];
  },
} as const;
