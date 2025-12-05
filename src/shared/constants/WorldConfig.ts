export const WORLD_CONFIG = {
  WORLD_WIDTH: 4096,
  WORLD_HEIGHT: 4096,
  get WORLD_CENTER_X() {
    return this.WORLD_WIDTH / 2;
  },
  get WORLD_CENTER_Y() {
    return this.WORLD_HEIGHT / 2;
  },
  ZONE_MARGIN: 100,
  MIN_ZONE_SIZE: 200,
  MAX_ZONE_SIZE: 500,
} as const;

// Configs de tamaño de zonas eliminados al no tener consumidores actualmente.
