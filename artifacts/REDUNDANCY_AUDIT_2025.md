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

## 🔧 Acciones Recomendadas

### ✅ Completadas (4 de diciembre 2025)
1. [x] Eliminar `SpatialGrid.ts` wrapper → imports actualizados a `OptimizedSpatialGrid`
2. [x] Deprecar `EventBus.ts` con JSDoc warning
3. [x] Reemplazar console.log/warn por logger en `ChunkWorkerPool` y `defaultState`
4. [x] Centralizar carga de TensorFlow en `GPUComputeService.getTensorFlowModule()`

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
