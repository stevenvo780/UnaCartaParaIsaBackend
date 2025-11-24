import { OptimizedSpatialGrid } from "./OptimizedSpatialGrid";

/**
 * SpatialGrid - Wrapper sobre OptimizedSpatialGrid para compatibilidad
 * Mantiene la misma API pero usa implementación optimizada internamente
 */
export class SpatialGrid<T = string> extends OptimizedSpatialGrid<T> {
  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
    super(worldWidth, worldHeight, cellSize);
  }

  // Todos los métodos están heredados de OptimizedSpatialGrid
  // Se mantiene esta clase para compatibilidad con código existente
}
