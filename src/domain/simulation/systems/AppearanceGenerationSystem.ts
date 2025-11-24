import { logger } from "@/infrastructure/utils/logger";
import type { AgentProfile } from "../../../shared/types/simulation/agents";
import type {
  AgentAppearance,
  ColorPalette,
  GenerationVisualTheme,
  SocialGroupAppearance,
  VisualStyle,
} from "../../../shared/types/simulation/appearance";
import {
  GENERATION_STYLES,
  SOCIAL_GROUP_COLORS,
  SOCIAL_GROUP_SYMBOLS,
  SKIN_TONES,
} from "../../../shared/types/simulation/appearance";
import { GeneticSpriteSystem } from "./GeneticSpriteSystem";
import { simulationEvents, GameEventNames } from "../core/events";

interface AppearanceConfig {
  enableGenerationalStyles: boolean;
  enableSocialMarkers: boolean;
  enableTraitModifiers: boolean;
  inheritanceStrength: number;
}

export class AppearanceGenerationSystem {
  private config: AppearanceConfig;
  private geneticSpriteSystem: GeneticSpriteSystem;

  private agentAppearances = new Map<string, AgentAppearance>();
  private generationThemes = new Map<number, GenerationVisualTheme>();
  private groupAppearances = new Map<string, SocialGroupAppearance>();

  constructor(config?: Partial<AppearanceConfig>) {
    this.config = {
      enableGenerationalStyles: true,
      enableSocialMarkers: true,
      enableTraitModifiers: true,
      inheritanceStrength: 0.7,
      ...config,
    };

    this.geneticSpriteSystem = new GeneticSpriteSystem();

    this.initializeGenerationThemes();

    logger.info("🎨 AppearanceGenerationSystem inicializado", this.config);
  }

  private initializeGenerationThemes(): void {
    for (let gen = 0; gen <= 10; gen++) {
      const styleIndex = Math.min(gen, GENERATION_STYLES.length - 1);
      const style = GENERATION_STYLES[styleIndex];

      const theme: GenerationVisualTheme = {
        generation: gen,
        style,
        iconicFeature: this.getIconicFeature(gen),
        influences: this.getGenerationalInfluences(gen),
      };

      this.generationThemes.set(gen, theme);
    }
  }

  private getIconicFeature(generation: number): string {
    const features = [
      "Aura divina dorada",
      "Manos callosas de trabajador",
      "Ojos agudos de artesano",
      "Frente amplia de pensador",
      "Cicatrices de batalla honorables",
      "Tatuajes de linaje familiar",
      "Medallón ancestral",
      "Patrones únicos de cabello",
      "Tono de piel mixto único",
      "Heterocromía heredada",
      "Marca de nacimiento distintiva",
    ];
    return features[Math.min(generation, features.length - 1)];
  }

  private getGenerationalInfluences(generation: number): string[] {
    const influences: string[] = [];
    if (generation === 0) {
      influences.push("Creación divina");
    } else if (generation === 1) {
      influences.push("Herencia divina directa");
    } else {
      const startGen = Math.max(0, generation - 3);
      for (let g = startGen; g < generation; g++) {
        influences.push(`Generación ${g}`);
      }
    }
    return influences;
  }

  public generateAppearance(
    agentId: string,
    profile: AgentProfile,
    fatherId?: string,
    motherId?: string,
  ): AgentAppearance {
    const generation = profile.generation;
    const theme =
      this.generationThemes.get(generation) || this.generationThemes.get(10)!;

    const fatherApp = fatherId
      ? this.agentAppearances.get(fatherId)
      : undefined;
    const motherApp = motherId
      ? this.agentAppearances.get(motherId)
      : undefined;

    const skinTone = this.generateSkinTone(fatherApp, motherApp);
    const hairColor = this.generateHairColor(theme.style, fatherApp, motherApp);

    const clothingColors = this.generateClothingColors(theme.style.palette);

    const traitModifiers = this.generateTraitModifiers(profile.traits);

    const geneticLineage = this.generateGeneticLineage(
      generation,
      profile.sex,
      fatherApp,
      motherApp,
      skinTone,
      hairColor,
    );

    const spriteVariant = geneticLineage.inheritedSkinVariant;

    const appearance: AgentAppearance = {
      agentId,
      sex: profile.sex,
      lifeStage: profile.lifeStage,
      skinTone,
      hairColor,

      clothingPrimary: clothingColors.primary,
      clothingSecondary: clothingColors.secondary,
      clothingStyle: theme.style.clothingStyle,
      geneticLineage,
      generationFeatures: {
        generation,
        iconicFeature: theme.iconicFeature,
        style: theme.style.name,
      },
      traitModifiers,

      spriteVariant,
    };

    this.agentAppearances.set(agentId, appearance);

    logger.debug("🎨 Apariencia generada (simplificada)", {
      agentId,
      generation,
      skinTone,
      style: theme.style.name,
    });

    simulationEvents.emit(GameEventNames.APPEARANCE_GENERATED, {
      agentId,
      appearance,
      timestamp: Date.now(),
    });

    return appearance;
  }

  private generateSkinTone(
    father?: AgentAppearance,
    mother?: AgentAppearance,
  ): string {
    if (father && mother && Math.random() < this.config.inheritanceStrength) {
      return this.blendSkinTones(father.skinTone, mother.skinTone);
    }
    return this.selectRandom(SKIN_TONES);
  }

  private blendSkinTones(tone1: string, tone2: string): string {
    const choice = Math.random();
    if (choice < 0.33) {
      return tone1;
    } else if (choice < 0.67) {
      return tone2;
    } else {
      const idx1 = SKIN_TONES.indexOf(tone1);
      const idx2 = SKIN_TONES.indexOf(tone2);
      if (idx1 >= 0 && idx2 >= 0) {
        const midIdx = Math.floor((idx1 + idx2) / 2);
        return SKIN_TONES[midIdx];
      }
      return tone1;
    }
  }

  private generateHairColor(
    style: VisualStyle,
    father?: AgentAppearance,
    mother?: AgentAppearance,
  ): string {
    if (father && mother && Math.random() < this.config.inheritanceStrength) {
      return Math.random() < 0.5 ? father.hairColor : mother.hairColor;
    }
    return this.selectRandom(style.hairColors);
  }

  private generateClothingColors(palette: ColorPalette): {
    primary: string;
    secondary: string;
  } {
    return {
      primary: palette.primary,
      secondary: palette.secondary,
    };
  }

  private generateTraitModifiers(
    traits: AgentProfile["traits"],
  ): AgentAppearance["traitModifiers"] {
    if (!this.config.enableTraitModifiers) {
      return {};
    }

    return {
      cooperationGlow: traits.cooperation,
      aggressionEdge: traits.aggression,
      diligencePosture: traits.diligence,
      curiosityEyes: traits.curiosity,
    };
  }

  private generateGeneticLineage(
    generation: number,
    sex: AgentAppearance["sex"],
    fatherApp: AgentAppearance | undefined,
    motherApp: AgentAppearance | undefined,
    skinTone: string,
    hairColor: string,
  ): AgentAppearance["geneticLineage"] {
    if (sex !== "male" && sex !== "female") {
      return {
        inheritedSkinVariant: "default",
        generationMix: 1.0,
      };
    }

    const variantConfig = {
      generation,
      sex,
      fatherSkinVariant: fatherApp?.geneticLineage?.inheritedSkinVariant,
      motherSkinVariant: motherApp?.geneticLineage?.inheritedSkinVariant,
      skinTone,
      hairColor,
    };

    const variantInfo =
      this.geneticSpriteSystem.generateSpriteVariant(variantConfig);

    let generationMix = 1.0;
    if (fatherApp && motherApp) {
      const fatherMix = fatherApp.geneticLineage?.generationMix ?? 1.0;
      const motherMix = motherApp.geneticLineage?.generationMix ?? 1.0;
      generationMix = ((fatherMix + motherMix) / 2.0) * 0.95;
    }

    return {
      fatherSkinVariant: variantConfig.fatherSkinVariant,
      motherSkinVariant: variantConfig.motherSkinVariant,
      inheritedSkinVariant: variantInfo.key,
      generationMix,
    };
  }

  public assignSocialGroupMarkers(agentId: string, groupId: string): void {
    const appearance = this.agentAppearances.get(agentId);

    if (!appearance) {
      logger.debug("🔄 Marcador social ignorado: entidad sin apariencia", {
        agentId,
        groupId,
      });
      return;
    }

    if (!this.config.enableSocialMarkers) return;

    let groupApp = this.groupAppearances.get(groupId);

    if (!groupApp) {
      const colorIndex =
        this.groupAppearances.size % SOCIAL_GROUP_COLORS.length;
      const symbolIndex =
        this.groupAppearances.size % SOCIAL_GROUP_SYMBOLS.length;

      groupApp = {
        groupId,
        color: SOCIAL_GROUP_COLORS[colorIndex],
        symbol: SOCIAL_GROUP_SYMBOLS[symbolIndex],
        accessory: this.selectRandom([
          "headband",
          "necklace",
          "armband",
          "cape",
          "none",
        ] as const),
        accessoryColor:
          SOCIAL_GROUP_COLORS[(colorIndex + 2) % SOCIAL_GROUP_COLORS.length],
      };

      this.groupAppearances.set(groupId, groupApp);
    }

    appearance.groupMarker = {
      color: groupApp.color,
      symbol: groupApp.symbol,
      accessory: groupApp.accessory,
    };

    logger.debug("🎨 Marcador social asignado", {
      agentId,
      groupId,
      symbol: groupApp.symbol,
    });

    simulationEvents.emit(GameEventNames.APPEARANCE_UPDATED, {
      agentId,
      appearance,
      reason: "social_group_assigned",
      groupId,
      timestamp: Date.now(),
    });
  }

  public updateForAging(
    agentId: string,
    newStage: AgentProfile["lifeStage"],
  ): void {
    const appearance = this.agentAppearances.get(agentId);
    if (!appearance) return;

    appearance.lifeStage = newStage;

    if (newStage === "elder") {
      appearance.hairColor = "#C0C0C0";
    }

    logger.debug("🎨 Apariencia actualizada por edad", {
      agentId,
      newStage,
    });

    simulationEvents.emit(GameEventNames.APPEARANCE_UPDATED, {
      agentId,
      appearance,
      reason: "aging",
      newStage,
      timestamp: Date.now(),
    });
  }

  public getAppearance(agentId: string): AgentAppearance | undefined {
    return this.agentAppearances.get(agentId);
  }

  public getGenerationTheme(
    generation: number,
  ): GenerationVisualTheme | undefined {
    return (
      this.generationThemes.get(generation) || this.generationThemes.get(10)
    );
  }

  public getSocialGroupAppearance(
    groupId: string,
  ): SocialGroupAppearance | undefined {
    return this.groupAppearances.get(groupId);
  }

  public getDiversityStats(): {
    totalAppearances: number;
    generationsRepresented: number;
    socialGroupsMarked: number;
    skinToneDistribution: Record<string, number>;
    bodyTypeDistribution: Record<string, number>;
  } {
    const stats = {
      totalAppearances: this.agentAppearances.size,
      generationsRepresented: new Set<number>(),
      socialGroupsMarked: this.groupAppearances.size,
      skinToneDistribution: {} as Record<string, number>,
      bodyTypeDistribution: {} as Record<string, number>,
    };

    this.agentAppearances.forEach((app) => {
      stats.generationsRepresented.add(app.generationFeatures.generation);

      stats.skinToneDistribution[app.skinTone] =
        (stats.skinToneDistribution[app.skinTone] || 0) + 1;
    });

    return {
      ...stats,
      generationsRepresented: stats.generationsRepresented.size,
    };
  }

  private selectRandom<T>(array: readonly T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }

  public exportAppearances(): {
    agents: Record<string, AgentAppearance>;
    groups: Record<string, SocialGroupAppearance>;
  } {
    const agents: Record<string, AgentAppearance> = {};
    const groups: Record<string, SocialGroupAppearance> = {};

    this.agentAppearances.forEach((app, id) => {
      agents[id] = app;
    });

    this.groupAppearances.forEach((app, id) => {
      groups[id] = app;
    });

    return { agents, groups };
  }

  public importAppearances(data: {
    agents: Record<string, AgentAppearance>;
    groups: Record<string, SocialGroupAppearance>;
  }): void {
    this.agentAppearances.clear();
    this.groupAppearances.clear();

    Object.entries(data.agents).forEach(([id, app]) => {
      this.agentAppearances.set(id, app);
    });

    Object.entries(data.groups).forEach(([id, app]) => {
      this.groupAppearances.set(id, app);
    });

    logger.info("🎨 Apariencias importadas", {
      agentsCount: Object.keys(data.agents).length,
      groupsCount: Object.keys(data.groups).length,
    });
  }
}
