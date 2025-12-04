# Auditoría de Redundancias y Código Muerto
**Fecha**: 4 de diciembre de 2025  
**Scope**: UnaCartaParaIsaBackend

---

## 📋 Resumen Ejecutivo

| Categoría | Cantidad | Impacto |
|-----------|----------|---------|
| Archivos redundantes | 3 | Medio |
| Sistemas con solapamiento | 4 | Alto |
| Código deprecado activo | 8+ | Bajo |
| Enums/constantes duplicados | 2 | Bajo |
| Console.log en producción | 5+ | Bajo |

---

## 🔴 Alta Prioridad - Redundancias Críticas

### 1. SpatialGrid vs OptimizedSpatialGrid
**Ubicación**: `src/shared/utils/`
- `SpatialGrid.ts` es un wrapper vacío de `OptimizedSpatialGrid.ts`
- Solo extiende sin agregar funcionalidad

**Recomendación**: Eliminar `SpatialGrid.ts` y usar directamente `OptimizedSpatialGrid`
```typescript
// SpatialGrid.ts - TODO: DEPRECAR
export class SpatialGrid<T = string> extends OptimizedSpatialGrid<T> {
  // Sin lógica adicional
}
```

**Archivos afectados**:
- `src/domain/simulation/core/SharedSpatialIndex.ts` → cambiar import
- `src/domain/simulation/systems/world/WorldResourceSystem.ts` → cambiar import

---

### 2. Sistema de Eventos Dual (EventBus vs simulationEvents)
**Ubicación**: `src/domain/simulation/core/`

| Archivo | Uso |
|---------|-----|
| `EventBus.ts` | 1 import (AISystem) |
| `events.ts` + `BatchedEventEmitter.ts` | 30+ imports |

**Problema**: Dos sistemas de eventos con tipado diferente:
- `EventBus.ts`: Usa `SystemEvents` interface (tipado fuerte)
- `events.ts`: Usa `GameEventType` enum + `BatchedEventEmitter`

**Recomendación**: Consolidar en un solo sistema. El `EventBus` con tipado fuerte es mejor para type-safety, pero requiere migración de todos los sistemas.

**Opción rápida**: Deprecar `EventBus.ts` y mantener `simulationEvents` con mejoras de tipado.

---

### 3. ReputationSystem vs SocialSystem (Solapamiento Trust/Affinity)
**Ubicación**: `src/domain/simulation/systems/social/`

| Concepto | ReputationSystem | SocialSystem |
|----------|------------------|--------------|
| Trust (0-1) | `getTrust()`, `updateTrust()` | N/A |
| Affinity (-1 a 1) | N/A | `getAffinityBetween()` |
| Conversión | `affinityToTrust()` | N/A |

**Problema**: Conceptos similares (trust/affinity) manejados por sistemas separados con conversiones manuales.

**Recomendación**: 
1. Unificar en un solo concepto (preferiblemente affinity)
2. `ReputationSystem` debería delegarpletamente a `SocialSystem` o fusionarse

---

### 4. NoiseUtils Duplicado (Frontend/Backend)
**Ubicaciones**:
- Backend: `src/shared/utils/NoiseUtils.ts`
- Frontend: `src/domain/systems/world/NoiseUtils.ts`

**Problema**: Implementaciones independientes del mismo algoritmo Perlin.

**Recomendación**: Crear paquete compartido o sincronizar via build script.

---

## 🟡 Media Prioridad - Código Deprecado

### Métodos @deprecated sin plan de eliminación

**ClientInventorySystem** (Frontend):
```typescript
// Todos estos métodos ya no mutan estado, solo logean warnings
addToAgent()          → usar requestAddToAgent
removeFromAgent()     → usar requestRemoveFromAgent  
transferToStockpile() → usar requestTransferToStockpile
createStockpile()     → usar requestCreateStockpile
```

**ClientGenealogySystem** (Frontend):
```typescript
handleBirth()         // Backend handles
handleDeath()         // Backend handles
inheritTraits()       // Backend handles
updateLifeStage()     // Backend handles
```

**GatherHandler** (Backend):
```typescript
/** @deprecated Use SystemRegistry.inventory instead */
export interface GatherHandlerDeps { ... }
```

**Recomendación**: Establecer deadline y eliminar en próximo major release.

---

## 🟢 Baja Prioridad - Mejoras de Limpieza

### Console.logs en Producción
```
src/infrastructure/services/chunk/ChunkWorkerPool.ts:137
src/domain/simulation/core/defaultState.ts:114
```

### GPUComputeService + GPUBatchQueryService
Ambos servicios cargan TensorFlow independientemente. `GPUBatchQueryService` tiene su propia lógica de carga lazy (`getTensorFlow()`).

**Recomendación**: Centralizar carga de TensorFlow en `GPUComputeService`.

---

## 🗑️ Archivos Candidatos a Eliminación

| Archivo | Razón | Verificar usos |
|---------|-------|----------------|
| `src/shared/utils/SpatialGrid.ts` | Wrapper sin lógica | 2 imports |
| `src/domain/simulation/core/EventBus.ts` | 1 solo uso, sistema dual | AISystem |

---

## 📊 Enums con Posible Duplicación

### ResourceType vs ItemId (Solapamiento)
```typescript
// ResourceEnums.ts
enum ResourceType {
  WOOD = "wood",
  STONE = "stone",
  IRON_ORE = "iron_ore",
  ...
}

// ItemEnums.ts  
enum ItemId {
  WOOD_LOG = "wood_log",
  STONE = "stone",
  IRON_ORE = "iron_ore",
  ...
}
```

**Análisis**: Los `ResourceType` son tipos abstractos, `ItemId` son items concretos. Es correcto tener ambos pero la nomenclatura puede confundir.

---

---

## 🔴 NUEVAS Redundancias Detectadas (Segunda Auditoría)

### 5. Interface Position Triplicada
**Ubicaciones**:
- `src/shared/types/simulation/worldResources.ts:14`
- `src/shared/types/simulation/unifiedTasks.ts:54`
- `src/shared/types/game-types.ts:77`

Todas son idénticas:
```typescript
export interface Position {
  x: number;
  y: number;
}
```

**Acción**: Consolidar en `game-types.ts` y re-exportar desde otros archivos.

---

### 6. Función distance() Duplicada
**Ubicaciones**:
- `src/domain/simulation/systems/agents/ai/handlers/MoveHandler.ts:38` (exported)
- `src/domain/simulation/systems/agents/ai/detectors/CombatDetector.ts:162` (private)

Diferencia menor:
- MoveHandler: `Math.sqrt(dx * dx + dy * dy)`
- CombatDetector: `Math.hypot(b.x - a.x, b.y - a.y)`

**Acción**: Crear utilidad compartida en `shared/utils/mathUtils.ts`

---

### 7. AISystemConfig Duplicada
**Ubicaciones**:
- `src/domain/simulation/systems/agents/ai/AISystem.ts:75`
- `src/shared/types/simulation/ai.ts:147`

Interfaces con propiedades diferentes pero mismo nombre:
```typescript
// En AISystem.ts
export interface AISystemConfig {
  updateInterval: number;
  priorityBoost: number;
  maxTasksPerAgent: number;
  debug: boolean;
}

// En ai.ts
export interface AISystemConfig {
  decisionIntervalMs: number;
  goalTimeoutMs: number;
  minPriorityThreshold: number;
  batchSize: number;
}
```

**Acción**: Renombrar una como `AISystemRuntimeConfig` o fusionar

---

### 8. Math.random() Directo vs RandomUtils (84 instancias)
**Problema**: `RandomUtils` existe en `src/shared/utils/RandomUtils.ts` pero 84 lugares usan `Math.random()` directamente.

**Ejemplos afectados**:
- `TimeSystem.ts` (4 usos)
- `BuildingSystem.ts` (8 usos)
- `NeedsSystem.ts` (2 usos)
- `MarriageSystem.ts` (3 usos)
- Varios detectors AI (5+ usos)

**Acción**: Migrar gradualmente a `RandomUtils` para permitir seeding y testing determinístico

---

### 9. Mezcla inconsistente de cálculo de distancia
**Problema**: Uso inconsistente de métodos de distancia euclidiana:
- `Math.sqrt(dx * dx + dy * dy)` → 12 instancias
- `Math.hypot(dx, dy)` → 15 instancias

**Afecta**: GPUComputeService, NeedsSystem, MovementSystem, CombatSystem, WorldQueryService

**Acción**: Estandarizar en `Math.hypot()` (más legible, mismo rendimiento en V8)

---

## 🔧 Acciones Recomendadas

### ✅ Completadas (4 de diciembre 2025)
1. [x] Eliminar `SpatialGrid.ts` wrapper → imports actualizados a `OptimizedSpatialGrid`
2. [x] Deprecar `EventBus.ts` con JSDoc warning
3. [x] Reemplazar console.log/warn por logger en `ChunkWorkerPool` y `defaultState`
4. [x] Centralizar carga de TensorFlow en `GPUComputeService.getTensorFlowModule()`

### ✅ Completadas (Segunda Auditoría - 4 de diciembre 2025)
5. [x] **Consolidar Position** → `worldResources.ts` y `unifiedTasks.ts` ahora re-exportan de `game-types.ts`
6. [x] **Crear mathUtils.ts** → `distance()`, `isWithinDistance()`, `clamp()`, `lerp()`, `distanceSquared()`, `normalize()` centralizados
7. [x] **Deprecar distance() duplicada** → `MoveHandler.ts` ahora usa `mathUtils.distance()`, `CombatDetector.ts` eliminó su función local
8. [x] **Renombrar AISystemConfig** → Interface en `ai.ts` renombrada a `LegacyAISystemConfig` con alias deprecado

### 🆕 Nuevas acciones (Segunda auditoría)
1. [ ] **Consolidar Position** → Mover a `game-types.ts`, re-exportar
2. [ ] **Crear mathUtils.ts** → `distance()`, `clamp()`, `lerp()` centralizados
3. [ ] **Renombrar AISystemConfig** → Resolver conflicto de nombres
4. [ ] **Migrar a RandomUtils** → Permitir tests determinísticos
5. [ ] **Estandarizar Math.hypot()** → Consistencia en cálculos de distancia

### Corto plazo (Este mes)
1. [ ] Evaluar fusión ReputationSystem → SocialSystem
2. [ ] Eliminar métodos @deprecated del frontend
3. [ ] Refactorizar handlers AI para usar SystemRegistry en lugar de deps legacy

### Mediano plazo (Q1 2026)
1. [ ] Sincronizar NoiseUtils frontend/backend
2. [ ] Mejorar tipado de eventos con generics
3. [ ] Unificar EventBus con simulationEvents

---

## 📝 Notas Adicionales

- El índice de sistemas (`systems/index.ts`) documenta bien qué se fusionó:
  - InteractionGameSystem → eliminado
  - TradeSystem → fusionado en EconomySystem
  - MarketSystem → fusionado en EconomySystem
  - BuildingMaintenanceSystem → fusionado en BuildingSystem

- La arquitectura de handlers AI usa patrón de dependencias legacy (`GatherHandlerDeps`, etc.) que debería migrar completamente a `SystemRegistry`.
