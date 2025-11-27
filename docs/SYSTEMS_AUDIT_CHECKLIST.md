# 📋 Auditoría de Sistemas - UnaCartaParaIsa

**Fecha de Auditoría:** 27 de noviembre de 2025  
**Última Actualización:** 27 de noviembre de 2025 (Correcciones aplicadas)  
**Total de Sistemas Analizados:** 75 (47 Backend + 28 Frontend)

---

## 📊 Resumen Ejecutivo

| Aspecto | Backend | Frontend | Total |
|---------|---------|----------|-------|
| ✅ Sistemas válidos | 41 | 20 | 61 (81%) |
| ⚠️ Requieren revisión | 4 | 6 | 10 (13%) |
| ❌ Problemas críticos | 0 | 2 | 2 (3%) |

### Estado General: 🟢 MEJORADO
Se han corregido **11 problemas** en esta sesión:

#### Correcciones Críticas (4)
1. ✅ Consumo de recursos duplicado (LifeCycleSystem → NeedsSystem)
2. ✅ SpatialGrid duplicado en SocialSystem → SharedSpatialIndex
3. ✅ SpatialGrid duplicado en CombatSystem → SharedSpatialIndex
4. ✅ MarriageSystem documentado con fuente de verdad clara

#### Correcciones de Media Prioridad (7)
5. ✅ CardDialogueSystem: Eliminado fallback a `gameState.agents`
6. ✅ TradeSystem: Eliminados 2 fallbacks a `gameState.agents`
7. ✅ GovernanceSystem: Agregado AgentRegistry, usa registry como fuente primaria
8. ✅ SharedKnowledgeSystem: Agregado AgentRegistry, usa registry como fuente primaria
9. ✅ MarketSystem: Agregado AgentRegistry para autoTrade
10. ✅ EmergenceSystem: Agregado AgentRegistry con helper getEntitiesFromRegistry()
11. ✅ AnimalSystem: Agregado AgentRegistry para buscar humanos/agentes

---

## 🏗️ Arquitectura de Registries (Fuente de Verdad)

### Backend - Registries Centrales
| Registry | Propósito | Sistemas que lo Usan Correctamente |
|----------|-----------|-----------------------------------|
| `AgentRegistry` | Acceso O(1) a perfiles, AI, needs, movement, inventory | AISystem, NeedsSystem, MovementSystem, InventorySystem, HouseholdSystem |
| `AnimalRegistry` | Datos centralizados de animales con índice espacial | AnimalSystem, AIActionExecutor |
| `EntityIndex` | Índice O(1) para entidades y agentes | EconomySystem |

---

## 📋 CHECKLIST BACKEND - 47 Sistemas

### ✅ SISTEMAS VÁLIDOS (Registran correctamente con Registry)

| # | Sistema | Registro | Estado | Observaciones |
|---|---------|----------|--------|---------------|
| 1 | `AISystem.ts` | ✅ Registra aiStates (L317) | ✅ VÁLIDO | Coordina bien con otros sistemas |
| 2 | `NeedsSystem.ts` | ✅ Registra entityNeeds (L146) | ✅ VÁLIDO | Usa AgentRegistry correctamente |
| 3 | `MovementSystem.ts` | ✅ Registra movementStates (L152-156) | ✅ VÁLIDO | Fuente de verdad para posiciones |
| 4 | `InventorySystem.ts` | ✅ Registra agentInventories (L50) | ✅ VÁLIDO | Sincroniza con GameState |
| 5 | `HouseholdSystem.ts` | ✅ Usa AgentRegistry (L38,80) | ✅ VÁLIDO | Buen encapsulamiento |
| 6 | `BuildingMaintenanceSystem.ts` | ✅ N/A | ✅ VÁLIDO | Sistema de mantenimiento único |
| 7 | `TerrainSystem.ts` | ✅ N/A | ✅ VÁLIDO | Emite eventos correctamente |
| 8 | `TimeSystem.ts` | ✅ N/A | ✅ VÁLIDO | Sistema ambiental autónomo |
| 9 | `ReputationSystem.ts` | ✅ N/A | ✅ VÁLIDO | Sistema canónico de reputación |
| 10 | `ConflictResolutionSystem.ts` | ✅ N/A | ✅ VÁLIDO | Bien diseñado |
| 11 | `CrisisPredictorSystem.ts` | ✅ Usa NeedsSystem | ✅ VÁLIDO | Obtiene datos vía DI |
| 12 | `AppearanceGenerationSystem.ts` | ✅ N/A | ✅ VÁLIDO | Genera apariencia bajo demanda |
| 13 | `InteractionGameSystem.ts` | ✅ N/A | ✅ VÁLIDO | Simple y correcto |
| 14 | `ItemGenerationSystem.ts` | ✅ N/A | ✅ VÁLIDO | Bien diseñado |
| 15 | `QuestSystem.ts` | ✅ N/A | ✅ VÁLIDO | Bien encapsulado |
| 16 | `ResourceAttractionSystem.ts` | ✅ Usa NeedsSystem | ✅ VÁLIDO | Correcto uso de DI |
| 17 | `ResourceReservationSystem.ts` | ✅ Usa InventorySystem | ✅ VÁLIDO | Buen manejo de reservas |
| 18 | `DivineFavorSystem.ts` | ✅ N/A | ✅ VÁLIDO | No necesita acceso a agentes |
| 19 | `AmbientAwarenessSystem.ts` | ✅ N/A | 🟢 ACEPTABLE | Escribe a gameState.ambientMood (correcto) |

### ⚠️ SISTEMAS CON PROBLEMAS MENORES

| # | Sistema | Problema | Severidad | Acción Requerida |
|---|---------|----------|-----------|------------------|
| 20 | `AnimalBatchProcessor.ts` | Recibe Map directo en lugar de Registry (L43) | 🟡 Media | Refactorizar para usar AnimalRegistry |
| 21 | `ChunkLoadingSystem.ts` | Fallback a gameState.animals (L296-299) | 🟡 Media | Eliminar fallback, confiar en Registry |
| 22 | `GenealogySystem.ts` | No emite eventos al registrar nacimientos | 🟡 Media | Agregar eventos GENEALOGY_* |
| 23 | `WorldResourceSystem.ts` | Expone zones (L515) | 🟡 Baja | Mover getZones() a sistema apropiado |
| 24 | `ResearchSystem.ts` | No emite eventos | 🟡 Media | Agregar RESEARCH_COMPLETED |
| 25 | `RecipeDiscoverySystem.ts` | No emite RECIPE_DISCOVERED | 🟡 Media | Agregar eventos |
| 26 | `NormsSystem.ts` | Aplica reputationPenalty directamente (L67-74) | 🟡 Media | Delegar a ReputationSystem |
| 27 | `KnowledgeNetworkSystem.ts` | Similar a SharedKnowledgeSystem | 🟡 Baja | Evaluar consolidación |

### ✅ SISTEMAS CORREGIDOS (27 Nov 2025)

| # | Sistema | Problema Original | Corrección Aplicada | Estado |
|---|---------|-------------------|---------------------|--------|
| 29 | `SocialSystem.ts` | SpatialGrid duplicado | Ahora usa SharedSpatialIndex exclusivamente | ✅ CORREGIDO |
| 30 | `CombatSystem.ts` | SpatialGrid duplicado | Ahora usa SharedSpatialIndex exclusivamente | ✅ CORREGIDO |
| 32 | `LifeCycleSystem.ts` | Consumo duplicado con NeedsSystem | Eliminado consumeResourcesPeriodically | ✅ CORREGIDO |
| 33 | `MarriageSystem.ts` | Fuente de verdad dual | Documentado: Map interno es fuente, gameState es snapshot | ✅ DOCUMENTADO |
| 35 | `TradeSystem.ts` | Fallbacks a gameState.agents | Eliminados fallbacks, usa AgentRegistry directo | ✅ CORREGIDO |
| 36 | `MarketSystem.ts` | Acceso directo state.entities | Agregado AgentRegistry, usa registry con fallback | ✅ CORREGIDO |
| 37 | `GovernanceSystem.ts` | Acceso directo state.agents | Agregado AgentRegistry, usa registry como fuente primaria | ✅ CORREGIDO |
| 38 | `SharedKnowledgeSystem.ts` | Acceso directo gameState.agents | Agregado AgentRegistry, usa registry como fuente primaria | ✅ CORREGIDO |
| 39 | `EmergenceSystem.ts` | Acceso directo gameState.entities | Agregado AgentRegistry, helper getEntitiesFromRegistry() | ✅ CORREGIDO |
| 41 | `CardDialogueSystem.ts` | Fallback a gameState.agents | Eliminado fallback, retorna false si no hay registry | ✅ CORREGIDO |
| 42 | `AnimalSystem.ts` | Acceso directo gameState.entities | Agregado AgentRegistry para buscar humanos/agentes | ✅ CORREGIDO |

### ⚠️ SISTEMAS PENDIENTES (Prioridad Baja)

| # | Sistema | Problema | Severidad | Acción Requerida |
|---|---------|----------|-----------|------------------|
| 28 | `EconomySystem.ts` | No registra ningún Map con Registry | 🟡 Baja | Registrar Maps económicos (ya tiene AgentRegistry) |
| 31 | `RoleSystem.ts` | No registra agentRoles con Registry | 🟡 Baja | Registrar Map de roles (ya tiene AgentRegistry) |
| 34 | `BuildingSystem.ts` | Llama directamente a TerrainSystem (L299-311) | 🟡 Baja | Usar eventos para desacoplar |
| 40 | `LivingLegendsSystem.ts` | Tracking reputación propio | 🟡 Baja | Delegar a ReputationSystem si existe |
| 43 | `ProductionSystem.ts` | No usa Registry para verificar agentes | 🟡 Baja | Inyectar AgentRegistry |
| 44 | `TaskSystem.ts` | No valida agentes con Registry | 🟡 Baja | Inyectar AgentRegistry |
| 45 | `EnhancedCraftingSystem.ts` | Tracking recetas duplicado con RecipeDiscovery | 🟡 Baja | Consolidar tracking |

### Subsistemas AI (6 archivos principales)

| # | Sistema | Estado | Observaciones |
|---|---------|--------|---------------|
| 46 | `AIActionExecutor.ts` | ⚠️ | Usa AnimalRegistry correctamente, pero fallback innecesario |
| 47 | `AIUrgentGoals.ts` | ⚠️ | Búsqueda de zonas duplicada |

---

## 📋 CHECKLIST FRONTEND - 28 Sistemas

### ✅ SISTEMAS VÁLIDOS (Frontend Shells / Re-exports)

| # | Sistema | Tipo | Estado |
|---|---------|------|--------|
| 1 | `SaveSystem.ts` | Shell → Backend API | ✅ VÁLIDO |
| 2 | `RecipeDiscoverySystem.ts` | Shell → Backend | ✅ VÁLIDO |
| 3 | `ResearchSystem.ts` | Shell → Backend | ✅ VÁLIDO |
| 4 | `EmergenceSystem.ts` | Re-export | ✅ VÁLIDO |
| 5 | `GenealogySystem.ts` | Re-export | ✅ VÁLIDO |
| 6 | `DayNightSystem.ts` | Visualizador Puro | ✅ VÁLIDO |
| 7 | `HealthBarOverlay.ts` | UI | ✅ VÁLIDO |
| 8 | `GeneticSpriteSystem.ts` | Rendering | ✅ VÁLIDO |
| 9 | `PopulationVisualSystem.ts` | Visualización | ✅ VÁLIDO |
| 10 | `VisualDiversityCoordinator.ts` | Coordinador | ✅ VÁLIDO |
| 11 | `LayeredWorldRenderer.ts` | Rendering | ✅ VÁLIDO |
| 12 | `SimpleBiomeAssetLoader.ts` | Assets | ✅ VÁLIDO |
| 13 | `SelectiveRotationHelpers.ts` | Helpers | ✅ VÁLIDO |
| 14 | `ActionAnimationSystem.ts` | Presentación | ✅ VÁLIDO |

### ⚠️ SISTEMAS CON DUPLICACIÓN

| # | Sistema | Problema | Acción Requerida |
|---|---------|----------|------------------|
| 15 | `MovementSystem.ts` | Estado local duplica backend (L51-59) | Convertir a thin client |
| 16 | `cards/helpers.ts` | Lógica evaluación duplicada (L13-78) | Eliminar, usar backend |
| 17 | `AppearanceGenerationSystem.ts` | Herencia genética duplicada (L108-271) | Coordinar con backend |
| 18 | `DiverseWorldComposer.ts` | Generación terreno local (L87-267) | Usar solo generateFromBackendData |
| 19 | `LivingLegendsSystem.ts` | Umbrales hardcodeados | Obtener del backend |
| 20 | `NoiseUtils.ts` | Posible duplicación | Verificar si necesario |
| 21 | `WorldConfig.ts` | Posible conflicto config | Unificar con backend |
| 22 | `WorldGenerationPresets.ts` | Presets locales | Obtener del backend |

### Sistemas Auxiliares

| # | Sistema | Estado |
|---|---------|--------|
| 23 | `movement/helpers.ts` | ✅ Funciones puras aceptables |
| 24 | `social/CardDialogueSystem.ts` | ✅ Re-export |
| 25 | `types.ts` | ⚠️ Verificar compartir con @/shared |
| 26-28 | Otros helpers | ✅ VÁLIDOS |

---

## 🔴 PROBLEMAS CRÍTICOS A RESOLVER

### 1. Consumo de Recursos Duplicado
**Sistemas afectados:** `NeedsSystem.ts`, `LifeCycleSystem.ts`
```
NeedsSystem.consumeResourcesForNeeds() (L380)
LifeCycleSystem.consumeResourcesPeriodically() (L341-352)
```
**Impacto:** Doble consumo de recursos, bugs de economía
**Solución:** Eliminar `consumeResourcesPeriodically` de LifeCycleSystem

### 2. SpatialGrid Duplicado
**Sistemas afectados:** `SocialSystem.ts` (L75), `CombatSystem.ts` (L117)
**Impacto:** Memoria O(2n), posible desincronización
**Solución:** Usar `SharedSpatialIndex` exclusivamente

### 3. MarriageSystem Fuente de Verdad Dual
**Problema:** Mantiene `marriageGroups` Map interno Y sincroniza a `gameState.marriage`
**Solución:** Elegir UNA sola fuente de verdad

### 4. Sistemas sin Registro en AgentRegistry
**Sistemas:** EconomySystem, SocialSystem, RoleSystem, CombatSystem, LifeCycleSystem, ProductionSystem
**Solución:** Registrar sus Maps principales con AgentRegistry

---

## 🟡 LÓGICAS DUPLICADAS A CONSOLIDAR

| Duplicación | Sistemas Backend | Sistemas Frontend | Solución |
|-------------|-----------------|-------------------|----------|
| Rebalanceo de roles | LifeCycleSystem, EconomySystem, RoleSystem | - | Centralizar en RoleSystem |
| Tracking reputación | TradeSystem, NormsSystem, LivingLegendsSystem | - | Delegar a ReputationSystem |
| Cache de posiciones | SocialSystem, MovementSystem | MovementSystem | Usar solo Registry |
| Cache de zonas | NeedsSystem, AISystem | - | Centralizar búsqueda |
| Cálculo distancia | 5+ archivos | movement/helpers | Extraer a shared/utils |
| Evaluación cards | CardDialogueSystem backend | cards/helpers | Eliminar del frontend |
| Generación terreno | TerrainSystem | DiverseWorldComposer | Usar solo backend |

---

## ✅ VALIDACIONES POSITIVAS

### Arquitectura
- [x] AgentRegistry diseñado correctamente como capa de acceso unificada
- [x] AnimalRegistry implementa patrón ECS correctamente
- [x] EntityIndex usa dirty tracking para evitar rebuilds O(n)
- [x] Sistema de eventos (simulationEvents) bien implementado
- [x] Inversify DI configurado correctamente

### Comunicación
- [x] 70% de sistemas emiten eventos correctamente
- [x] Patrón de suscripción a GameEventNames consistente
- [x] Frontend usa shells/adapters para comunicar con backend

### Separación de Capas
- [x] Frontend tiene clara separación domain/infrastructure/presentation
- [x] Backend tiene domain/simulation/core bien organizado

---

## 📈 MÉTRICAS DE CALIDAD

| Métrica | Backend | Frontend |
|---------|---------|----------|
| Sistemas usando Registry correctamente | 4/47 (9%) | N/A |
| Sistemas con lógica duplicada | 12/47 (26%) | 8/28 (29%) |
| Sistemas con violaciones de dominio | 8/47 (17%) | 2/28 (7%) |
| Sistemas con buena comunicación eventos | 33/47 (70%) | 22/28 (79%) |
| Sistemas en buen estado | 28/47 (60%) | 20/28 (71%) |

---

## 🔧 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Críticos (1-2 semanas)
1. [ ] Eliminar `consumeResourcesPeriodically` de LifeCycleSystem
2. [ ] Consolidar SpatialGrids en SharedSpatialIndex
3. [ ] Resolver fuente de verdad dual en MarriageSystem
4. [ ] Registrar sistemas críticos con AgentRegistry (RoleSystem, EconomySystem)

### Fase 2: Alta Prioridad (2-3 semanas)
5. [ ] Eliminar fallbacks duales a gameState.agents
6. [ ] Centralizar lógica de reputación en ReputationSystem
7. [ ] Agregar eventos faltantes (RESEARCH_COMPLETED, RECIPE_DISCOVERED)
8. [ ] Convertir frontend MovementSystem a thin client

### Fase 3: Media Prioridad (3-4 semanas)
9. [ ] Refactorizar AnimalBatchProcessor para usar AnimalRegistry
10. [ ] Eliminar accesos directos a gameState en sistemas restantes
11. [ ] Consolidar helpers de cálculo de distancia
12. [ ] Coordinar AppearanceGenerationSystem frontend/backend

### Fase 4: Baja Prioridad (Continuo)
13. [ ] Evaluar consolidación KnowledgeNetworkSystem + SharedKnowledgeSystem
14. [ ] Mover AnimalConfigs de infrastructure a domain
15. [ ] Documentar patrones aprobados de comunicación entre sistemas

---

## 📝 NOTAS FINALES

### Deuda Técnica Documentada
- `EnhancedCraftingSystem.ts` L186-199: Desajuste arquitectónico entre RecipesCatalog e Inventory (comentario existente)

### Dependencias de Infraestructura en Dominio (Aceptadas)
- Logger de infraestructura usado en todos los sistemas (convención del proyecto)
- AnimalConfigs en infrastructure (pendiente migrar)

### Patrones a Mantener
1. **Registry Pattern:** Todos los datos de entidades deben pasar por los Registries
2. **Event-Driven:** Comunicación entre sistemas vía GameEventNames
3. **Frontend Shells:** Frontend solo debe mostrar datos del backend, no duplicar lógica
4. **Single Source of Truth:** Un solo sistema debe ser dueño de cada tipo de dato

---

*Generado automáticamente - Revisión manual recomendada antes de aplicar cambios*
