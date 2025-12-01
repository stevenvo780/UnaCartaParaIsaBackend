# Plan de Simplificación de Sistemas

## Estado Actual: ~~31~~ → 27 Sistemas Principales

Tras el análisis, hay oportunidades claras de consolidación y eliminación.

**Progreso:**
- ✅ InteractionGameSystem: ELIMINADO
- ✅ LivingLegendsSystem: ELIMINADO  
- ✅ BuildingMaintenanceSystem: FUSIONADO en BuildingSystem
- ✅ SharedKnowledgeSystem: MOVIDO a ai/ (infraestructura interna)
- ✅ QuestSystem: ELIMINADO (misiones narrativas no necesarias para simulación)
- ⏸️ RecipeDiscoverySystem: POSPUESTO (complejo, fusión opcional)
- ⏸️ ItemGenerationSystem + ProductionSystem: POSPUESTO (complejo, 1471 líneas)
- ✅ GenealogySystem: MANTENER SEPARADO (pequeño, bien definido)
- ⏸️ MarriageSystem + HouseholdSystem: POSPUESTO (APIs incompatibles)

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

### 4. **QuestSystem** (570 líneas) → ✅ ELIMINADO
- **Uso**: Misiones narrativas, no esencial para simulación core
- **Razón**: Usuario decidió eliminar misiones narrativas para enfocarse en simulación
- **Estado**: ✅ Eliminado completamente (sistema, tests, referencias)

---

## 🟠 SISTEMAS PENDIENTES DE FUSIONAR

### 5. **SharedKnowledgeSystem** (343 líneas) → ✅ MOVIDO a ai/
- **Uso**: Solo en `AIContextAdapter` para alertas
- **Decisión**: Movido a `systems/ai/` como infraestructura interna
- **Estado**: ✅ Reclasificado

### 6. **RecipeDiscoverySystem** (350 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos manejan recetas y conocimiento de crafting
- **Complejidad**: Alta (700+ líneas combinadas)
- **Estado**: Pospuesto (fusión opcional, no prioritario)

### 7. **ItemGenerationSystem** (362 líneas) + **ProductionSystem** (312 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos generan recursos en el mundo
- **Complejidad**: Alta (1471 líneas combinadas)
- **Estado**: Pospuesto (muy complejo, riesgo alto)

### 8. **GenealogySystem** (217 líneas) → ✅ MANTENER SEPARADO

### 5. **RecipeDiscoverySystem** (350 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos manejan recetas y conocimiento de crafting
- **Complejidad**: Alta (700+ líneas combinadas)
- **Estado**: Pospuesto (fusión opcional, no prioritario)

### 6. **ItemGenerationSystem** (362 líneas) + **ProductionSystem** (312 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos generan recursos en el mundo
- **Complejidad**: Alta (1471 líneas combinadas)
- **Estado**: Pospuesto (muy complejo, riesgo alto)

### 7. **QuestSystem** (570 líneas) + **TaskSystem** (589 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos manejan "cosas a hacer" con progreso
- **Complejidad**: Alta (1159 líneas combinadas)
- **Razón**: Propósitos diferentes (misiones vs trabajos)
- **Estado**: Pospuesto (diferente semántica)

### 8. **GenealogySystem** (217 líneas) → ✅ MANTENER SEPARADO
- **Similitud**: Genealogía es un tipo de relación social
- **Decisión**: Mantener separado (pequeño, bien definido)
- **Estado**: ✅ No fusionar

### 9. **MarriageSystem** (457 líneas) + **HouseholdSystem** (390 líneas) → ⏸️ POSPUESTO
- **Similitud**: Ambos manejan unidades familiares
- **Complejidad**: Media (847 líneas combinadas)
- **Razón**: APIs incompatibles (HouseholdSystem usa zonas REST, inventario diferente)
- **Estado**: Pospuesto (requiere refactor significativo)

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

## 📊 Resultado Actual

| Métrica | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| Sistemas principales | 31 | 28 | -10% |
| Eliminados | - | 3 | InteractionGame, LivingLegends, BuildingMaintenance |
| Tests pasando | 828 | 828 | ✅ Sin regresiones |

### Sistemas Restantes (28)
Los sistemas pospuestos se mantienen separados por:
- **Complejidad alta**: Fusiones de 1000+ líneas son riesgosas
- **APIs incompatibles**: HouseholdSystem vs MarriageSystem usan patrones diferentes
- **Semántica diferente**: QuestSystem (misiones) vs TaskSystem (trabajos)

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

### Fase 1: Eliminaciones rápidas (bajo riesgo) ✅
1. [x] Eliminar InteractionGameSystem ✅
2. [x] Eliminar LivingLegendsSystem ✅
3. [x] Mover SharedKnowledgeSystem a ai/ ✅

### Fase 2: Fusiones de crafting/recursos ⏸️
4. [ ] RecipeDiscoverySystem → CraftingSystem (POSPUESTO)
5. [ ] ItemGenerationSystem + ProductionSystem → WorldResourceSystem (POSPUESTO)

### Fase 3: Fusiones sociales/familiares ⏸️
6. [x] GenealogySystem → SocialSystem (MANTENER SEPARADO) ✅
7. [ ] MarriageSystem + HouseholdSystem → FamilySystem (POSPUESTO)

### Fase 4: Fusiones de tareas/edificios ✅/⏸️
8. [ ] QuestSystem + TaskSystem → ObjectivesSystem (POSPUESTO)
9. [x] BuildingMaintenanceSystem → BuildingSystem ✅

### Fase 5: Reclasificación infraestructura (OPCIONAL)
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
