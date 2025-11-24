import { logger } from "@/infrastructure/utils/logger";

export interface SpriteVariantConfig {
  generation: number;
  sex: "male" | "female";
  fatherSkinVariant?: string;
  motherSkinVariant?: string;
  skinTone: string;
  hairColor: string;
}

export interface SpriteVariantInfo {
  key: string;
  baseSpriteKey: string;
  tintColor: number;
  description: string;
}

export class GeneticSpriteSystem {
  private variantCache = new Map<string, SpriteVariantInfo>();

  private readonly GENERATION_BASE_SPRITES = {
    0: {
      male: ["man1"],
      female: ["whomen1"],
    },
    1: {
      male: [
        "man1_golden",
        "man2_golden",
        "man1_sepia",
        "man2_sepia",
        "man1",
        "man2",
      ],
      female: [
        "whomen1_golden",
        "whomen2_golden",
        "whomen1_sepia",
        "whomen2_sepia",
        "whomen1",
        "whomen2",
      ],
    },
    2: {
      male: [
        "man1_orange",
        "man2_orange",
        "man1_golden",
        "man2_golden",
        "man1",
        "man2",
        "man3",
      ],
      female: [
        "whomen1_orange",
        "whomen2_orange",
        "whomen1_golden",
        "whomen2_golden",
        "whomen1",
        "whomen2",
        "whomen3",
      ],
    },
    3: {
      male: [
        "man1_blue",
        "man1_orange",
        "man2_orange",
        "man1_gray",
        "man1",
        "man2",
        "man3",
        "man4",
      ],
      female: [
        "whomen1_blue",
        "whomen1_orange",
        "whomen2_orange",
        "whomen1_gray",
        "whomen1",
        "whomen2",
        "whomen3",
        "whomen4",
      ],
    },
    4: {
      male: [
        "man1_purple",
        "man1_blue",
        "man1_gray",
        "man2_gray",
        "man1",
        "man2",
        "man3",
        "man4",
      ],
      female: [
        "whomen1_purple",
        "whomen1_blue",
        "whomen1_gray",
        "whomen2_gray",
        "whomen1",
        "whomen2",
        "whomen3",
        "whomen4",
      ],
    },
    5: {
      male: [
        "man1_purple",
        "man1_blue",
        "man1_orange",
        "man1_golden",
        "man1_gray",
        "man2_gray",
        "man1",
        "man2",
        "man3",
        "man4",
      ],
      female: [
        "whomen1_purple",
        "whomen1_blue",
        "whomen1_orange",
        "whomen1_golden",
        "whomen1_gray",
        "whomen2_gray",
        "whomen1",
        "whomen2",
        "whomen3",
        "whomen4",
      ],
    },
  };

  private readonly GENERATION_TINTS = [
    0xffffff, 0xffd700, 0xff8c00, 0x4169e1, 0x9370db, 0x32cd32, 0xff69b4,
  ];

  private readonly GENETIC_DOMINANCE: Record<number, number> = {
    0xffffff: 10,
    0xffd700: 9,
    0xff8c00: 8,
    0x4169e1: 7,
    0x9370db: 6,
    0x32cd32: 5,
    0xff69b4: 4,
  };

  private readonly SKIN_TONE_MODIFIERS = {
    light: 0xffe4c4,
    medium: 0xdeb887,
    tan: 0xd2691e,
    dark: 0x8b4513,
    olive: 0x9acd32,
  };

  private readonly HAIR_COLOR_MODIFIERS = {
    blonde: 0xfaf0be,
    golden: 0xdaa520,
    brown: 0x8b4513,
    black: 0x000000,
    red: 0xdc143c,
    auburn: 0xa52a2a,
    gray: 0xc0c0c0,
    white: 0xffffff,
  };

  constructor() {
    this.preloadBaseSpriteVariants();
  }

  private preloadBaseSpriteVariants(): void {
    logger.info("🎨 GeneticSpriteSystem: Preparando variantes de sprites");
  }

  public generateSpriteVariant(config: SpriteVariantConfig): SpriteVariantInfo {
    const {
      generation,
      sex,
      fatherSkinVariant,
      motherSkinVariant,
      skinTone,
      hairColor,
    } = config;

    const lineageHash = this.createLineageHash(
      generation,
      sex,
      fatherSkinVariant,
      motherSkinVariant,
      skinTone,
      hairColor,
    );

    if (this.variantCache.has(lineageHash)) {
      return this.variantCache.get(lineageHash)!;
    }

    const variant = this.createSpriteVariant(config, lineageHash);
    this.variantCache.set(lineageHash, variant);

    logger.debug("🎨 Sprite variant generado", {
      key: variant.key,
      generation,
      sex,
      hasParents: !!(fatherSkinVariant && motherSkinVariant),
    });

    return variant;
  }

  private createLineageHash(
    generation: number,
    sex: string,
    fatherVariant?: string,
    motherVariant?: string,
    skinTone?: string,
    hairColor?: string,
  ): string {
    const parts = [
      `gen${generation}`,
      sex,
      fatherVariant || "nofather",
      motherVariant || "nomother",
      skinTone || "default",
      hairColor || "default",
    ];
    return parts.join("_");
  }

  private createSpriteVariant(
    config: SpriteVariantConfig,
    hash: string,
  ): SpriteVariantInfo {
    const {
      generation,
      sex,
      fatherSkinVariant,
      motherSkinVariant,
      skinTone,
      hairColor,
    } = config;

    const baseSpriteKey = this.selectBaseSpriteKey(generation, sex);

    let tintColor = this.calculateInheritedTint(
      generation,
      fatherSkinVariant,
      motherSkinVariant,
    );

    tintColor = this.applyGeneticModifiers(tintColor, skinTone, hairColor);

    const description = this.createVariantDescription(
      generation,
      sex,
      fatherSkinVariant,
      motherSkinVariant,
    );

    return {
      key: hash,
      baseSpriteKey,
      tintColor,
      description,
    };
  }

  private applyGeneticModifiers(
    baseTint: number,
    skinTone: string,
    hairColor: string,
  ): number {
    let modifiedTint = baseTint;

    if (
      skinTone &&
      this.SKIN_TONE_MODIFIERS[
        skinTone as keyof typeof this.SKIN_TONE_MODIFIERS
      ]
    ) {
      const skinModifier =
        this.SKIN_TONE_MODIFIERS[
          skinTone as keyof typeof this.SKIN_TONE_MODIFIERS
        ];
      modifiedTint = this.blendTints(modifiedTint, skinModifier, 0.3);
    }

    if (
      hairColor &&
      this.HAIR_COLOR_MODIFIERS[
        hairColor as keyof typeof this.HAIR_COLOR_MODIFIERS
      ]
    ) {
      const hairModifier =
        this.HAIR_COLOR_MODIFIERS[
          hairColor as keyof typeof this.HAIR_COLOR_MODIFIERS
        ];
      modifiedTint = this.blendTints(modifiedTint, hairModifier, 0.2);
    }

    return modifiedTint;
  }

  private selectBaseSpriteKey(
    generation: number,
    sex: "male" | "female",
  ): string {
    const genIndex = Math.min(generation, 5);
    const sprites =
      this.GENERATION_BASE_SPRITES[
        genIndex as keyof typeof this.GENERATION_BASE_SPRITES
      ];

    if (!sprites) {
      logger.warn(`No sprites for generation ${generation}, using gen0`);
      return sex === "male" ? "man1" : "whomen1";
    }

    const options = sprites[sex];
    if (!options || options.length === 0) {
      return sex === "male" ? "man1" : "whomen1";
    }

    const index =
      generation === 0 ? 0 : Math.floor(Math.random() * options.length);
    return options[index];
  }

  private calculateInheritedTint(
    generation: number,
    fatherVariant?: string,
    motherVariant?: string,
  ): number {
    if (generation === 0) {
      return this.GENERATION_TINTS[0];
    }

    if (!fatherVariant || !motherVariant) {
      const genIndex = Math.min(generation, this.GENERATION_TINTS.length - 1);
      return this.GENERATION_TINTS[genIndex];
    }

    const fatherTint = this.extractTintFromVariant(fatherVariant);
    const motherTint = this.extractTintFromVariant(motherVariant);

    const fatherDominance = this.GENETIC_DOMINANCE[fatherTint] || 0;
    const motherDominance = this.GENETIC_DOMINANCE[motherTint] || 0;

    const inheritDominant = Math.random() < 0.7;

    let baseColor: number;

    if (Math.abs(fatherDominance - motherDominance) > 2) {
      baseColor = fatherDominance > motherDominance ? fatherTint : motherTint;

      if (!inheritDominant) {
        const recessiveColor =
          fatherDominance > motherDominance ? motherTint : fatherTint;
        baseColor = this.blendTints(baseColor, recessiveColor, 0.4);
      }
    } else {
      const blendWeight = 0.5 + (Math.random() - 0.5) * 0.3;
      baseColor = this.blendTints(fatherTint, motherTint, blendWeight);
    }

    if (Math.random() < 0.05) {
      const mutationColor =
        this.GENERATION_TINTS[
          Math.floor(Math.random() * this.GENERATION_TINTS.length)
        ];
      baseColor = this.blendTints(baseColor, mutationColor, 0.15);

      logger.debug("🧬 Mutación genética detectada en color", {
        fatherTint: fatherTint.toString(16),
        motherTint: motherTint.toString(16),
        mutatedTo: baseColor.toString(16),
      });
    }

    return baseColor;
  }

  private extractTintFromVariant(variant: string): number {
    const cached = this.variantCache.get(variant);
    if (cached) {
      return cached.tintColor;
    }

    const genMatch = variant.match(/gen(\d+)/);
    if (genMatch) {
      const gen = parseInt(genMatch[1]);
      const genIndex = Math.min(gen, this.GENERATION_TINTS.length - 1);
      return this.GENERATION_TINTS[genIndex];
    }

    return 0xcccccc;
  }

  private blendTints(color1: number, color2: number, weight = 0.5): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.floor(r1 * (1 - weight) + r2 * weight);
    const g = Math.floor(g1 * (1 - weight) + g2 * weight);
    const b = Math.floor(b1 * (1 - weight) + b2 * weight);

    return (r << 16) | (g << 8) | b;
  }

  private createVariantDescription(
    generation: number,
    sex: string,
    fatherVariant?: string,
    motherVariant?: string,
  ): string {
    if (generation === 0) {
      return `Dios${sex === "female" ? "a" : ""} Primigeni${sex === "female" ? "a" : "o"}`;
    }

    if (!fatherVariant || !motherVariant) {
      return `Generación ${generation} - ${sex === "male" ? "Hombre" : "Mujer"}`;
    }

    return `Gen ${generation} - Linaje mixto (${sex === "male" ? "hombre" : "mujer"})`;
  }

  public getVariant(hash: string): SpriteVariantInfo | undefined {
    return this.variantCache.get(hash);
  }

  public getStats(): {
    totalVariants: number;
    byGeneration: Record<number, number>;
    bySex: Record<string, number>;
  } {
    const stats = {
      totalVariants: this.variantCache.size,
      byGeneration: {} as Record<number, number>,
      bySex: {} as Record<string, number>,
    };

    this.variantCache.forEach((_variant, hash) => {
      const genMatch = hash.match(/gen(\d+)/);
      if (genMatch) {
        const gen = parseInt(genMatch[1]);
        stats.byGeneration[gen] = (stats.byGeneration[gen] || 0) + 1;
      }

      const sexMatch = hash.match(/(male|female)/);
      if (sexMatch) {
        const sex = sexMatch[1];
        stats.bySex[sex] = (stats.bySex[sex] || 0) + 1;
      }
    });

    return stats;
  }
}
