import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type {
  NeedDesireSnapshot,
  ResourceAttractionFieldSnapshot,
  ResourceAttractionSnapshot,
  ResourceEmergencyRequest,
  ResourceBiasSnapshot,
} from "../../types/simulation/ambient";
import { NeedType } from "../../../shared/constants/AIEnums";
import { ResourceType } from "../../../shared/constants/ResourceEnums";

const DESIRE_THRESHOLDS: Partial<
  Record<NeedType, { high: number; low?: number }>
> = {
  [NeedType.HUNGER]: { high: 60 },
  [NeedType.THIRST]: { high: 60 },
  [NeedType.ENERGY]: { high: 0, low: 35 },
  [NeedType.HYGIENE]: { high: 0, low: 40 },
};

const RESOURCE_MAPPING: Partial<Record<NeedType, ResourceType | null>> = {
  [NeedType.HUNGER]: ResourceType.FOOD,
  [NeedType.THIRST]: ResourceType.WATER,
  [NeedType.ENERGY]: null, // Energy doesn't map to a resource
  [NeedType.HYGIENE]: ResourceType.WATER,
};

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class ResourceAttractionSystem {
  private snapshot: ResourceAttractionSnapshot;

  constructor(
    @inject(TYPES.GameState) private readonly gameState: GameState,
    @inject(TYPES.NeedsSystem) private readonly needsSystem: NeedsSystem,
  ) {
    this.snapshot = {
      updatedAt: Date.now(),
      desires: [],
      fields: [],
      stats: {
        totalDesires: 0,
        activeZones: 0,
        attractedSpawns: 0,
        emergencyRequests: 0,
      },
      emergencies: [],
    };
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    const needs = this.needsSystem.getAllNeeds();
    const desires: NeedDesireSnapshot[] = [];
    const fieldMap = new Map<
      string,
      { total: number; needs: Map<string, number> }
    >();
    const emergencies: ResourceEmergencyRequest[] = [];

    for (const [entityId, data] of needs) {
      const zoneId = "global";
      (Object.keys(DESIRE_THRESHOLDS) as NeedType[]).forEach((needType) => {
        const thresholds = DESIRE_THRESHOLDS[needType];
        const value = data[needType] as number;
        if (typeof value !== "number") return;

        if (needType === NeedType.ENERGY || needType === NeedType.HYGIENE) {
          if (
            thresholds &&
            typeof thresholds.low === "number" &&
            value < thresholds.low
          ) {
            const intensity = thresholds.low - value;
            this.addDesire(
              desires,
              fieldMap,
              entityId,
              needType,
              zoneId,
              intensity,
              now,
            );
            if (value < 10) {
              const resourceType = RESOURCE_MAPPING[needType];
              if (resourceType) {
                emergencies.push({
                  agentId: entityId,
                  resourceType,
                  urgency: 1 - value / 100,
                  zoneId,
                  timestamp: now,
                });
              }
            }
          }
        } else if (thresholds && value > thresholds.high) {
          const intensity = value - thresholds.high;
          this.addDesire(
            desires,
            fieldMap,
            entityId,
            needType,
            zoneId,
            intensity,
            now,
          );
          if (value > 95) {
            const resourceType = RESOURCE_MAPPING[needType];
            if (resourceType) {
              emergencies.push({
                agentId: entityId,
                resourceType,
                urgency: value / 100,
                zoneId,
                timestamp: now,
              });
            }
          }
        }
      });
    }

    const fields: ResourceAttractionFieldSnapshot[] = [];
    fieldMap.forEach((data, zoneId) => {
      const dominantNeeds: ResourceBiasSnapshot[] = Array.from(
        data.needs.entries(),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([resourceType, intensity]) => ({
          resourceType: resourceType as ResourceType,
          intensity,
        }));

      const totalDesire = data.total;
      const spawnBias = Math.min(
        1,
        totalDesire / Math.max(1, desires.length * 10),
      );

      fields.push({
        zoneId,
        totalDesire,
        spawnBias,
        lastSpawn: now,
        dominantNeeds,
      });
    });

    fields.sort((a, b) => b.totalDesire - a.totalDesire);

    this.snapshot = {
      updatedAt: now,
      desires: desires.slice(-120),
      fields,
      stats: {
        totalDesires: desires.length,
        activeZones: fields.length,
        attractedSpawns: Math.floor(
          fields.reduce((sum, f) => sum + f.spawnBias, 0) * 10,
        ),
        emergencyRequests: emergencies.length,
      },
      emergencies: emergencies.slice(0, 20),
    };

    this.gameState.resourceAttraction = this.snapshot;
  }

  public getSnapshot(): ResourceAttractionSnapshot {
    return this.snapshot;
  }

  private addDesire(
    list: NeedDesireSnapshot[],
    fieldMap: Map<string, { total: number; needs: Map<string, number> }>,
    agentId: string,
    needType: NeedType,
    zoneId: string,
    intensity: number,
    timestamp: number,
  ): void {
    list.push({ agentId, needType, intensity, zoneId, timestamp });

    if (!fieldMap.has(zoneId)) {
      fieldMap.set(zoneId, { total: 0, needs: new Map() });
    }
    const record = fieldMap.get(zoneId)!;
    record.total += intensity;
    const resourceType = RESOURCE_MAPPING[needType];
    if (resourceType) {
      record.needs.set(
        resourceType,
        (record.needs.get(resourceType) || 0) + intensity,
      );
    }
  }
}
