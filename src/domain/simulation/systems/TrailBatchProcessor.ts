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

  private bufferDirty = true;
  private gpuService?: GPUComputeService;

  constructor(
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
  ) {
    this.gpuService = gpuService;
  }

  public rebuildBuffers(
    trails: Map<string, TrailSegment>,
    heatMap: Map<string, HeatMapCell>,
  ): void {
    // Rebuild Trail Buffer
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

    // Rebuild HeatMap Buffer
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

    this.bufferDirty = false;
  }

  public updateDecayBatch(
    trailDecayRate: number,
    heatMapDecayRate: number,
    deltaSeconds: number,
    minIntensity: number,
  ): void {
    if (!this.gpuService?.isGPUAvailable()) return;

    // Process Trails
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
          `⚠️ Error en GPU Trail Decay: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Process HeatMap
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
          `⚠️ Error en GPU HeatMap Decay: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.bufferDirty = true;
  }

  public syncToState(
    trails: Map<string, TrailSegment>,
    heatMap: Map<string, HeatMapCell>,
  ): void {
    // Sync Trails
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

      // Remove dead trails
      for (const id of toRemove) {
        trails.delete(id);
      }
    }

    // Sync HeatMap
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

      // Remove dead cells
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
