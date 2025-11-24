import { GameEventNames, simulationEvents } from "../events.js";
import { getResourceConfig } from "../config/WorldResourceConfigs.js";
import type { WorldResourceInstance } from "../types/worldResources.js";
import type { GameState } from "../../types/game-types.js";

export class WorldResourceSystem {
  private state: GameState;
  private regenerationTimers = new Map<string, number>();
  private readonly REGENERATION_CHECK_INTERVAL = 5000;
  private lastRegenerationCheck = 0;

  constructor(state: GameState) {
    this.state = state;
    if (!this.state.worldResources) {
      this.state.worldResources = {};
    }

    simulationEvents.on(GameEventNames.RESOURCE_GATHERED, this.handleResourceGathered.bind(this));
  }

  public update(delta: number): void {
    const now = Date.now();
    if (now - this.lastRegenerationCheck < this.REGENERATION_CHECK_INTERVAL) {
      return;
    }
    this.lastRegenerationCheck = now;
    this.processRegeneration(now);
  }

  private processRegeneration(now: number): void {
    if (!this.state.worldResources) return;

    for (const [resourceId, startTime] of this.regenerationTimers.entries()) {
      const resource = this.state.worldResources[resourceId];
      if (!resource) {
        this.regenerationTimers.delete(resourceId);
        continue;
      }

      const config = getResourceConfig(resource.type);
      if (!config || !config.canRegenerate) {
        this.regenerationTimers.delete(resourceId);
        continue;
      }

      const elapsed = now - startTime;
      if (elapsed >= config.regenerationTime) {
        resource.state = "pristine";
        resource.harvestCount = 0;
        resource.regenerationStartTime = undefined;
        this.regenerationTimers.delete(resourceId);
        
        simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
          resourceId,
          newState: "pristine"
        });
      }
    }
  }

  private handleResourceGathered(data: { resourceId: string; amount: number }): void {
    if (!this.state.worldResources) return;
    const resource = this.state.worldResources[data.resourceId];
    if (!resource) return;

    const config = getResourceConfig(resource.type);
    if (!config) return;

    resource.harvestCount += 1;
    resource.lastHarvestTime = Date.now();

    let newState = resource.state;
    if (resource.harvestCount >= config.harvestsUntilDepleted) {
      newState = "depleted";
    } else if (resource.harvestCount >= config.harvestsUntilPartial) {
      newState = "harvested_partial";
    }

    if (newState !== resource.state) {
      resource.state = newState;
      simulationEvents.emit(GameEventNames.RESOURCE_STATE_CHANGE, {
        resourceId: resource.id,
        newState
      });

      if (newState === "depleted" && config.canRegenerate) {
        resource.regenerationStartTime = Date.now();
        this.regenerationTimers.set(resource.id, Date.now());
      }
    }
  }
}
