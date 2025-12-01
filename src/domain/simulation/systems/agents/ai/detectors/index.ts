/**
 * @fileoverview Exportaciones de Detectores
 *
 * Los detectores observan el estado del agente y generan tareas.
 * Cada detector es una función pura: (DetectorContext) => Task[]
 *
 * @module domain/simulation/systems/agents/ai/detectors
 */

export { detectNeeds } from "./NeedsDetector";
export { detectCombat } from "./CombatDetector";
export { detectWork } from "./WorkDetector";
export { detectInventory } from "./InventoryDetector";
export { detectCraft } from "./CraftDetector";
export { detectBuild } from "./BuildDetector";
export { detectSocial } from "./SocialDetector";
export { detectExplore } from "./ExploreDetector";
export { detectTrade } from "./TradeDetector";

import type { Task, DetectorContext } from "../types";
import { detectNeeds } from "./NeedsDetector";
import { detectCombat } from "./CombatDetector";
import { detectWork } from "./WorkDetector";
import { detectInventory } from "./InventoryDetector";
import { detectCraft } from "./CraftDetector";
import { detectBuild } from "./BuildDetector";
import { detectSocial } from "./SocialDetector";
import { detectExplore } from "./ExploreDetector";
import { detectTrade } from "./TradeDetector";

/**
 * Tipo de función detector
 */
export type Detector = (ctx: DetectorContext) => Task[];

/**
 * Lista ordenada de todos los detectores
 *
 * El orden importa:
 * 1. Combate (supervivencia inmediata)
 * 2. Necesidades biológicas
 * 3. Inventario (para no perder recursos)
 * 4. Trabajo
 * 5. Crafteo
 * 6. Construcción
 * 7. Social
 * 8. Comercio
 * 9. Exploración
 */
export const ALL_DETECTORS: Detector[] = [
  detectCombat,
  detectNeeds,
  detectInventory,
  detectWork,
  detectCraft,
  detectBuild,
  detectSocial,
  detectTrade,
  detectExplore,
];

/**
 * Ejecuta todos los detectores y retorna todas las tareas generadas
 */
export function runAllDetectors(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];

  for (const detector of ALL_DETECTORS) {
    const detected = detector(ctx);
    tasks.push(...detected);
  }

  return tasks;
}

/**
 * Ejecuta detectores específicos
 */
export function runDetectors(
  ctx: DetectorContext,
  detectors: Detector[],
): Task[] {
  const tasks: Task[] = [];

  for (const detector of detectors) {
    const detected = detector(ctx);
    tasks.push(...detected);
  }

  return tasks;
}
