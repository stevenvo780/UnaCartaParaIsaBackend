# Plan de Simplificación de Sistemas

## Estado Actual: ~~31~~ → 28 Sistemas Principales

Tras el análisis, hay oportunidades claras de consolidación y eliminación.

**Progreso:**
- ✅ InteractionGameSystem: ELIMINADO
- ✅ LivingLegendsSystem: ELIMINADO  
- ✅ BuildingMaintenanceSystem: FUSIONADO en BuildingSystem
- 🔄 SharedKnowledgeSystem: Pendiente (reclasificar como infraestructura)
- 🔄 RecipeDiscoverySystem: Pendiente (complejo, fusión opcional)
- 🔄 ItemGenerationSystem + ProductionSystem: Pendiente (complejo)
- 🔄 QuestSystem + TaskSystem: Pendiente
- 🔄 GenealogySystem: Pendiente (pequeño, mantener separado)
- 🔄 MarriageSystem + HouseholdSystem: Pendiente

---

## 🔴 SISTEMAS ELIMINADOS ✅

### 1. **InteractionGameSystem** (95 líneas) → ✅ ELIMINADO
- **Uso**: Solo en `CommandProcessor` para `startInteraction`
- **Razón**: Funcionalidad mínima (mini-juegos no implementados)
- **Estado**: ✅ Eliminado completamente

### 2. **LivingLegendsSystem** (256 líneas) → ✅ ELIMINADO
- **Uso**: Solo en `SnapshotManager` para mostrar leyendas
- **Razón**: Feature decorativa, no afecta simulación
- **Estado**: ✅ Eliminado, snapshot devuelve datos vacíos

### 3. **BuildingMaintenanceSystem** (270 líneas) → ✅ FUSIONADO en BuildingSystem
- **Similitud**: Mantenimiento es parte del ciclo de vida de edificios
- **Estado**: ✅ Fusionado en BuildingSystem

---

## 🟠 SISTEMAS PENDIENTES DE FUSIONAR

### 4. **SharedKnowledgeSystem** (343 líneas) → Reclasificar como infraestructura
- **Uso**: Solo en `AIContextAdapter` para alertas
- **Decisión**: Mantener como módulo interno de AI, no fusionar
- **Impacto**: Bajo

### 5. **RecipeDiscoverySystem** (350 líneas) → **EnhancedCraftingSystem**
- **Similitud**: Ambos manejan recetas y conocimiento de crafting
- **Complejidad**: Alta (700+ líneas combinadas)
- **Estado**: Pendiente (opcional)

### 6. **ItemGenerationSystem** (362 líneas) + **ProductionSystem** (312 líneas) → **WorldResourceSystem**
- **Similitud**: Ambos generan recursos en el mundo
- **Complejidad**: Alta (1471 líneas combinadas)
- **Estado**: Pendiente (opcional)

### 7. **QuestSystem** (570 líneas) + **TaskSystem** (589 líneas) → **ObjectivesSystem**
- **Similitud**: Ambos manejan "cosas a hacer" con progreso
- **Complejidad**: Alta (1159 líneas combinadas)
- **Estado**: Pendiente

### 8. **GenealogySystem** (217 líneas) → **SocialSystem**
- **Similitud**: Genealogía es un tipo de relación social
- **Decisión**: Mantener separado (pequeño, bien definido)
- **Estado**: No fusionar

### 9. **MarriageSystem** (457 líneas) + **HouseholdSystem** (390 líneas) → **FamilySystem**
- **Similitud**: Ambos manejan unidades familiares
- **Complejidad**: Media (847 líneas combinadas)
- **Estado**: Pendiente

---

## 🟡 SISTEMAS A RECLASIFICAR (Infraestructura vs Simulación)

### Mover a `core/` (No son "sistemas de simulación"):

| Sistema | Líneas | Razón |
|---------|--------|-------|
| **TimeSystem** | 494 | Es infraestructura (reloj del juego) |
| **ChunkLoadingSystem** | 283 | Es infraestructura (gestión de memoria) |
| **TerrainSystem** | 80 | Es infraestructura (datos de terreno) |

**Acción**: Mover a `src/domain/simulation/core/` como servicios de infraestructura.

---

## 📊 Resultado Proyectado

| Métrica | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| Sistemas principales | 31 | 20 | -35% |
| Líneas de código | ~20,700 | ~17,000 | -18% |
| Complejidad DI | Alta | Media | Significativa |

---

## 🎯 Nueva Organización Propuesta

```
systems/
├── ai/                          # Inteligencia (sin cambios)
│   ├── AISystem.ts             
│   └── core/                   
│
├── agents/                      # Todo sobre agentes
│   ├── NeedsSystem.ts          
│   ├── MovementSystem.ts       
│   ├── RoleSystem.ts           
│   └── EquipmentSystem.ts      
│
├── world/                       # Todo sobre el mundo
│   ├── WorldResourceSystem.ts  # + ItemGeneration + Production
│   └── animals/
│       └── AnimalSystem.ts     
│
├── social/                      # Relaciones y comunidad
│   ├── SocialSystem.ts         # + Genealogy
│   ├── FamilySystem.ts         # Marriage + Household
│   └── ReputationSystem.ts     
│
├── economy/                     # Economía
│   ├── EconomySystem.ts        
│   ├── InventorySystem.ts      
│   ├── CraftingSystem.ts       # EnhancedCrafting + RecipeDiscovery
│   └── ResourceReservationSystem.ts
│
├── conflict/                    # Conflicto
│   ├── CombatSystem.ts         
│   └── ConflictResolutionSystem.ts
│
├── structures/                  # Construcciones
│   ├── BuildingSystem.ts       # + BuildingMaintenance
│   └── GovernanceSystem.ts     
│
├── lifecycle/                   # Ciclo de vida
│   └── LifeCycleSystem.ts      
│
└── objectives/                  # Metas
    └── ObjectivesSystem.ts     # Quest + Task
```

---

## 📋 Orden de Ejecución

### Fase 1: Eliminaciones rápidas (bajo riesgo)
1. [ ] Eliminar InteractionGameSystem
2. [ ] Eliminar LivingLegendsSystem
3. [ ] Fusionar SharedKnowledgeSystem → AIContextAdapter

### Fase 2: Fusiones de crafting/recursos
4. [ ] RecipeDiscoverySystem → CraftingSystem
5. [ ] ItemGenerationSystem + ProductionSystem → WorldResourceSystem

### Fase 3: Fusiones sociales/familiares
6. [ ] GenealogySystem → SocialSystem
7. [ ] MarriageSystem + HouseholdSystem → FamilySystem

### Fase 4: Fusiones de tareas/edificios
8. [ ] QuestSystem + TaskSystem → ObjectivesSystem
9. [ ] BuildingMaintenanceSystem → BuildingSystem

### Fase 5: Reclasificación infraestructura
10. [ ] Mover TimeSystem, ChunkLoadingSystem, TerrainSystem a core/

---

## ⚠️ Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|------------|
| Tests rotos | Ejecutar tests después de cada fusión |
| Imports rotos | Actualizar re-exports en index.ts |
| Funcionalidad perdida | Revisar uso real antes de eliminar |
| Sistemas muy grandes | Mantener separación lógica interna |

---

## 🔬 Validación

Después de cada fase:
```bash
npx vitest run
```

Meta: Mantener 850+ tests pasando.
