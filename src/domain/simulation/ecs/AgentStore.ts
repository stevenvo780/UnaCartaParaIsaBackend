/**
 * @fileoverview Agent Store - ECS Central Data Store
 *
 * Almacén central de componentes de agentes.
 * Todos los sistemas leen/escriben a través de este store.
 *
 * Características:
 * - Acceso O(1) a cualquier componente
 * - Índices separados por tipo de componente
 * - Queries eficientes (agentes en combate, con necesidades bajas, etc.)
 * - Inmutabilidad: siempre se crean nuevos objetos al actualizar
 *
 * @module domain/simulation/ecs
 */

import { injectable } from "inversify";
import { logger } from "@/infrastructure/utils/logger";
import {
  type AgentComponents,
  type ComponentType,
  type HealthComponent,
  type NeedsComponent,
  type TransformComponent,
  type MovementComponent,
  type CombatComponent,
  type AIComponent,
  type InventoryComponent,
  type RoleComponent,
  type SocialComponent,
  type ProfileComponent,
  cloneComponent,
} from "./AgentComponents";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentStoreConfig {
  /** Enable debug logging */
  debug: boolean;
  /** Enable dirty tracking for optimization */
  trackDirty: boolean;
}

const DEFAULT_CONFIG: AgentStoreConfig = {
  debug: false,
  trackDirty: true,
};

// ============================================================================
// AGENT STORE
// ============================================================================

@injectable()
export class AgentStore {
  private config: AgentStoreConfig;

  // Almacén principal: agentId -> todos sus componentes
  private entities = new Map<string, Partial<AgentComponents>>();

  // Índices por tipo de componente para acceso rápido
  private healthIndex = new Map<string, HealthComponent>();
  private needsIndex = new Map<string, NeedsComponent>();
  private transformIndex = new Map<string, TransformComponent>();
  private movementIndex = new Map<string, MovementComponent>();
  private combatIndex = new Map<string, CombatComponent>();
  private aiIndex = new Map<string, AIComponent>();
  private inventoryIndex = new Map<string, InventoryComponent>();
  private roleIndex = new Map<string, RoleComponent>();
  private socialIndex = new Map<string, SocialComponent>();
  private profileIndex = new Map<string, ProfileComponent>();

  // Tracking de cambios para optimización
  private dirtyComponents = new Map<string, Set<ComponentType>>();

  // Cache de queries comunes
  private agentsInCombatCache: string[] | null = null;
  private agentsMovingCache: string[] | null = null;

  constructor(config?: Partial<AgentStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info("🗄️ AgentStore: Initialized");
  }

  // ==========================================================================
  // ENTITY MANAGEMENT
  // ==========================================================================

  /**
   * Registra un nuevo agente con componentes iniciales
   */
  public registerAgent(
    agentId: string,
    components: Partial<AgentComponents>,
  ): void {
    if (this.entities.has(agentId)) {
      logger.warn(`AgentStore: Agent ${agentId} already registered`);
      return;
    }

    this.entities.set(agentId, { id: agentId, ...components });

    // Indexar cada componente
    if (components.health) this.healthIndex.set(agentId, components.health);
    if (components.needs) this.needsIndex.set(agentId, components.needs);
    if (components.transform)
      this.transformIndex.set(agentId, components.transform);
    if (components.movement)
      this.movementIndex.set(agentId, components.movement);
    if (components.combat) this.combatIndex.set(agentId, components.combat);
    if (components.ai) this.aiIndex.set(agentId, components.ai);
    if (components.inventory)
      this.inventoryIndex.set(agentId, components.inventory);
    if (components.role) this.roleIndex.set(agentId, components.role);
    if (components.social) this.socialIndex.set(agentId, components.social);
    if (components.profile) this.profileIndex.set(agentId, components.profile);

    this.invalidateCaches();

    if (this.config.debug) {
      logger.debug(`AgentStore: Registered agent ${agentId}`);
    }
  }

  /**
   * Elimina un agente y todos sus componentes
   */
  public removeAgent(agentId: string): void {
    this.entities.delete(agentId);

    // Limpiar todos los índices
    this.healthIndex.delete(agentId);
    this.needsIndex.delete(agentId);
    this.transformIndex.delete(agentId);
    this.movementIndex.delete(agentId);
    this.combatIndex.delete(agentId);
    this.aiIndex.delete(agentId);
    this.inventoryIndex.delete(agentId);
    this.roleIndex.delete(agentId);
    this.socialIndex.delete(agentId);
    this.profileIndex.delete(agentId);

    this.dirtyComponents.delete(agentId);
    this.invalidateCaches();

    if (this.config.debug) {
      logger.debug(`AgentStore: Removed agent ${agentId}`);
    }
  }

  /**
   * Verifica si un agente existe
   */
  public hasAgent(agentId: string): boolean {
    return this.entities.has(agentId);
  }

  /**
   * Obtiene todos los IDs de agentes
   */
  public getAllAgentIds(): string[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Obtiene el número de agentes
   */
  public getAgentCount(): number {
    return this.entities.size;
  }

  // ==========================================================================
  // COMPONENT ACCESS - TYPED GETTERS
  // ==========================================================================

  /**
   * Obtiene un componente específico de un agente
   */
  public getComponent<K extends ComponentType>(
    agentId: string,
    component: K,
  ): AgentComponents[K] | undefined {
    const index = this.getIndexForComponent(component);
    return index?.get(agentId) as AgentComponents[K] | undefined;
  }

  /**
   * Establece un componente para un agente (inmutable)
   */
  public setComponent<K extends ComponentType>(
    agentId: string,
    component: K,
    value: AgentComponents[K],
  ): void {
    const entity = this.entities.get(agentId);
    if (!entity) {
      logger.warn(
        `AgentStore: Cannot set ${component} - agent ${agentId} not found`,
      );
      return;
    }

    // Clonar para inmutabilidad
    const cloned = cloneComponent(value);

    // Actualizar entidad
    (entity as Record<string, unknown>)[component] = cloned;

    // Actualizar índice
    const index = this.getIndexForComponent(component);
    if (index) {
      (index as Map<string, unknown>).set(agentId, cloned);
    }

    // Marcar como dirty
    if (this.config.trackDirty) {
      if (!this.dirtyComponents.has(agentId)) {
        this.dirtyComponents.set(agentId, new Set());
      }
      this.dirtyComponents.get(agentId)!.add(component);
    }

    // Invalidar caches relevantes
    if (component === "combat") this.agentsInCombatCache = null;
    if (component === "movement") this.agentsMovingCache = null;
  }

  // Getters específicos para acceso rápido
  public getHealth(agentId: string): HealthComponent | undefined {
    return this.healthIndex.get(agentId);
  }

  public getNeeds(agentId: string): NeedsComponent | undefined {
    return this.needsIndex.get(agentId);
  }

  public getTransform(agentId: string): TransformComponent | undefined {
    return this.transformIndex.get(agentId);
  }

  public getMovement(agentId: string): MovementComponent | undefined {
    return this.movementIndex.get(agentId);
  }

  public getCombat(agentId: string): CombatComponent | undefined {
    return this.combatIndex.get(agentId);
  }

  public getAI(agentId: string): AIComponent | undefined {
    return this.aiIndex.get(agentId);
  }

  public getInventory(agentId: string): InventoryComponent | undefined {
    return this.inventoryIndex.get(agentId);
  }

  public getRole(agentId: string): RoleComponent | undefined {
    return this.roleIndex.get(agentId);
  }

  public getSocial(agentId: string): SocialComponent | undefined {
    return this.socialIndex.get(agentId);
  }

  public getProfile(agentId: string): ProfileComponent | undefined {
    return this.profileIndex.get(agentId);
  }

  // Obtener posición (shortcut común)
  public getPosition(agentId: string): { x: number; y: number } | undefined {
    const transform = this.transformIndex.get(agentId);
    return transform ? { x: transform.x, y: transform.y } : undefined;
  }

  // ==========================================================================
  // SETTERS - Shortcuts for common component updates
  // ==========================================================================

  public setHealth(agentId: string, health: HealthComponent): void {
    this.setComponent(agentId, "health", health);
  }

  public setNeeds(agentId: string, needs: NeedsComponent): void {
    this.setComponent(agentId, "needs", needs);
  }

  public setTransform(agentId: string, transform: TransformComponent): void {
    this.setComponent(agentId, "transform", transform);
  }

  public setMovement(agentId: string, movement: MovementComponent): void {
    this.setComponent(agentId, "movement", movement);
  }

  public setCombat(agentId: string, combat: CombatComponent): void {
    this.setComponent(agentId, "combat", combat);
  }

  public setAI(agentId: string, ai: AIComponent): void {
    this.setComponent(agentId, "ai", ai);
  }

  public setInventory(agentId: string, inventory: InventoryComponent): void {
    this.setComponent(agentId, "inventory", inventory);
  }

  public setRole(agentId: string, role: RoleComponent): void {
    this.setComponent(agentId, "role", role);
  }

  public setSocial(agentId: string, social: SocialComponent): void {
    this.setComponent(agentId, "social", social);
  }

  public setProfile(agentId: string, profile: ProfileComponent): void {
    this.setComponent(agentId, "profile", profile);
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Obtiene agentes que tienen un componente específico
   */
  public getAgentsWithComponent(component: ComponentType): string[] {
    const index = this.getIndexForComponent(component);
    return index ? Array.from(index.keys()) : [];
  }

  /**
   * Obtiene agentes en combate (cached)
   */
  public getAgentsInCombat(): string[] {
    if (this.agentsInCombatCache === null) {
      this.agentsInCombatCache = Array.from(this.combatIndex.entries())
        .filter(([, combat]) => combat.isInCombat)
        .map(([id]) => id);
    }
    return this.agentsInCombatCache;
  }

  /**
   * Obtiene agentes en movimiento (cached)
   */
  public getAgentsMoving(): string[] {
    if (this.agentsMovingCache === null) {
      this.agentsMovingCache = Array.from(this.movementIndex.entries())
        .filter(([, movement]) => movement.isMoving)
        .map(([id]) => id);
    }
    return this.agentsMovingCache;
  }

  /**
   * Obtiene agentes con necesidades bajo umbral
   */
  public getAgentsWithLowNeeds(
    needType: keyof NeedsComponent,
    threshold: number,
  ): string[] {
    return Array.from(this.needsIndex.entries())
      .filter(([, needs]) => needs[needType] < threshold)
      .map(([id]) => id);
  }

  /**
   * Obtiene agentes vivos
   */
  public getAliveAgents(): string[] {
    return Array.from(this.healthIndex.entries())
      .filter(([, health]) => !health.isDead)
      .map(([id]) => id);
  }

  /**
   * Obtiene agentes en un área
   */
  public getAgentsInArea(
    centerX: number,
    centerY: number,
    radius: number,
  ): string[] {
    const radiusSq = radius * radius;
    return Array.from(this.transformIndex.entries())
      .filter(([, transform]) => {
        const dx = transform.x - centerX;
        const dy = transform.y - centerY;
        return dx * dx + dy * dy <= radiusSq;
      })
      .map(([id]) => id);
  }

  /**
   * Obtiene agentes en una zona
   */
  public getAgentsInZone(zoneId: string): string[] {
    return Array.from(this.transformIndex.entries())
      .filter(([, transform]) => transform.zoneId === zoneId)
      .map(([id]) => id);
  }

  // ==========================================================================
  // DIRTY TRACKING
  // ==========================================================================

  /**
   * Obtiene componentes modificados desde el último clearDirty
   */
  public getDirtyComponents(agentId: string): Set<ComponentType> | undefined {
    return this.dirtyComponents.get(agentId);
  }

  /**
   * Verifica si un componente está dirty
   */
  public isComponentDirty(agentId: string, component: ComponentType): boolean {
    return this.dirtyComponents.get(agentId)?.has(component) ?? false;
  }

  /**
   * Limpia flags de dirty para un agente
   */
  public clearDirty(agentId: string): void {
    this.dirtyComponents.delete(agentId);
  }

  /**
   * Limpia todos los flags de dirty
   */
  public clearAllDirty(): void {
    this.dirtyComponents.clear();
  }

  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================

  /**
   * Actualiza múltiples componentes de un agente de una vez
   */
  public updateComponents(
    agentId: string,
    updates: Partial<AgentComponents>,
  ): void {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        this.setComponent(agentId, key as ComponentType, value);
      }
    }
  }

  /**
   * Obtiene múltiples componentes de un agente
   */
  public getComponents<K extends ComponentType>(
    agentId: string,
    components: K[],
  ): Pick<AgentComponents, K> | undefined {
    if (!this.entities.has(agentId)) return undefined;

    const result: Partial<AgentComponents> = {};
    for (const component of components) {
      const value = this.getComponent(agentId, component);
      if (value !== undefined) {
        (result as Record<string, unknown>)[component] = value;
      }
    }
    return result as Pick<AgentComponents, K>;
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  /**
   * Exporta todos los datos para snapshot
   */
  public exportAll(): Map<string, Partial<AgentComponents>> {
    return new Map(this.entities);
  }

  /**
   * Importa datos desde snapshot
   */
  public importAll(data: Map<string, Partial<AgentComponents>>): void {
    this.clear();
    for (const [agentId, components] of data) {
      this.registerAgent(agentId, components);
    }
  }

  /**
   * Limpia todo el store
   */
  public clear(): void {
    this.entities.clear();
    this.healthIndex.clear();
    this.needsIndex.clear();
    this.transformIndex.clear();
    this.movementIndex.clear();
    this.combatIndex.clear();
    this.aiIndex.clear();
    this.inventoryIndex.clear();
    this.roleIndex.clear();
    this.socialIndex.clear();
    this.profileIndex.clear();
    this.dirtyComponents.clear();
    this.invalidateCaches();
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  public getStats(): {
    totalAgents: number;
    agentsInCombat: number;
    agentsMoving: number;
    dirtyAgents: number;
  } {
    return {
      totalAgents: this.entities.size,
      agentsInCombat: this.getAgentsInCombat().length,
      agentsMoving: this.getAgentsMoving().length,
      dirtyAgents: this.dirtyComponents.size,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private getIndexForComponent(
    component: ComponentType,
  ): Map<string, unknown> | undefined {
    switch (component) {
      case "health":
        return this.healthIndex as Map<string, unknown>;
      case "needs":
        return this.needsIndex as Map<string, unknown>;
      case "transform":
        return this.transformIndex as Map<string, unknown>;
      case "movement":
        return this.movementIndex as Map<string, unknown>;
      case "combat":
        return this.combatIndex as Map<string, unknown>;
      case "ai":
        return this.aiIndex as Map<string, unknown>;
      case "inventory":
        return this.inventoryIndex as Map<string, unknown>;
      case "role":
        return this.roleIndex as Map<string, unknown>;
      case "social":
        return this.socialIndex as Map<string, unknown>;
      case "profile":
        return this.profileIndex as Map<string, unknown>;
      default:
        return undefined;
    }
  }

  private invalidateCaches(): void {
    this.agentsInCombatCache = null;
    this.agentsMovingCache = null;
  }
}
