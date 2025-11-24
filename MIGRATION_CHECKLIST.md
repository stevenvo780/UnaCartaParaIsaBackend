# Checklist de Migración: Monolith (Frontend) -> Backend/Frontend Split

Este documento detalla el estado de la migración de los sistemas desde la arquitectura monolítica (rama `dev` del frontend) hacia la nueva arquitectura distribuida (Backend + Frontend).

## 🚨 Componentes Críticos Faltantes en Backend

Estos componentes existían en el monolito y son esenciales para la simulación, pero no se encuentran en el Backend o requieren verificación.

### 📂 Datos y Catálogos (Faltantes)
Muchos archivos de datos estáticos (`src/data/`) no se han migrado al backend. Esto puede causar que los sistemas funcionen con datos vacíos o por defecto.

| Archivo (Dev) | Estado en Backend | Acción Requerida |
| :--- | :---: | :--- |
| `BaseMaterialsCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `BiomeRecipesCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `FoodCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `ItemCompatibilityCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `ProcessedItemsCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `QuestCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `ResearchTreeCatalog.ts` | ❌ | Migrar a `src/simulation/data/` |
| `RecipesCatalog.ts` | ⚠️ | Existe `recipes.ts`, verificar completitud. |
| `WeaponCatalog.ts` | ✅ | Migrado. |

### ⚙️ Configuración (Faltante)
La configuración del juego (`src/config/`) falta en gran medida en el backend.

| Archivo (Dev) | Estado en Backend | Acción Requerida |
| :--- | :---: | :--- |
| `AnimalConfigs.ts` | ❌ | Migrar a `src/config/` |
| `WorldResourceConfigs.ts` | ❌ | Migrar a `src/config/` |
| `ZoneProperties.ts` | ❌ | Migrar a `src/config/` |
| `gameConfig.ts` | ⚠️ | Existe `config.ts`, verificar si cubre todo. |
| `ChunkConfig.ts` | ❌ | Migrar si el backend maneja chunks lógicos. |
| `DivineEntities.ts` | ❌ | Migrar a `src/config/` |
| `WorldConfig.ts` | ❌ | Migrar a `src/config/` |

## 📋 Checklist de Sistemas

### 🧠 AI & Comportamiento
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **AISystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Núcleo de IA migrado. |
| **Evaluators** | ✅ | ✅ | - | Sub-componentes (Combat, Needs, etc.) presentes en `systems/ai/`. |
| **AgentGoalPlanner** | ✅ | ✅ | - | Migrado. |
| **ActivityMapper** | ✅ | ✅ | - | Migrado. |

### 🌍 Ambient & Mundo
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **AmbientAwareness** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **CrisisPredictor** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **LivingLegends** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ResourceAttraction**| ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **TrailSystem** | ✅ | ✅ | ✅ (Visual) | Lógica presente en backend (`TrailSystem.ts`). |
| **AnimalSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **WorldResource** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |

### ⚙️ Core & Simulación
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **DayNightSystem** | ✅ | ✅ (TimeSystem) | 🟡 (ClientAdapter) | Renombrado a `TimeSystem`. |
| **InventorySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **MovementSystem** | ✅ | ✅ | ✅ (Interpolation) | Lógica presente en backend (`MovementSystem.ts`). |
| **NeedsSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **PriorityManager** | ✅ | ❌ | - | No encontrado explícitamente. Verificar si está integrado en AI. |
| **SaveSystem** | ✅ | ✅ (StorageService) | 🔄 (Client) | Reemplazado por `storageService` y API. |
| **EmergenceSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **GenealogySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **LifeCycleSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Incluye lógica de `AgingSystem`. |

### 💰 Economía & Gestión
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **EconomySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **MarketSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **TradeSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ProductionSystem** | 🆕 | ✅ | 🟡 (ClientAdapter) | Nuevo sistema o refactorización. |
| **ResourceReservation**| ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **GovernanceSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **DivineFavorSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |

### ⚔️ Gameplay & Interacción
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **CombatSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **CraftingSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **BuildingSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **BuildingMaintenance**| ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **InteractionGame** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ItemGeneration** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **KnowledgeNetwork** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **QuestSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **RecipeDiscovery** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ResearchSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **RoleSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **TaskSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |

### 🗣️ Social
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **SocialSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **CardDialogue** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ConflictResolution**| ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **HouseholdSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **MarriageSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **NormsSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ReputationSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |

### 🎨 Visual & UI (Frontend Only)
Estos sistemas son puramente visuales y es correcto que permanezcan solo en el Frontend.

*   `ActionAnimationSystem`
*   `HealthBarOverlay`
*   `WeaponVisualizerSystem`
*   `PopulationVisualSystem`
*   `VisualDiversityCoordinator`
*   `WaterRipplePipeline`
*   `AppearanceGenerationSystem` (Existe en Backend también para lógica, Frontend para render)
*   `GeneticSpriteSystem` (Existe en Backend también para lógica, Frontend para render)

## 🔄 Integración Backend/Frontend

- **Puente de comandos**: `AGENT_COMMAND`, `ANIMAL_COMMAND`, `FORCE_EMERGENCE_EVALUATION`, y nuevos comandos de construcción ya son atendidos por el backend.
- **Snapshots enriquecidos**: Los adaptadores de entidades, necesidades, economía, social, edificios, tiempo y emergencia ahora leen directamente `snapshot.state`, garantizando que los datos del servidor lleguen al cliente aun sin eventos dedicados.
- **Compatibilidad**: Se mantienen caídas amigables para payloads antiguos mientras el frontend termina de actualizarse.

## 📝 Acciones Recomendadas

1.  **Migrar Catálogos Faltantes**: Prioridad alta. Sin `FoodCatalog`, `BaseMaterialsCatalog`, etc., la economía y el crafting fallarán.
2.  **Migrar Configuraciones**: Prioridad alta. `AnimalConfigs` y `WorldResourceConfigs` son necesarios para el spawn correcto.
3.  **Verificar PriorityManager**: Confirmar si su lógica fue absorbida por `AISystem` o `TaskSystem`.
4.  **Probar comandos de control**: Validar `AGENT_COMMAND`, `ANIMAL_COMMAND` y `BUILDING_COMMAND` desde la UI.
