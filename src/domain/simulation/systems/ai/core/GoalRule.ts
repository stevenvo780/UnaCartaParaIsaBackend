/**
 * GoalRule - Sistema declarativo de evaluación de goals
 *
 * Reemplaza 18 evaluadores separados con reglas configurables.
 * Cada regla define: cuándo aplicar, cómo calcular prioridad, qué goal generar.
 */

import type { AIState, AIGoal } from "../../../../types/simulation/ai";
import type { EntityNeedsData } from "../../../../types/simulation/needs";
import { GoalType } from "../../../../../shared/constants/AIEnums";
import type { GameState } from "../../../../types/game-types";
import type { Inventory } from "../../../../types/simulation/economy";





/**
 * Contexto unificado para todas las reglas.
 * Un solo objeto en lugar de 18 interfaces *Deps diferentes.
 */
export interface GoalContext {
  entityId: string;
  aiState: AIState;
  now: number;


  needs?: EntityNeedsData;
  inventory?: Inventory;
  position?: { x: number; y: number };
  roleType?: string;
  stats?: Record<string, number> | null;


  gameState?: GameState;


  enemies?: string[];
  nearbyPredators?: Array<{ id: string; position: { x: number; y: number } }>;
  isWarrior?: boolean;
  combatStrategy?: "peaceful" | "tit_for_tat" | "bully";


  buildTasks?: Array<{
    id: string;
    zoneId: string;
    score: number;
  }>;


  inventoryLoad?: number;
  inventoryCapacity?: number;
  hasWater?: boolean;
  hasFood?: boolean;
  depositZoneId?: string;


  equippedWeapon?: string;
  canCraftClub?: boolean;
  canCraftDagger?: boolean;
  craftZoneId?: string;
  hasAvailableWeapons?: boolean;


  nearbyAgentInNeed?: {
    id: string;
    need: "water" | "food" | "medical" | "rest" | "social";
    distance: number;
    targetZoneId?: string;
  };


  hasExcessResources?: boolean;
  nearestMarketZoneId?: string;


  preferredResource?: string;
  nearestPreferredResource?: { id: string; x: number; y: number };
  roleEfficiency?: number;


  nearbyInspectable?: { id: string; position: { x: number; y: number } };


  activeQuestGoal?: {
    questId: string;
    objectiveId: string;
    goalType: string;
    targetZoneId?: string;
  };


  contributableBuilding?: {
    zoneId: string;
    score: number;
  };


  findNearestResource?: (
    entityId: string,
    resourceType: string,
  ) => { id: string; x: number; y: number } | null;
  findNearbyAgent?: (
    entityId: string,
  ) => { id: string; x: number; y: number } | null;
  findPotentialMate?: (
    entityId: string,
  ) => { id: string; x: number; y: number } | null;
  getEntityPosition?: (id: string) => { x: number; y: number } | null;
  getEntityStats?: (id: string) => Record<string, number> | null;
}

/**
 * Una regla de goal define cuándo y cómo generar un goal.
 */
export interface GoalRule {
  /** Identificador único de la regla */
  id: string;

  /** Tipo de goal que genera */
  goalType: GoalType;

  /** Categoría para agrupación (biological, social, work, combat, etc) */
  category:
    | "biological"
    | "social"
    | "cognitive"
    | "work"
    | "combat"
    | "exploration";

  /**
   * Condición para activar la regla.
   * Retorna true si la regla aplica al contexto actual.
   */
  condition: (ctx: GoalContext) => boolean;

  /**
   * Calcula la prioridad del goal (0.0 - 1.0).
   * Solo se llama si condition() retorna true.
   */
  priority: (ctx: GoalContext) => number;

  /**
   * Prioridad mínima para generar el goal.
   * Si priority() < minPriority, no se genera goal.
   */
  minPriority?: number;

  /**
   * Genera datos adicionales para el goal.
   * Opcional - para targetX, targetY, metadata, etc.
   */
  getData?: (ctx: GoalContext) => Partial<AIGoal>;

  /**
   * Si true, este goal es crítico y debe retornarse inmediatamente
   * sin evaluar otras reglas. Ej: supervivencia crítica.
   */
  isCritical?: boolean;
}





/**
 * Calcula utilidad para needs biológicos.
 * Umbral de 40: arriba de 40 el agente trabaja, debajo prioriza necesidades.
 */
export function needUtility(value: number | undefined, threshold = 40): number {
  if (value === undefined || value >= threshold) return 0;
  return (threshold - value) / threshold;
}

/**
 * Calcula utilidad para needs sociales (umbral más alto).
 */
export function socialNeedUtility(value: number | undefined): number {
  if (value === undefined || value > 70) return 0;
  return Math.min(1.0, (70 - value) / 70);
}

/**
 * Multiplica prioridad por factor de personalidad.
 */
export function personalityFactor(
  aiState: AIState,
  trait: keyof AIState["personality"],
  base: number,
  bonus: number,
): number {
  const traitValue = aiState.personality[trait];
  if (typeof traitValue === "number") {
    return base + traitValue * bonus;
  }
  return base;
}





/**
 * Evalúa todas las reglas contra el contexto y retorna goals ordenados por prioridad.
 *
 * @param rules - Array de reglas a evaluar
 * @param ctx - Contexto del agente
 * @param maxGoals - Máximo de goals a retornar (default: 5)
 */
export function evaluateRules(
  rules: GoalRule[],
  ctx: GoalContext,
  maxGoals = 5,
): AIGoal[] {
  const goals: AIGoal[] = [];

  for (const rule of rules) {

    if (!rule.condition(ctx)) continue;


    const priority = rule.priority(ctx);
    const minPriority = rule.minPriority ?? 0;

    if (priority < minPriority) continue;


    const goal: AIGoal = {
      id: `${rule.id}_${ctx.entityId}_${ctx.now}`,
      type: rule.goalType,
      priority,
      createdAt: ctx.now,
      expiresAt: ctx.now + 30000,
      ...rule.getData?.(ctx),
    };

    goals.push(goal);


    if (rule.isCritical && priority > 0.9) {
      return [goal];
    }
  }


  goals.sort((a, b) => b.priority - a.priority);

  return goals.slice(0, maxGoals);
}
