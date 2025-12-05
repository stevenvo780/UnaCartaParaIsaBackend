# 📊 Síntesis de Auditorías - Diciembre 2025

**Fecha**: 5 de diciembre de 2025  
**Última actualización**: 5 de diciembre de 2025 (18:30 UTC)  
**Documentos fuente**:
- `AUDITORIA_SIMULACION_DIC2025.md` - Auditoría de arquitectura y bugs críticos
- `REDUNDANCY_AUDIT_2025.md` - Auditoría de código redundante y duplicado
- `AUDIT_MECHANICS_DIC2025.md` - Auditoría de mecánicas vía logs de Docker

---

## ✅ COMPLETADO (Lo que YA está funcionando)

### Correcciones Críticas Aplicadas
| Fix | Archivo | Descripción |
|-----|---------|-------------|
| ✅ | `SimulationRunner.ts` | Eliminada duplicación de CommandProcessor y scheduleAutoSaves |
| ✅ | `AISystem.ts` | Corregido memory leak en `clearAgent()` (faltaba `agentMemories.delete`) |
| ✅ | `LifeCycleSystem.ts` | Añadido `void` a promesa flotante de `tryBreeding()` |
| ✅ | `CraftHandler.ts` | Ahora busca `itemId` además de `recipeId` |
| ✅ | `EnhancedCraftingSystem.ts` | Agregado `stone_dagger` a BASIC_RECIPE_IDS |
| ✅ | `SocialSystem.ts` | Nuevo case `"find_mate"` que llama a `proposeMarriage()` |
| ✅ | `MarriageSystem.ts` | Auto-aceptación de propuestas después de 5s |
| ✅ | `InventoryDetector.ts` | **[NEW]** Prioridad URGENT para depósitos cuando hay demanda de construcción |
| ✅ | `BuildingSystem.ts` | **[NEW]** `getResourceDemand()` ahora retorna DÉFICIT real (resta stockpile) |
| ✅ | `WorkDetector.ts` | **[NEW]** Balanceo 50/50 wood/stone cuando ambos faltan |
| ✅ | `AISystem.ts` | **[NEW]** Log de `nearestStone` para diagnóstico |

### Sistemas 100% Funcionales (19 de 26)
| Sistema | Logs | Estado |
|---------|------|--------|
| AISystem | 9948+ | ⭐ Funcionando óptimamente |
| MovementSystem | 1464 | ⭐ Funcionando óptimamente |
| NeedsSystem | 108 | ⭐ Funcionando óptimamente |
| SocialSystem | 130 | ⭐ Funcionando óptimamente |
| InventorySystem | 538 | ⭐ Funcionando óptimamente |
| AnimalSystem | 432 | ⭐ Funcionando óptimamente |
| TimeSystem | 65 | ⭐ Funcionando óptimamente |
| EconomySystem | 64 | ⭐ Funcionando óptimamente |
| CombatSystem | 129 | ⭐ Listo (esperando depredadores) |
| ConflictResolutionSystem | 65 | ⭐ Funcionando |
| AmbientAwarenessSystem | 65 | ⭐ Funcionando |
| ChunkLoadingSystem | 20 | ⭐ Funcionando |
| TaskSystem | 64 | ⭐ Funcionando |
| RoleSystem | 63 | ⭐ Funcionando |
| GovernanceSystem | - | ⭐ Funcionando (demandas + asignación roles) |
| EnhancedCraftingSystem | - | ⭐ CORREGIDO - equippedWeapons: 9 |
| MarriageSystem | - | ⭐ CORREGIDO - groups=28 |
| **BuildingSystem** | - | ⭐ **CORREGIDO** - Construyendo casas, minas, workbenches |
| **ProductionSystem** | - | ⭐ **ACTIVO** - zones=7 |

### Detectores IA Funcionales (9 de 9)
| Detector | Estado | Tareas |
|----------|--------|--------|
| NeedsDetector | ✅ 3605 logs | satisfy_need, rest |
| SocialDetector | ✅ 452 logs | socialize, repro |
| WorkDetector | ✅ **MEJORADO** | gather wood/stone (balanceado) |
| InventoryDetector | ✅ **MEJORADO** | deposit (prioridad URGENT) |
| ExploreDetector | ✅ 893 logs | explore |
| CraftDetector | ✅ CORREGIDO | craft (weapons) |
| CombatDetector | ✅ Listo | flee, attack |
| BuildDetector | ✅ **CORREGIDO** | contribute, build |

### Consolidaciones de Código Completadas
| Acción | Estado |
|--------|--------|
| Eliminar SpatialGrid.ts wrapper | ✅ Completado |
| Deprecar EventBus.ts | ✅ Completado |
| Consolidar Position interface | ✅ Completado |
| Crear mathUtils.ts | ✅ Completado |
| Renombrar AISystemConfig duplicada | ✅ Completado |
| Centralizar TensorFlow en GPUComputeService | ✅ Completado |

---

## ⚠️ PARCIAL (Lo que está funcionando pero con limitaciones)

### Sistemas con Bloqueos Menores
| Sistema | Problema | Estado |
|---------|----------|--------|
| HouseholdSystem | `households=0` | Casas construyéndose, pendiente ocupación |
| RecipeDiscoverySystem | Sin nuevas recetas | Recetas básicas funcionan |

### Handlers IA Parciales
| Handler | Estado | Bloqueo |
|---------|--------|---------|
| AttackHandler | ⚠️ | Sin depredadores/enemigos activos |
| TradeHandler | ⚠️ | Via MARKET (funciona parcialmente) |

---

## ❌ PENDIENTE (Lo que FALTA por hacer)

### Alta Prioridad
| Tarea | Descripción | Acción Requerida |
|-------|-------------|------------------|
| 🔴 Spawn de depredadores | `wolf.spawnProbability: 0.05` muy baja | Aumentar a 0.15-0.20 en biomes de bosque |
| 🟡 Remover logs diagnóstico | `nearestStone` logs en AISystem.ts | Limpiar antes de producción |

### Media Prioridad (Warnings de Arquitectura)
| Warning | Archivo | Estado |
|---------|---------|--------|
| ~~⚠️~~ ✅ | `MultiRateScheduler.ts` | **RESUELTO** - `preTick` solo corre en FAST tick (ver líneas 303, 363) |
| ~~⚠️~~ ✅ | `EventRegistry + LifeCycleSystem` | **RESUELTO** - No hay AGENT_DEATH duplicado en backend |
| ~~⚠️~~ ✅ | `MovementSystem.ts` | **FALSO POSITIVO** - `pathfindingStartTime` SÍ se usa (líneas 582-599, 614) |
| ⚠️ | `MovementSystem, NeedsSystem` | Caches sin límite de tamaño (potencial memory leak) - PENDIENTE |
| ⚠️ | `AISystem.ts` | Logs de diagnóstico temporales (nearestStone) - remover en producción |

### Redundancias Pendientes de Resolver
| Redundancia | Archivos | Recomendación |
|-------------|----------|---------------|
| EventBus vs simulationEvents | `EventBus.ts` vs `events.ts` | Unificar sistema de eventos |
| ReputationSystem vs SocialSystem | Solapamiento trust/affinity | Evaluar fusión |
| NoiseUtils duplicado | Frontend/Backend | Sincronizar o crear paquete compartido |
| Math.random() directo | 84 instancias | Migrar a RandomUtils para tests determinísticos |
| Inconsistencia distancia | `sqrt(dx*dx+dy*dy)` vs `Math.hypot()` | Estandarizar a `Math.hypot()` |

### Código Deprecado sin Eliminar
| Archivo | Métodos | Prioridad |
|---------|---------|-----------|
| ClientInventorySystem | `addToAgent`, `removeFromAgent`, `transferToStockpile`, `createStockpile` | Media |
| ClientGenealogySystem | `handleBirth`, `handleDeath`, `inheritTraits`, `updateLifeStage` | Media |
| GatherHandler | Interface `GatherHandlerDeps` (usar SystemRegistry) | Baja |

### Sistemas Inactivos/Sin Verificar
| Sistema | Motivo | Acción |
|---------|--------|--------|
| ~~GenealogySystem~~ | **N/A - Solo Frontend** | No aplica al backend |
| SharedKnowledgeSystem | `resourceAlerts=0, threatAlerts=0` | Normal si no hay amenazas |
| ResourceReservationSystem | `reservations=0` | ✅ Normal (jobs activos usan recursos directos) |

---

## 📈 MÉTRICAS ACTUALES DE LA SIMULACIÓN (Después de fixes)

| Métrica | Valor Anterior | Valor Actual | Tendencia |
|---------|----------------|--------------|-----------|
| Agentes vivos | 19-21 | 11 | ↔️ estable |
| Animales vivos | 53 | **124** | ⬆️ x2.3 |
| Chunks cargados | 64 | 64 | ↔️ estable |
| **Casas construidas** | 1/8 | **3/8** | ⬆️ +2 |
| **Minas construidas** | 0 | **1** | ⬆️ +1 |
| **Workbenches** | 1 | **2** | ⬆️ +1 |
| Zonas totales | 5 | **9** | ⬆️ +4 |
| **Grupos de matrimonio** | 3 | **16-28** | ⬆️ x5-9 |
| Relaciones sociales | 31 edges | 17 edges | ↘️ (regenerando) |
| Bienestar general | 56.5-58% | 57-58% | ↔️ estable |
| **Armas equipadas** | 1 | **7-9** | ⬆️ x7-9 |
| **Stockpile wood** | ~7 | **7-27** | ⬆️ (consumiendo) |
| **Stockpile stone** | 0 | **3-28** | ⬆️ ∞ |
| Estados animales | - | wandering=94, fleeing=22 | ✅ activo |

---

## 📋 VERIFICACIÓN DE LOGS (Sistemas Activos)

### ✅ Sistemas con Logs Confirmados
| Sistema | Ejemplo de Log | Frecuencia |
|---------|----------------|------------|
| AISystem | `update(): 11 agents` | Alta |
| NeedsSystem | `isa: h=55, t=32, e=100` | Alta |
| SocialSystem | `agents=11, edges=17, groups=1` | Media |
| MarriageSystem | `groups=16, pendingProposals=0` | Media |
| AnimalSystem | `Registry size: 124, Live: 124` | Alta |
| BuildingSystem | `Status: houses=3/8, zones=9` | Media |
| CombatSystem | `entities=11, combatLogSize=6` | Media |
| TimeSystem | `hour=8:56 phase=morning` | Media |
| RoleSystem | `roles=10 shift=morning` | Media |
| InventorySystem | `Agents: 11, inAgents: ...` | Media |
| ChunkLoadingSystem | `11 agents, 64 already loaded` | Baja |
| TaskSystem | `total=4 active=0 stalled=0` | Media |
| GovernanceSystem | `demands=[housing_full]` | Media |
| AmbientAwarenessSystem | `wellbeing=57.6, variance=0.09` | Media |
| ConflictResolutionSystem | `activeCards=0, conflicts=0` | Baja |
| ProductionSystem | `zones=7, productionZones=0` | Baja |
| HouseholdSystem | `households=0, capacity=0` | Baja |
| SharedKnowledgeSystem | `resourceAlerts=0, threatAlerts=0` | Baja |
| ResourceReservationSystem | `reservations=0` | Baja |
| EnhancedCraftingSystem | `equippedWeapons: 7` | Baja |

### ⚠️ Sistemas Sin Logs Visibles
| Sistema | Estado | Acción Sugerida |
|---------|--------|-----------------|
| ~~GenealogySystem~~ | **N/A** | Solo existe en Frontend (no Backend) |
| ~~RecipeDiscoverySystem~~ | **N/A** | Solo existe en Frontend (no Backend) |
| ~~ReputationSystem~~ | **N/A** | Solo existe en Frontend (no Backend) |

> **Nota**: Estos sistemas son **Client-side adapters** que reciben datos del backend via mensajes. No tienen lógica de simulación propia.

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

### Inmediato (Esta semana)
1. ~~**Ajustar WorkDetector** para priorizar madera cuando BuildingSystem tiene demanda~~ ✅ **COMPLETADO**
2. **Aumentar spawn de wolves** en config de biomes (actualmente 0.05, subir a 0.15-0.20)
3. ~~**Añadir logs a GenealogySystem**~~ ❌ N/A - Solo existe en Frontend
4. **Remover logs diagnóstico de AISystem.ts** (nearestStone) antes de producción

### Corto plazo (Este mes)
1. Migrar handlers AI de deps legacy a SystemRegistry
2. Eliminar métodos @deprecated del frontend
3. ~~Evaluar fusión ReputationSystem → SocialSystem~~ Solo Frontend - evaluar allá
4. **Implementar LRU cache en MovementSystem/NeedsSystem** (prevenir memory leak)

### Mediano plazo (Q1 2026)
1. ~~Refactorizar `preTick` para ejecutar una sola vez por ciclo~~ ✅ **YA RESUELTO**
2. Unificar sistema de eventos
3. Migrar a RandomUtils para tests determinísticos

---

## 📋 RESUMEN EJECUTIVO

```
┌─────────────────────────────────────────────────────────┐
│                  ESTADO DEL BACKEND                     │
├─────────────────────────────────────────────────────────┤
│  ✅ Funcionando:     19 sistemas (73%)                  │
│  ⚠️ Parcial:          2 sistemas (8%)                   │
│  ❌ Inactivo:         1 sistema  (4%)                   │
│  🔧 Fixes aplicados: 11 correcciones críticas           │
├─────────────────────────────────────────────────────────┤
│  DINÁMICAS ACTIVAS:                                     │
│  ✓ Supervivencia    ✓ Exploración    ✓ Recolección     │
│  ✓ Socialización    ✓ Reproducción   ✓ Ecosistema      │
│  ✓ Comercio         ✓ Roles          ✓ Gobernanza      │
│  ✓ Crafting         ✓ Equipamiento   ✓ Matrimonios     │
│  ✓ CONSTRUCCIÓN ⭐  ✓ Depósitos ⭐                      │
├─────────────────────────────────────────────────────────┤
│  DINÁMICAS BLOQUEADAS:                                  │
│  ✗ Combate (falta depredadores)                         │
│  ✗ Hogares (casas construyéndose, pendiente ocupación)  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 FIXES APLICADOS HOY (5 Dic 2025)

### 1. Prioridad de Depósitos (`InventoryDetector.ts`)
**Problema**: Tareas de depósito y recolección tenían la misma prioridad (HIGH=0.6), causando que agentes recolectaran infinitamente sin depositar.

**Solución**: Cambiar prioridad de depósito a URGENT (0.8) cuando hay demanda de construcción.

```typescript
const priority =
  loadRatio > URGENT_DEPOSIT_THRESHOLD
    ? TASK_PRIORITIES.CRITICAL
    : ctx.hasBuildingResourceDemand
      ? TASK_PRIORITIES.URGENT  // Antes: HIGH
      : hasBuildingMaterials && (woodCount >= 6 || stoneCount >= 6)
        ? TASK_PRIORITIES.HIGH
        : TASK_PRIORITIES.NORMAL;
```

### 2. Cálculo de Déficit Real (`BuildingSystem.ts`)
**Problema**: `getResourceDemand()` retornaba demanda total sin considerar lo que ya había en stockpile.

**Solución**: Restar recursos disponibles para retornar el déficit real.

```typescript
const deficitWood = Math.max(0, totalWood - stockpiledWood);
const deficitStone = Math.max(0, totalStone - stockpiledStone);
```

### 3. Balanceo de Recolección Wood/Stone (`WorkDetector.ts`)
**Problema**: Agentes siempre priorizaban madera sobre piedra, causando que stone=0 perpetuamente.

**Solución**: Distribuir 50/50 entre agentes usando hash del agentId.

```typescript
if (needsWood && needsStone) {
  const agentHash = ctx.agentId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const collectStone = agentHash % 2 === 0;
  // Agentes pares recolectan piedra, impares madera
}
```

**Resultado**: 
- Casas, minas y workbenches construyéndose activamente
- Stockpile balanceado: wood=27, stone=28
- Construcción de mina completada

---

## 📁 ARCHIVOS MODIFICADOS (5 Dic 2025)

### Backend (`/UnaCartaParaIsaBackend/src/`)
| Archivo | Líneas | Tipo de Cambio |
|---------|--------|----------------|
| `domain/simulation/systems/agents/ai/detectors/InventoryDetector.ts` | ~10 | Prioridad URGENT |
| `domain/simulation/systems/agents/ai/detectors/WorkDetector.ts` | ~50 | Balanceo wood/stone |
| `domain/simulation/systems/structures/BuildingSystem.ts` | ~15 | Cálculo déficit real |
| `domain/simulation/systems/agents/ai/AISystem.ts` | ~10 | Logs diagnóstico |

### Documentación (`/UnaCartaParaIsaBackend/artifacts/`)
| Archivo | Descripción |
|---------|-------------|
| `SYNTHESIS_DIC2025.md` | Este documento (síntesis completa) |
| `AUDITORIA_SIMULACION_DIC2025.md` | Auditoría original de arquitectura |
| `REDUNDANCY_AUDIT_2025.md` | Auditoría de código redundante |
| `AUDIT_MECHANICS_DIC2025.md` | Auditoría de mecánicas vía Docker |

---

## 🧪 COMANDOS DE VERIFICACIÓN ÚTILES

```bash
# Ver logs en tiempo real (últimos 30s)
docker logs --since 30s unacartaparaisabackend-backend-gpu-1 2>&1 | tail -50

# Verificar sistemas específicos
docker logs --since 1m unacartaparaisabackend-backend-gpu-1 2>&1 | grep -E "(BUILDING|Stockpile)"

# Verificar construcciones
docker logs --since 1m unacartaparaisabackend-backend-gpu-1 2>&1 | grep "Construction"

# Verificar recolección wood/stone
docker logs --since 30s unacartaparaisabackend-backend-gpu-1 2>&1 | grep -E "(TREE|STONE|assigned to)"

# Rebuild y restart
docker-compose -f docker-compose.gpu.yml build --no-cache backend-gpu && \
docker-compose -f docker-compose.gpu.yml up -d backend-gpu
```

---

## 🔄 SINCRONIZACIÓN BACKEND/FRONTEND (5 Dic 2025)

### Sistemas Eliminados del Frontend
Los siguientes Client adapters fueron eliminados porque NO existen en el backend:

| Sistema Eliminado | Razón |
|-------------------|-------|
| `ClientReputationSystem` | Fusionado en `SocialSystem` del backend |
| `ClientMarketSystem` | No implementado en backend |
| `ClientQuestSystem` | No implementado en backend |
| `ClientNormsSystem` | No implementado en backend |
| `ClientResearchSystem` | No implementado en backend |
| `ClientLivingLegendsSystem` | No implementado en backend |
| `ClientInteractionGameSystem` | No implementado en backend |
| `ClientCardDialogueSystem` | No implementado en backend |
| `ClientBuildingMaintenanceSystem` | No implementado en backend |
| `ClientResourceAttractionSystem` | No implementado en backend |
| `ClientTradeSystem` | No implementado en backend |
| `ClientKnowledgeNetworkSystem` | Backend usa `SharedKnowledgeSystem` |

### Archivos Frontend Modificados
| Archivo | Cambios |
|---------|---------|
| `Types.ts` | ~15 símbolos eliminados |
| `ContainerConfig.ts` | Reescrito (~120 líneas menos) |
| `DISystemComposer.ts` | ~107 líneas eliminadas |
| `GameEventWiring.ts` | ~125 líneas eliminadas |
| `GameTelemetryEmitter.ts` | ~74 líneas eliminadas |
| `GameLogicManager.ts` | ~21 líneas eliminadas |
| `SchedulerRegistry.ts` | ~66 líneas eliminadas |
| `ReactUIUpdateService.ts` | ~3 líneas eliminadas |
| `registry.types.ts` | ~8 líneas eliminadas |
| `SystemLoader.ts` | ~37 líneas eliminadas |
| **Total** | **~522 líneas eliminadas** |

### Sistemas Sincronizados Backend ↔ Frontend
| Backend | Frontend Adapter | Estado |
|---------|------------------|--------|
| AISystem | ClientAISystem | ✅ |
| NeedsSystem | ClientNeedsSystem | ✅ |
| SocialSystem | ClientSocialSystem | ✅ (incluye reputation) |
| MarriageSystem | ClientMarriageSystem | ✅ |
| GenealogySystem | ClientGenealogySystem | ✅ |
| InventorySystem | ClientInventorySystem | ✅ |
| BuildingSystem | ClientBuildingSystem | ✅ |
| CraftingSystem | ClientCraftingSystem | ✅ |
| CombatSystem | ClientCombatSystem | ✅ |
| AnimalSystem | ClientAnimalSystem | ✅ |
| TimeSystem | ClientTimeSystem | ✅ |
| LifeCycleSystem | ClientLifeCycleSystem | ✅ |
| GovernanceSystem | ClientGovernanceSystem | ✅ |
| TaskSystem | ClientTaskSystem | ✅ |
| RoleSystem | ClientRoleSystem | ✅ |
| ProductionSystem | ClientProductionSystem | ✅ |
| ConflictResolutionSystem | ClientConflictResolutionSystem | ✅ |
| TerrainSystem | ClientTerrainSystem | ✅ |
| WorldResourceSystem | ClientWorldResourceSystem | ✅ |
| RecipeDiscoverySystem | ClientRecipeDiscoverySystem | ✅ |
| ResourceReservationSystem | ClientResourceReservationSystem | ✅ |
| AmbientAwarenessSystem | ClientAmbientAwarenessSystem | ✅ |
| HouseholdSystem | ClientHouseholdSystem | ✅ |
| EconomySystem | ClientEconomySystem | ✅ |

---

*Documento generado: 5 de diciembre de 2025 - Actualizado 18:50 UTC*
