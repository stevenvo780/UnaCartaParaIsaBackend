import type { LifeStage, Sex } from "./agents";

export type ColorPalette = {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
};

export type VisualStyle = {
  id: string;
  name: string;
  description: string;
  palette: ColorPalette;
  hairColors: string[];
  clothingStyle: "simple" | "decorated" | "elegant" | "rugged" | "mystical";
};

export type GenerationVisualTheme = {
  generation: number;
  style: VisualStyle;
  iconicFeature: string;
  influences: string[];
};

export type SocialGroupAppearance = {
  groupId: string;
  color: string;
  symbol: string;
  accessory: "headband" | "necklace" | "armband" | "cape" | "none";
  accessoryColor: string;
};

export type AgentAppearance = {
  agentId: string;

  sex: Sex;
  lifeStage: LifeStage;
  skinTone: string;
  hairColor: string;

  geneticLineage: {
    fatherSkinVariant?: string;
    motherSkinVariant?: string;
    inheritedSkinVariant: string;
    generationMix: number;
  };

  clothingPrimary: string;
  clothingSecondary: string;
  clothingStyle: "simple" | "decorated" | "elegant" | "rugged" | "mystical";

  groupMarker?: {
    color: string;
    symbol: string;
    accessory: string;
  };

  generationFeatures: {
    generation: number;
    iconicFeature: string;
    style: string;
  };

  traitModifiers: {
    cooperationGlow?: number;
    aggressionEdge?: number;
    diligencePosture?: number;
    curiosityEyes?: number;
  };

  spriteVariant: string;
};

export const GENERATION_STYLES: VisualStyle[] = [
  {
    id: "divine_gen0",
    name: "Divino Primigenio",
    description: "Estilo majestuoso de los dioses fundadores",
    palette: {
      primary: "#FFD700",
      secondary: "#8B00FF",
      accent: "#00FFFF",
      skin: "#FFE4C4",
    },
    hairColors: ["#FFFFFF", "#FFD700", "#C0C0C0"],
    clothingStyle: "mystical",
  },

  {
    id: "pioneer_gen1",
    name: "Pioneros",
    description: "Primera generación mortal, estilo práctico",
    palette: {
      primary: "#8B4513",
      secondary: "#228B22",
      accent: "#CD853F",
      skin: "#D2B48C",
    },
    hairColors: ["#654321", "#8B4513", "#A0522D"],
    clothingStyle: "simple",
  },

  {
    id: "crafters_gen2",
    name: "Artesanos",
    description: "Generación de constructores y creadores",
    palette: {
      primary: "#4682B4",
      secondary: "#DAA520",
      accent: "#DC143C",
      skin: "#C19A6B",
    },
    hairColors: ["#2F4F4F", "#696969", "#8B7355"],
    clothingStyle: "decorated",
  },

  {
    id: "scholars_gen3",
    name: "Eruditos",
    description: "Generación del conocimiento",
    palette: {
      primary: "#4B0082",
      secondary: "#48D1CC",
      accent: "#F0E68C",
      skin: "#E8C4A8",
    },
    hairColors: ["#191970", "#000080", "#4B0082"],
    clothingStyle: "elegant",
  },

  {
    id: "warriors_gen4",
    name: "Guardianes",
    description: "Generación de protectores",
    palette: {
      primary: "#8B0000",
      secondary: "#2F4F2F",
      accent: "#FFD700",
      skin: "#A0826D",
    },
    hairColors: ["#1C1C1C", "#3D2B1F", "#654321"],
    clothingStyle: "rugged",
  },

  {
    id: "mixed_gen5",
    name: "Mixtos",
    description: "Generación con herencia mezclada",
    palette: {
      primary: "#20B2AA",
      secondary: "#9370DB",
      accent: "#FF6347",
      skin: "#DEB887",
    },
    hairColors: ["#8B4513", "#A0522D", "#CD853F", "#696969"],
    clothingStyle: "decorated",
  },
];

export const SOCIAL_GROUP_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B88B",
  "#AAB7B8",
];

export const SOCIAL_GROUP_SYMBOLS = [
  "●",
  "■",
  "▲",
  "♦",
  "★",
  "✦",
  "⬡",
  "◆",
  "▼",
  "◉",
];

export const SKIN_TONES = [
  "#FFDFC4",
  "#F0C8A0",
  "#E6B88A",
  "#D2A679",
  "#C19A6B",
  "#A0826D",
  "#8B6F47",
  "#6F4E37",
];

export const EYE_COLORS = [
  "#8B4513",
  "#556B2F",
  "#4682B4",
  "#696969",
  "#2E8B57",
  "#191970",
  "#CD853F",
  "#4B0082",
];

export const HAIR_STYLES = [
  "short",
  "medium",
  "long",
  "braided",
  "bald",
  "wavy",
  "curly",
  "straight",
];
