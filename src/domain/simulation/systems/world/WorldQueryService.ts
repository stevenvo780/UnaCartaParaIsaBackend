/**
 * WorldQueryService - Unified Spatial Query Interface
 *
 * Provides a single, consistent API for finding ANY entity in the world:
 * - Resources (trees, rocks, water, etc.)
 * - Animals
 * - Agents
 * - Tiles/Terrain
 * - Zones
 *
 * This service acts as a facade over:
 * - WorldResourceSystem (resources)
 * - AnimalRegistry (animals)
 * - AgentRegistry (agents)
 * - TerrainSystem (tiles)
 * - GameState.zones (zones)
 *
 * Benefits:
 * - Single import for all spatial queries
 * - Consistent API: findNearest(), findInRadius(), findAll()
 * - Type-safe results with discriminated unions
 * - Caching and performance optimization in one place
 *
 * @module world
 */

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../../config/Types";
import { logger } from "@/infrastructure/utils/logger";
import type { GameState, Zone } from "@/shared/types/game-types";
import type { WorldResourceInstance } from "@/shared/types/simulation/worldResources";
import type { Animal } from "@/shared/types/simulation/animals";
import type { AgentProfile } from "@/shared/types/simulation/agents";
import type { SimulationTerrainTile } from "@/shared/types/game-types";
import type { WorldResourceSystem } from "./WorldResourceSystem";
import type { AnimalRegistry } from "./animals/AnimalRegistry";
import type { AgentRegistry } from "../agents/AgentRegistry";
import type { TerrainSystem } from "./TerrainSystem";
import {
  WorldResourceType,
  ResourceState,
} from "../../../../shared/constants/ResourceEnums";
import { AnimalType } from "../../../../shared/constants/AnimalEnums";
import { BiomeType } from "../../../../shared/constants/BiomeEnums";
import { EntityType } from "../../../../shared/constants/EntityEnums";

/**
 * Base interface for all query results
 */
export interface QueryResult {
  id: string;
  position: { x: number; y: number };
  distance: number;
}

/**
 * Resource query result
 */
export interface ResourceQueryResult extends QueryResult {
  entityType: EntityType.RESOURCE;
  resourceType: WorldResourceType;
  state: ResourceState;
  resource: WorldResourceInstance;
}

/**
 * Animal query result
 */
export interface AnimalQueryResult extends QueryResult {
  entityType: EntityType.ANIMAL;
  animalType: AnimalType;
  isDead: boolean;
  animal: Animal;
}

/**
 * Agent query result
 */
export interface AgentQueryResult extends QueryResult {
  entityType: EntityType.AGENT;
  isDead: boolean;
  agent: AgentProfile;
}

/**
 * Tile query result
 */
export interface TileQueryResult {
  entityType: EntityType.TILE;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  biome: BiomeType | string;
  isWalkable: boolean;
  tile: SimulationTerrainTile;
}

/**
 * Zone query result
 */
export interface ZoneQueryResult extends QueryResult {
  entityType: EntityType.ZONE;
  zoneType: string;
  zone: Zone;
}

/**
 * Union type for any entity query result
 */
export type WorldEntityResult =
  | ResourceQueryResult
  | AnimalQueryResult
  | AgentQueryResult
  | ZoneQueryResult;

/**
 * Common query options
 */
export interface QueryOptions {
  /** Maximum results to return */
  limit?: number;
  /** Exclude dead entities */
  excludeDead?: boolean;
  /** Filter by biome */
  biome?: BiomeType | string;
}

/**
 * Resource-specific query options
 */
export interface ResourceQueryOptions extends QueryOptions {
  /** Filter by resource type */
  type?: WorldResourceType;
  /** Exclude depleted resources */
  excludeDepleted?: boolean;
}

/**
 * Animal-specific query options
 */
export interface AnimalQueryOptions extends QueryOptions {
  /** Filter by animal type */
  type?: AnimalType;
  /** Only include hostile animals */
  hostile?: boolean;
}

/**
 * Tile-specific query options
 */
export interface TileQueryOptions {
  /** Only walkable tiles */
  walkableOnly?: boolean;
  /** Filter by biome */
  biome?: BiomeType | string;
  /** Filter by asset type (e.g., "water", "tree") */
  hasAsset?: string;
}

@injectable()
export class WorldQueryService {
  public readonly name = "worldQuery";
  private tileSize: number = 64;
  private _lastWaterDebugLog = 0;

  constructor(
    @inject(TYPES.GameState) private gameState: GameState,
    @inject(TYPES.WorldResourceSystem)
    @optional()
    private worldResourceSystem?: WorldResourceSystem,
    @inject(TYPES.AnimalRegistry)
    @optional()
    private animalRegistry?: AnimalRegistry,
    @inject(TYPES.AgentRegistry)
    @optional()
    private agentRegistry?: AgentRegistry,
    @inject(TYPES.TerrainSystem)
    @optional()
    private terrainSystem?: TerrainSystem,
  ) {
    if (this.gameState.world?.config?.tileSize) {
      this.tileSize = this.gameState.world.config.tileSize;
    }
  }

  /**
   * Find the nearest resource to a position
   *
   * @example
   * ```ts
   *
   * const water = worldQuery.findNearestResource(x, y, { type: WorldResourceType.WATER_SOURCE });
   *
   *
   * const tree = worldQuery.findNearestResource(x, y, {
   *   type: WorldResourceType.TREE,
   *   excludeDepleted: true
   * });
   * ```
   */
  public findNearestResource(
    x: number,
    y: number,
    options: ResourceQueryOptions = {},
  ): ResourceQueryResult | null {
    if (!this.worldResourceSystem) return null;

    const resource = this.worldResourceSystem.getNearestResource(
      x,
      y,
      options.type,
    );
    if (!resource) return null;

    if (options.excludeDepleted && resource.state === ResourceState.DEPLETED) {
      return null;
    }

    const dx = resource.position.x - x;
    const dy = resource.position.y - y;
    const distance = Math.hypot(dx, dy);

    return {
      id: resource.id,
      position: resource.position,
      distance,
      entityType: EntityType.RESOURCE as const,
      resourceType: resource.type,
      state: resource.state,
      resource,
    };
  }

  /**
   * Find all resources within a radius
   */
  public findResourcesInRadius(
    x: number,
    y: number,
    radius: number,
    options: ResourceQueryOptions = {},
  ): ResourceQueryResult[] {
    if (!this.worldResourceSystem) return [];

    const resources = this.worldResourceSystem.getResourcesInRadius(
      x,
      y,
      radius,
    );

    return resources
      .filter((r) => {
        if (options.type && r.type !== options.type) return false;
        if (options.excludeDepleted && r.state === ResourceState.DEPLETED)
          return false;
        return true;
      })
      .map((resource) => {
        const dx = resource.position.x - x;
        const dy = resource.position.y - y;
        const distance = Math.hypot(dx, dy);

        return {
          id: resource.id,
          position: resource.position,
          distance,
          entityType: EntityType.RESOURCE as const,
          resourceType: resource.type,
          state: resource.state,
          resource,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, options.limit ?? Infinity);
  }

  /**
   * Find resources by type (world-wide, not spatial)
   */
  public findResourcesByType(type: WorldResourceType): ResourceQueryResult[] {
    if (!this.worldResourceSystem) return [];

    const resources = this.worldResourceSystem.getResourcesByType(type);

    return resources.map((resource) => ({
      id: resource.id,
      position: resource.position,
      distance: 0,
      entityType: EntityType.RESOURCE as const,
      resourceType: resource.type,
      state: resource.state,
      resource,
    }));
  }

  /**
   * Find the nearest animal to a position
   *
   * @example
   * ```ts
   *
   * const prey = worldQuery.findNearestAnimal(x, y, { excludeDead: true });
   *
   *
   * const deer = worldQuery.findNearestAnimal(x, y, { type: AnimalType.DEER });
   * ```
   */
  public findNearestAnimal(
    x: number,
    y: number,
    options: AnimalQueryOptions = {},
  ): AnimalQueryResult | null {
    if (!this.animalRegistry) return null;

    const animals = this.animalRegistry.getAnimalsInRadius(
      x,
      y,
      2000,
      options.excludeDead ?? true,
    );

    let nearest: Animal | null = null;
    let minDistSq = Infinity;

    for (const animal of animals) {
      if (options.type && animal.type !== options.type) continue;
      if (options.excludeDead && animal.isDead) continue;

      const dx = animal.position.x - x;
      const dy = animal.position.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = animal;
      }
    }

    if (!nearest) return null;

    return {
      id: nearest.id,
      position: nearest.position,
      distance: Math.sqrt(minDistSq),
      entityType: EntityType.ANIMAL as const,
      animalType: nearest.type,
      isDead: nearest.isDead,
      animal: nearest,
    };
  }

  /**
   * Find all animals within a radius
   */
  public findAnimalsInRadius(
    x: number,
    y: number,
    radius: number,
    options: AnimalQueryOptions = {},
  ): AnimalQueryResult[] {
    if (!this.animalRegistry) return [];

    const animals = this.animalRegistry.getAnimalsInRadius(
      x,
      y,
      radius,
      options.excludeDead ?? true,
    );

    return animals
      .filter((animal) => {
        if (options.type && animal.type !== options.type) return false;
        if (options.excludeDead && animal.isDead) return false;
        return true;
      })
      .map((animal) => {
        const dx = animal.position.x - x;
        const dy = animal.position.y - y;

        return {
          id: animal.id,
          position: animal.position,
          distance: Math.hypot(dx, dy),
          entityType: EntityType.ANIMAL as const,
          animalType: animal.type,
          isDead: animal.isDead,
          animal,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, options.limit ?? Infinity);
  }

  /**
   * Find animals by type (world-wide)
   */
  public findAnimalsByType(type: AnimalType): AnimalQueryResult[] {
    if (!this.animalRegistry) return [];

    const animals = this.animalRegistry.getAnimalsByType(type);

    return animals.map((animal) => ({
      id: animal.id,
      position: animal.position,
      distance: 0,
      entityType: EntityType.ANIMAL as const,
      animalType: animal.type,
      isDead: animal.isDead,
      animal,
    }));
  }

  /**
   * Find the nearest agent to a position
   */
  public findNearestAgent(
    x: number,
    y: number,
    options: QueryOptions = {},
  ): AgentQueryResult | null {
    if (!this.agentRegistry) return null;

    const searchRadii = [300, 800, 1600, 3200, 6400];
    for (const radius of searchRadii) {
      const agents = this.agentRegistry.getAgentsInRadius({ x, y }, radius, {
        excludeDead: options.excludeDead,
      });
      if (agents.length === 0) continue;

      let nearest: AgentProfile | null = null;
      let minDistSq = Infinity;
      for (const agent of agents) {
        if (!agent.position) continue;
        const dx = agent.position.x - x;
        const dy = agent.position.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = agent;
        }
      }

      if (nearest && nearest.position) {
        return {
          id: nearest.id,
          position: nearest.position,
          distance: Math.sqrt(minDistSq),
          entityType: EntityType.AGENT as const,
          isDead: nearest.isDead ?? false,
          agent: nearest,
        };
      }
    }

    return null;
  }

  /**
   * Find all agents within a radius
   */
  public findAgentsInRadius(
    x: number,
    y: number,
    radius: number,
    options: QueryOptions = {},
  ): AgentQueryResult[] {
    if (!this.agentRegistry) return [];

    const agents = this.agentRegistry.getAgentsInRadius({ x, y }, radius, {
      excludeDead: options.excludeDead,
    });

    return agents
      .map((agent) => {
        const dx = (agent.position?.x ?? 0) - x;
        const dy = (agent.position?.y ?? 0) - y;
        return {
          id: agent.id,
          position: agent.position!,
          distance: Math.hypot(dx, dy),
          entityType: EntityType.AGENT as const,
          isDead: agent.isDead ?? false,
          agent,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, options.limit ?? Infinity);
  }

  /**
   * Get a tile at world coordinates
   */
  public getTileAt(worldX: number, worldY: number): TileQueryResult | null {
    if (!this.terrainSystem) return null;

    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);

    const tile = this.terrainSystem.getTile(tileX, tileY);
    if (!tile) return null;

    return {
      entityType: EntityType.TILE as const,
      tileX,
      tileY,
      worldX: tileX * this.tileSize,
      worldY: tileY * this.tileSize,
      biome: tile.biome,
      isWalkable: tile.isWalkable,
      tile,
    };
  }

  /**
   * Find tiles in a rectangular area
   */
  public findTilesInArea(
    x: number,
    y: number,
    width: number,
    height: number,
    options: TileQueryOptions = {},
  ): TileQueryResult[] {
    if (!this.terrainSystem) return [];

    const results: TileQueryResult[] = [];

    const startTileX = Math.floor(x / this.tileSize);
    const startTileY = Math.floor(y / this.tileSize);
    const endTileX = Math.floor((x + width) / this.tileSize);
    const endTileY = Math.floor((y + height) / this.tileSize);

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const tile = this.terrainSystem.getTile(tileX, tileY);
        if (!tile) continue;

        if (options.walkableOnly && !tile.isWalkable) continue;
        if (options.biome && tile.biome !== options.biome) continue;

        if (options.hasAsset) {
          const hasAsset =
            tile.assets?.terrain?.includes(options.hasAsset) ||
            tile.assets?.vegetation?.includes(options.hasAsset);
          if (!hasAsset) continue;
        }

        results.push({
          entityType: EntityType.TILE as const,
          tileX,
          tileY,
          worldX: tileX * this.tileSize,
          worldY: tileY * this.tileSize,
          biome: tile.biome,
          isWalkable: tile.isWalkable,
          tile,
        });
      }
    }

    return results;
  }

  /**
   * Find water tiles near a position.
   * Searches for OCEAN and LAKE biomes.
   * Results are sorted by distance from the query position.
   */
  public findWaterTilesNear(
    x: number,
    y: number,
    radius: number,
  ): TileQueryResult[] {
    const oceanTiles = this.findTilesInArea(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2,
      { biome: BiomeType.OCEAN },
    );

    const lakeTiles = this.findTilesInArea(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2,
      { biome: BiomeType.LAKE },
    );

    const now = Date.now();
    if (!this._lastWaterDebugLog || now - this._lastWaterDebugLog > 30000) {
      this._lastWaterDebugLog = now;
      logger.debug(
        `🌊 [WorldQueryService] findWaterTilesNear(${x.toFixed(0)}, ${y.toFixed(0)}, r=${radius}): ocean=${oceanTiles.length}, lake=${lakeTiles.length}`,
      );
    }

    const allWaterTiles = [...oceanTiles, ...lakeTiles];

    return allWaterTiles.sort((a, b) => {
      const distA = Math.hypot(a.worldX - x, a.worldY - y);
      const distB = Math.hypot(b.worldX - x, b.worldY - y);
      return distA - distB;
    });
  }

  /**
   * Find the zone containing a position
   */
  public getZoneAt(x: number, y: number): ZoneQueryResult | null {
    const zones = this.gameState.zones ?? [];

    for (const zone of zones) {
      if (
        x >= zone.bounds.x &&
        x <= zone.bounds.x + zone.bounds.width &&
        y >= zone.bounds.y &&
        y <= zone.bounds.y + zone.bounds.height
      ) {
        const centerX = zone.bounds.x + zone.bounds.width / 2;
        const centerY = zone.bounds.y + zone.bounds.height / 2;
        const dx = centerX - x;
        const dy = centerY - y;

        return {
          id: zone.id,
          position: { x: centerX, y: centerY },
          distance: Math.hypot(dx, dy),
          entityType: EntityType.ZONE as const,
          zoneType: zone.type,
          zone,
        };
      }
    }

    return null;
  }

  /**
   * Find zones of a specific type
   */
  public findZonesByType(zoneType: string): ZoneQueryResult[] {
    const zones = this.gameState.zones ?? [];

    return zones
      .filter((zone) => zone.type === zoneType)
      .map((zone) => ({
        id: zone.id,
        position: {
          x: zone.bounds.x + zone.bounds.width / 2,
          y: zone.bounds.y + zone.bounds.height / 2,
        },
        distance: 0,
        entityType: EntityType.ZONE as const,
        zoneType: zone.type,
        zone,
      }));
  }

  /**
   * Find the nearest zone to a position
   */
  public findNearestZone(
    x: number,
    y: number,
    zoneType?: string,
  ): ZoneQueryResult | null {
    const zones = this.gameState.zones ?? [];

    let nearest: Zone | null = null;
    let minDistSq = Infinity;

    for (const zone of zones) {
      if (zoneType && zone.type !== zoneType) continue;

      const centerX = zone.bounds.x + zone.bounds.width / 2;
      const centerY = zone.bounds.y + zone.bounds.height / 2;
      const dx = centerX - x;
      const dy = centerY - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = zone;
      }
    }

    if (!nearest) return null;

    return {
      id: nearest.id,
      position: {
        x: nearest.bounds.x + nearest.bounds.width / 2,
        y: nearest.bounds.y + nearest.bounds.height / 2,
      },
      distance: Math.sqrt(minDistSq),
      entityType: EntityType.ZONE as const,
      zoneType: nearest.type,
      zone: nearest,
    };
  }

  /**
   * Find ANY entity nearest to a position
   * Searches across resources, animals, agents, and zones
   *
   * @example
   * ```ts
   * const nearest = worldQuery.findNearestEntity(x, y);
   * switch (nearest?.entityType) {
   *   case EntityType.RESOURCE:
   *   case EntityType.ANIMAL:
   *   case 'agent':
   * }
   * ```
   */
  public findNearestEntity(
    x: number,
    y: number,
    options: QueryOptions = {},
  ): WorldEntityResult | null {
    const candidates: WorldEntityResult[] = [];

    const resource = this.findNearestResource(x, y, { excludeDepleted: true });
    if (resource) candidates.push(resource);

    const animal = this.findNearestAnimal(x, y, options);
    if (animal) candidates.push(animal);

    const agent = this.findNearestAgent(x, y, options);
    if (agent) candidates.push(agent);

    const zone = this.findNearestZone(x, y);
    if (zone) candidates.push(zone);

    if (candidates.length === 0) return null;

    return candidates.reduce((nearest, current) =>
      current.distance < nearest.distance ? current : nearest,
    );
  }

  /**
   * Find ALL entities within a radius
   */
  public findEntitiesInRadius(
    x: number,
    y: number,
    radius: number,
    options: QueryOptions = {},
  ): WorldEntityResult[] {
    const results: WorldEntityResult[] = [];

    results.push(...this.findResourcesInRadius(x, y, radius));
    results.push(...this.findAnimalsInRadius(x, y, radius, options));
    results.push(...this.findAgentsInRadius(x, y, radius, options));

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, options.limit ?? Infinity);
  }

  /**
   * Check if a position is walkable
   */
  public isWalkable(x: number, y: number): boolean {
    const tile = this.getTileAt(x, y);
    return tile?.isWalkable ?? true;
  }

  /**
   * Get the biome at a position
   */
  public getBiomeAt(x: number, y: number): BiomeType | string | null {
    const tile = this.getTileAt(x, y);
    return tile?.biome ?? null;
  }

  /**
   * Check if there's water at a position
   */
  public hasWaterAt(x: number, y: number): boolean {
    const tile = this.getTileAt(x, y);
    return tile?.biome === BiomeType.OCEAN;
  }

  /**
   * Find nearest water source within a reasonable exploration radius.
   * Uses small radius - agents must EXPLORE to find water, not magically know where it is.
   * Water is at map edges, so agents will need to explore in that direction.
   */
  public findNearestWater(x: number, y: number): TileQueryResult | null {
    const waterTiles = this.findWaterTilesNear(x, y, 500);
    return waterTiles.length > 0 ? waterTiles[0] : null;
  }

  /**
   * Get the direction to the nearest water source for exploration.
   * In an infinite world, there are no "edges" - we search for actual water tiles.
   * If no water is found nearby, suggests a random exploration direction.
   */
  public getDirectionToNearestEdge(
    x: number,
    y: number,
  ): { x: number; y: number; edgeName: string } {
    // En mundo infinito, buscar agua cercana primero
    const waterTile = this.findNearestWater(x, y);
    if (waterTile) {
      return {
        x: waterTile.worldX,
        y: waterTile.worldY,
        edgeName: "water",
      };
    }

    // Si no hay agua cercana, sugerir dirección aleatoria para exploración
    // En mundo infinito no hay "bordes" - explorar en cualquier dirección
    const angle = Math.random() * Math.PI * 2;
    const exploreDistance = 300;
    return {
      x: x + Math.cos(angle) * exploreDistance,
      y: y + Math.sin(angle) * exploreDistance,
      edgeName: "explore",
    };
  }

  /**
   * Find nearest food source (berry bush, animals, etc.)
   */
  public findNearestFood(
    x: number,
    y: number,
  ): ResourceQueryResult | AnimalQueryResult | null {
    const berryBush = this.findNearestResource(x, y, {
      type: WorldResourceType.BERRY_BUSH,
      excludeDepleted: true,
    });

    const animal = this.findNearestAnimal(x, y, { excludeDead: true });

    if (!berryBush && !animal) return null;
    if (!berryBush) return animal;
    if (!animal) return berryBush;

    return berryBush.distance < animal.distance ? berryBush : animal;
  }

  /**
   * Find nearest harvestable resource (tree, rock, etc.)
   */
  public findNearestHarvestable(
    x: number,
    y: number,
    type?: WorldResourceType,
  ): ResourceQueryResult | null {
    return this.findNearestResource(x, y, {
      type,
      excludeDepleted: true,
    });
  }
}
