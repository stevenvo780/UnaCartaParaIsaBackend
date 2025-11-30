# Plan de Simplificación de Sistemas

## Estado Actual: 31 Sistemas Principales

Tras el análisis, hay oportunidades claras de consolidación y eliminación.

---

## 🔴 SISTEMAS A ELIMINAR (No usados o redundantes)

### 1. **InteractionGameSystem** (95 líneas) → ELIMINAR
- **Uso**: Solo en `CommandProcessor` para `startInteraction`
- **Razón**: Funcionalidad mínima (mini-juegos no implementados)
- **Acción**: Eliminar completamente
- **Impacto**: Ninguno real en simulación

### 2. **LivingLegendsSystem** (256 líneas) → ELIMINAR  
- **Uso**: Solo en `SnapshotManager` para mostrar leyendas
- **Razón**: Feature decorativa, no afecta simulación
- **Acción**: Eliminar o mover lógica a ReputationSystem
- **Impacto**: Solo cosmético

### 3. **SharedKnowledgeSystem** (343 líneas) → FUSIONAR con AISystem
- **Uso**: Solo en `AIContextAdapter` para alertas
- **Razón**: Ya AISystem maneja conocimiento de agentes
- **Acción**: Mover `getKnownResourceAlerts/ThreatAlerts` a AIContextAdapter
- **Impacto**: Simplifica dependencias

---

## 🟠 SISTEMAS A FUSIONAR

### 4. **RecipeDiscoverySystem** (350 líneas) → **EnhancedCraftingSystem**
- **Similitud**: Ambos manejan recetas y conocimiento de crafting
- **RecipeDiscovery**: `teachRecipe`, `shareRecipe`, `attemptBiomeDiscovery`
- **EnhancedCrafting**: `craft`, `getKnownRecipes`, `craftBestWeapon`
- **Acción**: Fusionar en **CraftingSystem** (420+350 = ~600 líneas)
- **Reducción**: -1 sistema

### 5. **ItemGenerationSystem** (362 líneas) + **ProductionSystem** (312 líneas) → **WorldResourceSystem**
- **Similitud**: Ambos generan recursos en el mundo
- **ItemGeneration**: Spawn de ítems por bioma
- **Production**: Producción por zonas de trabajo
- **WorldResource**: Ya maneja recursos con posición
- **Acción**: Fusionar en **WorldResourceSystem** (797+362+312 = ~1200 líneas)
- **Reducción**: -2 sistemas

### 6. **QuestSystem** (570 líneas) + **TaskSystem** (589 líneas) → **ObjectivesSystem**
- **Similitud**: Ambos manejan "cosas a hacer" con progreso
- **Quest**: Misiones con objetivos y recompensas
- **Task**: Tareas de trabajo con progreso y contribuciones
- **Acción**: Unificar en **ObjectivesSystem**
- **Concepto**: Objective = { type: "quest"|"task", progress, contributors, rewards? }
- **Reducción**: -1 sistema

### 7. **GenealogySystem** (217 líneas) → **SocialSystem**
- **Similitud**: Genealogía es un tipo de relación social
- **Genealogy**: Árbol familiar, ancestros
- **Social**: Relaciones, afinidad, vínculos
- **Acción**: Mover lógica de parentesco a SocialSystem
- **Reducción**: -1 sistema

### 8. **MarriageSystem** (457 líneas) + **HouseholdSystem** (390 líneas) → **FamilySystem**
- **Similitud**: Ambos manejan unidades familiares
- **Marriage**: Propuestas, grupos de matrimonio, divorcios
- **Household**: Hogares, miembros, recursos compartidos
- **Acción**: Fusionar en **FamilySystem**
- **Reducción**: -1 sistema

### 9. **BuildingMaintenanceSystem** (270 líneas) → **BuildingSystem**
- **Similitud**: Mantenimiento es parte del ciclo de vida de edificios
- **Acción**: Fusionar lógica de degradación/reparación en BuildingSystem
- **Reducción**: -1 sistema

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
