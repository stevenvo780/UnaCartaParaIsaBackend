/**
 * Cache Bus - Sistema centralizado de invalidación de cachés
 *
 * Proporciona versionado global y eventos de invalidación para coordinar
 * la limpieza de cachés entre múltiples sistemas de simulación.
 *
 * @module domain/simulation/core/CacheBus
 */

import { EventEmitter } from "events";
import { logger } from "../../../infrastructure/utils/logger";

export type CacheScope = "world" | "agents" | "resources" | "zones" | "all";

export interface CacheInvalidationEvent {
  scope: CacheScope;
  version: number;
  timestamp: number;
  reason?: string;
}

/**
 * Singleton para gestión centralizada de cachés
 *
 * Proporciona:
 * - Versionado global (se incrementa en cada invalidación)
 * - Eventos de invalidación por scope
 * - Tracking de suscriptores
 *
 * @example
 * // En un sistema con caché
 * private cacheVersion = 0;
 *
 * update() {
 *   if (this.cacheVersion !== cacheBus.getVersion()) {
 *     this.clearCache();
 *     this.cacheVersion = cacheBus.getVersion();
 *   }
 * }
 *
 * // Invalidar cuando cambia el estado
 * cacheBus.invalidate("resources", "Resource harvested");
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
   * Invalida cachés en un scope específico
   *
   * @param scope - Alcance de la invalidación
   * @param reason - Razón opcional para logging
   */
  public invalidate(scope: CacheScope, reason?: string): void {
    this.version++;

    // Actualizar versión del scope específico
    this.scopeVersions.set(scope, this.version);

    // Si es "all", actualizar todos los scopes
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
   * Obtiene la versión global actual
   */
  public getVersion(): number {
    return this.version;
  }

  /**
   * Obtiene la versión de un scope específico
   */
  public getScopeVersion(scope: CacheScope): number {
    return this.scopeVersions.get(scope) || 0;
  }

  /**
   * Registra un sistema como suscriptor
   */
  public registerSubscriber(systemName: string): void {
    this.subscribers.add(systemName);
    logger.debug(`[CacheBus] ${systemName} registered for cache invalidation`);
  }

  /**
   * Desregistra un sistema
   */
  public unregisterSubscriber(systemName: string): void {
    this.subscribers.delete(systemName);
  }

  /**
   * Obtiene lista de suscriptores activos
   */
  public getSubscribers(): string[] {
    return Array.from(this.subscribers);
  }

  /**
   * Resetea versiones (útil para tests)
   */
  public reset(): void {
    this.version = 0;
    for (const scope of this.scopeVersions.keys()) {
      this.scopeVersions.set(scope, 0);
    }
    logger.debug("[CacheBus] Reset all versions to 0");
  }

  /**
   * Estadísticas de invalidación
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
 * Instancia singleton del CacheBus
 */
export const cacheBus = new CacheBus();
