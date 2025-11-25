import { logger } from "../../../infrastructure/utils/logger";
import type { GPUComputeService } from "../core/GPUComputeService";
import { inject, injectable, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { TrailSegment, HeatMapCell } from "../../types/game-types";

/**
 * Procesador batch optimizado para el sistema de rastros (TrailSystem)
 * Usa GPU cuando está disponible para calcular el decaimiento de miles de rastros
 */
@injectable()
export class TrailBatchProcessor {
  private trailIntensityBuffer: Float32Array | null = null;
  private heatMapBuffer: Float32Array | null = null;

  private trailIdArray: string[] = [];
  private heatMapIdArray: string[] = [];

  private gpuService?: GPUComputeService;

  constructor(
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
  ) {
    this.gpuService = gpuService;
  }

  /**
   * Rebuilds GPU buffers from trail and heat map state.
   *
   * @param {Map<string, TrailSegment>} trails - Trail segments map
   * @param {Map<string, HeatMapCell>} heatMap - Heat map cells map
   */
  public rebuildBuffers(
    trails: Map<string, TrailSegment>,
    heatMap: Map<string, HeatMapCell>,
  ): void {
    const trailCount = trails.size;
    if (trailCount > 0) {
      this.trailIntensityBuffer = new Float32Array(trailCount);
      this.trailIdArray = new Array<string>(trailCount);

      let index = 0;
      for (const [id, trail] of trails.entries()) {
        this.trailIntensityBuffer[index] = trail.intensity;
        this.trailIdArray[index] = id;
        index++;
      }
    } else {
      this.trailIntensityBuffer = null;
      this.trailIdArray = [];
    }

    const heatCount = heatMap.size;
    if (heatCount > 0) {
      this.heatMapBuffer = new Float32Array(heatCount);
      this.heatMapIdArray = new Array<string>(heatCount);

      let index = 0;
      for (const [id, cell] of heatMap.entries()) {
        this.heatMapBuffer[index] = cell.heat;
        this.heatMapIdArray[index] = id;
        index++;
      }
    } else {
      this.heatMapBuffer = null;
      this.heatMapIdArray = [];
    }
  }

  /**
   * Updates decay for trails and heat map using GPU batch processing.
   *
   * @param {number} trailDecayRate - Trail decay rate per second
   * @param {number} heatMapDecayRate - Heat map decay rate per second
   * @param {number} deltaSeconds - Time delta in seconds
   * @param {number} minIntensity - Minimum intensity threshold
   */
  public updateDecayBatch(
    trailDecayRate: number,
    heatMapDecayRate: number,
    deltaSeconds: number,
    minIntensity: number,
  ): void {
    if (!this.gpuService?.isGPUAvailable()) return;

    if (this.trailIntensityBuffer && this.trailIntensityBuffer.length > 0) {
      try {
        const newIntensities = this.gpuService.computeGeneralDecay(
          this.trailIntensityBuffer,
          trailDecayRate,
          deltaSeconds,
          minIntensity,
        );
        this.trailIntensityBuffer = newIntensities;
      } catch (error) {
        logger.warn(
          `⚠️ Error in GPU Trail Decay: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (this.heatMapBuffer && this.heatMapBuffer.length > 0) {
      try {
        const newHeat = this.gpuService.computeGeneralDecay(
          this.heatMapBuffer,
          heatMapDecayRate,
          deltaSeconds,
          0.1, // Heatmap threshold usually 0
        );
        this.heatMapBuffer = newHeat;
      } catch (error) {
        logger.warn(
          `⚠️ Error in GPU HeatMap Decay: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Synchronizes GPU buffer results back to trail and heat map state.
   * Removes trails and cells that have decayed below threshold.
   *
   * @param {Map<string, TrailSegment>} trails - Trail segments map to update
   * @param {Map<string, HeatMapCell>} heatMap - Heat map cells map to update
   */
  public syncToState(
    trails: Map<string, TrailSegment>,
    heatMap: Map<string, HeatMapCell>,
  ): void {
    if (this.trailIntensityBuffer && this.trailIdArray.length > 0) {
      const count = this.trailIdArray.length;
      const toRemove: string[] = [];

      for (let i = 0; i < count; i++) {
        const id = this.trailIdArray[i];
        const intensity = this.trailIntensityBuffer[i];

        if (intensity <= 0) {
          toRemove.push(id);
        } else {
          const trail = trails.get(id);
          if (trail) {
            trail.intensity = intensity;
          }
        }
      }

      for (const id of toRemove) {
        trails.delete(id);
      }
    }

    if (this.heatMapBuffer && this.heatMapIdArray.length > 0) {
      const count = this.heatMapIdArray.length;
      const toRemove: string[] = [];

      for (let i = 0; i < count; i++) {
        const id = this.heatMapIdArray[i];
        const heat = this.heatMapBuffer[i];

        if (heat <= 0) {
          toRemove.push(id);
        } else {
          const cell = heatMap.get(id);
          if (cell) {
            cell.heat = heat;
          }
        }
      }

      for (const id of toRemove) {
        heatMap.delete(id);
      }
    }
  }

  public getTrailCount(): number {
    return this.trailIdArray.length;
  }

  public getHeatMapCount(): number {
    return this.heatMapIdArray.length;
  }
}
