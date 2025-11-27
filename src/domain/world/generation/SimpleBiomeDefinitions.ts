import { BiomeType } from "./types";

export interface SimpleBiomeConfig {
  id: BiomeType;
  name: string;
  color: string;
  isWalkable: boolean;

  temperature: [number, number];
  moisture: [number, number];
  elevation: [number, number];

  density: {
    trees?: number;
    plants?: number;
    props?: number;
    rocks?: number;
  };

  clustering?: number;

  transitionWidth?: number;
}

export const SIMPLE_BIOMES: SimpleBiomeConfig[] = [
  {
    id: BiomeType.GRASSLAND,
    name: "Pradera",
    color: "#7CB342",
    isWalkable: true,
    temperature: [0.3, 0.7],
    moisture: [0.3, 0.7],
    elevation: [0.25, 0.75],
    density: {
      trees: 0.65,
      plants: 0.12,
      props: 0.22,
    },
    clustering: 0.4,
    transitionWidth: 3,
  },

  {
    id: BiomeType.FOREST,
    name: "Bosque",
    color: "#2E7D32",
    isWalkable: true,
    temperature: [0.0, 1.0],
    moisture: [0.5, 1.0],
    elevation: [0.0, 0.85],
    density: {
      trees: 0.98,
      plants: 0.33,
      props: 0.17,
    },
    clustering: 0.8,
    transitionWidth: 4,
  },

  {
    id: BiomeType.DESERT,
    name: "Desierto",
    color: "#D4A574",
    isWalkable: true,
    temperature: [0.4, 1.0],
    moisture: [0.0, 0.5],
    elevation: [0.1, 0.8],
    density: {
      rocks: 0.15,
      props: 0.05,
    },
    clustering: 0.3,
    transitionWidth: 5,
  },

  {
    id: BiomeType.TUNDRA,
    name: "Tundra",
    color: "#B0BEC5",
    isWalkable: true,
    temperature: [0.0, 0.45],
    moisture: [0.0, 1.0],
    elevation: [0.0, 1.0],
    density: {
      trees: 0.3,
      rocks: 0.2,
      props: 0.15, // For decals (moss, scattered branches)
    },
    clustering: 0.2,
    transitionWidth: 4,
  },

  {
    id: BiomeType.SWAMP,
    name: "Pantano",
    color: "#558B2F",
    isWalkable: true,
    temperature: [0.5, 1.0],
    moisture: [0.8, 1.0],
    elevation: [0.0, 0.3],
    density: {
      trees: 0.7,
      plants: 0.8,
      props: 0.25, // For decals (moss, mushrooms, fallen leaves)
    },
    clustering: 0.6,
    transitionWidth: 6,
  },

  {
    id: BiomeType.MOUNTAIN,
    name: "Montaña",
    color: "#78909C",
    isWalkable: true,
    temperature: [0.0, 0.5],
    moisture: [0.0, 1.0],
    elevation: [0.7, 1.0],
    density: {
      rocks: 0.8,
      trees: 0.2,
      props: 0.1, // For decals (moss, scattered branches)
    },
    clustering: 0.5,
    transitionWidth: 2,
  },

  {
    id: BiomeType.BEACH,
    name: "Playa",
    color: "#FFF59D",
    isWalkable: true,
    temperature: [0.0, 1.0],
    moisture: [0.0, 1.0],
    elevation: [0.0, 0.15],
    density: {
      props: 0.3,
    },
    clustering: 0.2,
    transitionWidth: 3,
  },

  {
    id: BiomeType.OCEAN,
    name: "Océano",
    color: "#0288D1",
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [0.0, 1.0],
    elevation: [0.0, 0.0],
    density: {},
    clustering: 0.0,
    transitionWidth: 8,
  },

  {
    id: BiomeType.MYSTICAL,
    name: "Bosque Místico",
    color: "#7B1FA2",
    isWalkable: true,
    temperature: [0.2, 0.4],
    moisture: [0.4, 0.7],
    elevation: [0.1, 0.5],
    density: {
      trees: 0.3,
      props: 0.12,
    },
    clustering: 0.45,
    transitionWidth: 5,
  },

  {
    id: BiomeType.WETLAND,
    name: "Humedal",
    color: "#00695C",
    isWalkable: true,
    temperature: [0.4, 0.7],
    moisture: [0.8, 1.0],
    elevation: [0.0, 0.3],
    density: {
      trees: 0.25,
      props: 0.33,
    },
    clustering: 0.55,
    transitionWidth: 6,
  },

  {
    id: BiomeType.MOUNTAINOUS,
    name: "Zona Montañosa",
    color: "#5D4037",
    isWalkable: true,
    temperature: [0.1, 0.4],
    moisture: [0.1, 0.4],
    elevation: [0.7, 1.0],
    density: {
      trees: 0.13,
      rocks: 0.42,
    },
    clustering: 0.25,
    transitionWidth: 4,
  },

  {
    id: BiomeType.VILLAGE,
    name: "Zona de Pueblo",
    color: "#8D6E63",
    isWalkable: true,
    temperature: [0.4, 0.7],
    moisture: [0.4, 0.7],
    elevation: [0.3, 0.6],
    density: {
      trees: 0.13,
      props: 0.22,
    },
    clustering: 0.15,
    transitionWidth: 3,
  },
];
