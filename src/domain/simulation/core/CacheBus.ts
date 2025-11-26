/**
 * Centralized cache invalidation system.
 *
 * Provides global versioning and invalidation events to coordinate
 * cache clearing across multiple simulation systems.
 *
 * @module domain/simulation/core/CacheBus
 */

import { EventEmitter } from "events";
import { logger } from "../../../infrastructure/utils/logger";

/**
 * Cache scope for invalidation targeting.
 */
export type CacheScope = "world" | "agents" | "resources" | "zones" | "all";

/**
 * Cache invalidation event payload.
 */
export interface CacheInvalidationEvent {
  scope: CacheScope;
  version: number;
  timestamp: number;
  reason?: string;
}

/**
 * Centralized cache management singleton.
 *
 * Provides:
 * - Global versioning (increments on each invalidation)
 * - Scope-specific invalidation events
 * - Subscriber tracking
 *
 * @example
 * ```typescript
 * // In a system with cache
 * private cacheVersion = 0;
 *
 * update() {
 *   if (this.cacheVersion !== cacheBus.getVersion()) {
 *     this.clearCache();
 *     this.cacheVersion = cacheBus.getVersion();
 *   }
 * }
 *
 * // Invalidate when state changes
 * cacheBus.invalidate("resources", "Resource harvested");
 * ```
 */
export class CacheBus extends EventEmitter {
  private version = 0;
  private scopeVersions: Map<CacheScope, number> = new Map();
  private subscribers: Set<string> = new Set();

  constructor() {
    super();
    this.scopeVersions.set("world", 0);
    this.scopeVersions.set("agents", 0);
    this.scopeVersions.set("resources", 0);
    this.scopeVersions.set("zones", 0);
    this.scopeVersions.set("all", 0);
  }

  /**
   * Invalidates caches in a specific scope.
   *
   * @param scope - Invalidation scope
   * @param reason - Optional reason for logging
   */
  public invalidate(scope: CacheScope, reason?: string): void {
    this.version++;

    this.scopeVersions.set(scope, this.version);

    if (scope === "all") {
      for (const s of this.scopeVersions.keys()) {
        this.scopeVersions.set(s, this.version);
      }
    }

    const event: CacheInvalidationEvent = {
      scope,
      version: this.version,
      timestamp: Date.now(),
      reason,
    };

    this.emit("cache:invalidate", event);
    this.emit(`cache:invalidate:${scope}`, event);

    logger.debug(
      `[CacheBus] Invalidated ${scope} caches → v${this.version} | ${reason || "no reason"}`,
    );
  }

  /**
   * Gets the current global version.
   *
   * @returns Current global cache version
   */
  public getVersion(): number {
    return this.version;
  }

  /**
   * Gets the version for a specific scope.
   *
   * @param scope - Cache scope to query
   * @returns Scope-specific version number
   */
  public getScopeVersion(scope: CacheScope): number {
    return this.scopeVersions.get(scope) || 0;
  }

  /**
   * Registers a system as a cache subscriber.
   *
   * @param systemName - Name of the subscribing system
   */
  public registerSubscriber(systemName: string): void {
    this.subscribers.add(systemName);
    logger.debug(`[CacheBus] ${systemName} registered for cache invalidation`);
  }

  /**
   * Unregisters a system from cache invalidation.
   *
   * @param systemName - Name of the system to unregister
   */
  public unregisterSubscriber(systemName: string): void {
    this.subscribers.delete(systemName);
  }

  /**
   * Gets list of active subscribers.
   *
   * @returns Array of subscriber system names
   */
  public getSubscribers(): string[] {
    return Array.from(this.subscribers);
  }

  /**
   * Resets all versions (useful for tests).
   */
  public reset(): void {
    this.version = 0;
    for (const scope of this.scopeVersions.keys()) {
      this.scopeVersions.set(scope, 0);
    }
    logger.debug("[CacheBus] Reset all versions to 0");
  }

  /**
   * Gets cache invalidation statistics.
   *
   * @returns Statistics including version, scope versions, and subscriber count
   */
  public getStats(): {
    version: number;
    scopeVersions: Record<CacheScope, number>;
    subscribers: number;
  } {
    return {
      version: this.version,
      scopeVersions: Object.fromEntries(this.scopeVersions.entries()) as Record<
        CacheScope,
        number
      >,
      subscribers: this.subscribers.size,
    };
  }
}

/**
 * Singleton instance of CacheBus.
 */
export const cacheBus = new CacheBus();
