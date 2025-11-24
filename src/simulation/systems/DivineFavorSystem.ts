import { simulationEvents, GameEventNames } from "../events.js";
import type {
  Blessing,
  BlessingEffect,
  BlessingType,
  DivineFavor,
  DivineFavorEvent,
  DivinePower,
  GodId,
} from "../types/divine.js";

interface DivineFavorConfig {
  basePowerRegenRate: number;
  maxPower: number;
  blessingCosts: Record<BlessingType, number>;
  defaultBlessingDuration: number;
}

const DEFAULT_CONFIG: DivineFavorConfig = {
  basePowerRegenRate: 0.1,
  maxPower: 100,
  blessingCosts: {
    fertility_boost: 20,
    productivity_boost: 15,
    longevity: 25,
    social_harmony: 15,
    resilience: 20,
    wisdom: 18,
    prosperity: 18,
  },
  defaultBlessingDuration: 5 * 60 * 1000,
};

const BLESSING_DEFINITIONS: Record<
  BlessingType,
  Omit<Blessing, "id" | "appliedAt" | "target" | "expiresAt" | "duration">
> = {
  fertility_boost: {
    type: "fertility_boost",
    name: "Fertilidad Divina",
    description: "Aumenta la tasa de natalidad del linaje",
    magnitude: 1.5,
  },
  productivity_boost: {
    type: "productivity_boost",
    name: "Manos Laboriosas",
    description: "Incrementa la eficiencia en el trabajo",
    magnitude: 1.3,
  },
  longevity: {
    type: "longevity",
    name: "Longevidad",
    description: "Extiende la esperanza de vida",
    magnitude: 1.2,
  },
  social_harmony: {
    type: "social_harmony",
    name: "Armonía Social",
    description: "Mejora las relaciones entre miembros",
    magnitude: 1.4,
  },
  resilience: {
    type: "resilience",
    name: "Resiliencia",
    description: "Reduce el desgaste de necesidades",
    magnitude: 0.8,
  },
  wisdom: {
    type: "wisdom",
    name: "Sabiduría Ancestral",
    description: "Acelera el aprendizaje y ganancia de experiencia",
    magnitude: 1.5,
  },
  prosperity: {
    type: "prosperity",
    name: "Prosperidad",
    description: "Aumenta recursos encontrados",
    magnitude: 1.4,
  },
};

export class DivineFavorSystem {
  private config: DivineFavorConfig;
  private favors = new Map<string, DivineFavor>();
  private blessings = new Map<string, Blessing>();
  private divinePowers: Record<GodId, DivinePower>;
  private lastBlessingId = 0;

  constructor(config?: Partial<DivineFavorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.divinePowers = {
      isa: { godId: "isa", power: this.config.maxPower, regenRate: this.config.basePowerRegenRate },
      stev: { godId: "stev", power: this.config.maxPower, regenRate: this.config.basePowerRegenRate },
    };
  }

  public update(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;
    for (const godId of Object.keys(this.divinePowers) as GodId[]) {
      const power = this.divinePowers[godId];
      power.power = Math.min(
        this.config.maxPower,
        power.power + power.regenRate * dt,
      );
    }

    const now = Date.now();
    for (const [id, blessing] of Array.from(this.blessings.entries())) {
      if (blessing.expiresAt && blessing.expiresAt <= now) {
        this.expireBlessing(id);
      }
    }
  }

  public grantBlessing(
    godId: GodId,
    lineageId: string,
    type: BlessingType,
    duration?: number,
  ): Blessing | null {
    const cost = this.config.blessingCosts[type];
    const power = this.divinePowers[godId];
    if (!power || power.power < cost) {
      return null;
    }

    const definition = BLESSING_DEFINITIONS[type];
    const now = Date.now();
    const blessing: Blessing = {
      id: `blessing_${++this.lastBlessingId}`,
      type: definition.type,
      name: definition.name,
      description: definition.description,
      magnitude: definition.magnitude,
      duration: duration ?? this.config.defaultBlessingDuration,
      appliedAt: now,
      expiresAt:
        duration && duration > 0 ? now + duration : now + this.config.defaultBlessingDuration,
      target: { lineageIds: [lineageId] },
    };

    this.blessings.set(blessing.id, blessing);
    power.power -= cost;

    const favor = this.ensureFavor(lineageId);
    favor.blessings.push(blessing.id);
    favor.favor = Math.min(2, favor.favor + 0.1);
    this.recordFavorEvent({
      timestamp: now,
      type: "blessing_granted",
      godId,
      lineageId,
      details: { blessing: blessing.id, type: blessing.type },
    });

    simulationEvents.emit(GameEventNames.DIVINE_BLESSING_GRANTED, {
      lineageId,
      blessingId: blessing.id,
      type: blessing.type,
      magnitude: blessing.magnitude,
      duration: blessing.duration,
    });

    return blessing;
  }

  public increaseFavor(lineageId: string, amount: number, godId: GodId): void {
    const favor = this.ensureFavor(lineageId);
    favor.favor = Math.min(2, favor.favor + amount);
    this.recordFavorEvent({
      timestamp: Date.now(),
      type: "favor_increased",
      godId,
      lineageId,
      details: { amount },
    });
  }

  public decreaseFavor(lineageId: string, amount: number, godId: GodId): void {
    const favor = this.favors.get(lineageId);
    if (!favor) return;

    favor.favor = Math.max(0, favor.favor - amount);
    this.recordFavorEvent({
      timestamp: Date.now(),
      type: "favor_decreased",
      godId,
      lineageId,
      details: { amount },
    });
  }

  public getFavor(lineageId: string): DivineFavor | undefined {
    return this.favors.get(lineageId);
  }

  public getGodPower(godId: GodId): DivinePower {
    return this.divinePowers[godId];
  }

  public getActiveEffects(lineageId: string): BlessingEffect[] {
    const favor = this.favors.get(lineageId);
    if (!favor) return [];

    const effects: BlessingEffect[] = [];
    for (const blessingId of favor.blessings) {
      const blessing = this.blessings.get(blessingId);
      if (!blessing) continue;
      effects.push({ type: blessing.type, multiplier: blessing.magnitude });
    }
    return effects;
  }

  public getMultiplier(lineageId: string, type: BlessingType): number {
    const effects = this.getActiveEffects(lineageId);
    const matching = effects.filter((effect) => effect.type === type);
    if (matching.length === 0) return 1.0;
    return matching.reduce((sum, effect) => sum + effect.multiplier - 1, 1);
  }

  public getSystemStats(): {
    totalFavors: number;
    activeBlessings: number;
    isaPower: number;
    stevPower: number;
    avgFavor: number;
  } {
    const favors = Array.from(this.favors.values());
    const avgFavor = favors.length
      ? favors.reduce((sum, favor) => sum + favor.favor, 0) / favors.length
      : 1.0;

    return {
      totalFavors: favors.length,
      activeBlessings: this.blessings.size,
      isaPower: this.divinePowers.isa.power,
      stevPower: this.divinePowers.stev.power,
      avgFavor,
    };
  }

  private expireBlessing(id: string): void {
    const blessing = this.blessings.get(id);
    if (!blessing) return;

    const lineageId = blessing.target.lineageIds?.[0];
    if (lineageId) {
      const favor = this.favors.get(lineageId);
      if (favor) {
        favor.blessings = favor.blessings.filter((bId) => bId !== id);
      }
    }

    this.blessings.delete(id);
  }

  private ensureFavor(lineageId: string): DivineFavor {
    let favor = this.favors.get(lineageId);
    if (!favor) {
      favor = { lineageId, favor: 1.0, blessings: [], history: [] };
      this.favors.set(lineageId, favor);
    }
    return favor;
  }

  private recordFavorEvent(event: DivineFavorEvent): void {
    if (!event.lineageId) return;
    const favor = this.favors.get(event.lineageId);
    if (!favor) return;

    favor.history.push(event);
    if (favor.history.length > 50) {
      favor.history.shift();
    }
  }
}
