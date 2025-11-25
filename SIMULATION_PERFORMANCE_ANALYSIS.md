# 🔍 Análisis de Rendimiento de Simulación y Hoja de Ruta

**Estado Actual:** 25 de Noviembre de 2024
**Documento Base:** `artifacts/PERFORMANCE_AUDIT_2024-11-24.md`

Este documento consolida el estado real de las optimizaciones, eliminando redundancias y clarificando qué está implementado y qué falta.

---

## 📊 Estado de Optimizaciones (Realidad vs Plan)

| Componente | Estado | Impacto | Notas |
|------------|--------|---------|-------|
| **MultiRateScheduler** | ✅ **IMPLEMENTADO** | Alto | Divide sistemas en FAST/MEDIUM/SLOW. Funcionando correctamente en `SimulationRunner`. |
| **DeltaEncoder** | ✅ **IMPLEMENTADO** | Crítico | Usa `Map` para lookups O(1). Optimización confirmada en código. |
| **EntityIndex** | ✅ **IMPLEMENTADO** | Crítico | Sincronización `syncAgentsToEntities` optimizada con O(1). |
| **NeedsSystem** | ❌ **PENDIENTE** | Alto | **Discrepancia detectada:** El código sigue usando `filter` O(N) espacial en `applySocialMoraleBoost`. No usa `SharedSpatialIndex`. |
| **AISystem** | ⚠️ **PARCIAL** | Medio | Usa `EntityIndex` en algunos lugares, pero mantiene fallbacks y lógica dispersa. |
| **TerrainRenderer** | ✅ **IMPLEMENTADO** | Medio | (Frontend) Batching de gráficos implementado. |

---

## 🛑 Problemas Críticos Pendientes

### 1. NeedsSystem: Búsqueda Espacial O(N²)
El sistema de necesidades itera sobre todas las entidades para calcular bonificaciones sociales.
- **Ubicación:** `src/domain/simulation/systems/NeedsSystem.ts` (método `applySocialMoraleBoost`)
- **Problema:** `this.gameState.entities.filter(...)` se ejecuta por cada entidad.
- **Solución:** Inyectar `SharedSpatialIndex` y usar `queryRadius`.

### 2. AISystem: Uso Incompleto de EntityIndex
Aunque se inyecta `EntityIndex`, todavía hay lógica que depende de iteraciones o no aprovecha completamente el índice para todas las consultas de estado.

---

## 📅 Hoja de Ruta de Optimización (Fases Actualizadas)

### Fase 1: Corrección de "Falsos Positivos" (Inmediato)
> Completar optimizaciones que se marcaron como listas pero no lo están.

- [ ] **NeedsSystem**: Implementar `SharedSpatialIndex` para búsquedas espaciales.
  - Inyectar `SharedSpatialIndex` en `NeedsSystem`.
  - Reemplazar `filter` en `applySocialMoraleBoost` con `sharedSpatialIndex.queryRadius`.
- [ ] **NeedsSystem**: Optimizar `findZonesNearPosition` usando un índice espacial de zonas o Grid (actualmente itera todas las zonas).

### Fase 2: Profundización (Próximos pasos)
> Optimizaciones de alto impacto restantes.

- [ ] **MovementSystem**: Eliminar creación de objetos temporales (spread operator `{...pos}`) en el hot loop.
- [ ] **AISystem**: Eliminar todos los `.find()` restantes y usar `EntityIndex` exclusivamente.
- [ ] **SimulationClient** (Frontend): Mover `JSON.parse` a un Web Worker para evitar bloquear el main thread al recibir snapshots grandes.

### Fase 3: Micro-optimizaciones y Limpieza
- [ ] **EntityManager** (Frontend): Cachear arrays en lugar de generar nuevos en cada frame.
- [ ] **SharedSpatialIndex**: Implementar Object Pooling para evitar GC pressure en la reconstrucción del índice.

---

## 📉 Métricas Esperadas Post-Optimización
- **Tick Time (Backend):** < 10ms (promedio)
- **FPS (Frontend):** > 55 estable
- **Uso de CPU:** Reducción del 30% en carga base.
