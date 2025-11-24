# Checklist de Migración: Monolith (Frontend) -> Backend/Frontend Split

Este documento detalla el estado de la migración de los sistemas desde la arquitectura monolítica (rama `dev` del frontend) hacia la nueva arquitectura distribuida (Backend + Frontend).

## 🚨 Componentes Críticos Faltantes en Backend

Estos sistemas existían en el monolito y son esenciales para la simulación, pero no se encuentran en el Backend.

| Sistema | Estado | Impacto |
| :--- | :--- | :--- |
| **MovementSystem** | ✅ | Migrado y ahora responde a `AGENT_COMMAND` para mover/detener agentes desde el frontend. |
| **TrailSystem** | ✅ | Lógica de rastros disponible en backend; el frontend la consume vía snapshots. |

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
| **TrailSystem** | ✅ | ❌ | ✅ (Visual) | **Lógica perdida en backend.** |
| **AnimalSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **WorldResource** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |

### ⚙️ Core & Simulación
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **DayNightSystem** | ✅ | ✅ (TimeSystem) | 🟡 (ClientAdapter) | Renombrado a `TimeSystem`. |
| **InventorySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **MovementSystem** | ✅ | ❌ | ✅ (Interpolation) | **CRÍTICO: Falta lógica de actualización de posición en backend.** |
| **NeedsSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **PriorityManager** | ✅ | ✅ | - | Migrado (interno en AI). |
| **SaveSystem** | ✅ | 🔄 (Controller) | 🔄 (Client) | Reemplazado por API de guardado. |
| **EmergenceSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **GenealogySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **LifeCycleSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Incluye lógica de `AgingSystem`. |

### 💰 Economía & Gestión
| Sistema | Monolith (Dev) | Backend (Nuevo) | Frontend (Visual) | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **EconomySystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **MarketSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **TradeSystem** | ✅ | ✅ | 🟡 (ClientAdapter) | Migrado. |
| **ProductionSystem** | 🆕 | ✅ | 🟡 (ClientAdapter) | Nuevo sistema o refactorización de `ProductionOptimizer`. |
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
*   `AppearanceGenerationSystem`
*   `GeneticSpriteSystem`
*   `PopulationVisualSystem`
*   `VisualDiversityCoordinator`
*   `WaterRipplePipeline`

## 🔄 Integración Backend/Frontend

- **Puente de comandos**: `AGENT_COMMAND`, `ANIMAL_COMMAND`, `FORCE_EMERGENCE_EVALUATION`, y nuevos comandos de construcción ya son atendidos por el backend.
- **Snapshots enriquecidos**: Los adaptadores de entidades, necesidades, economía, social, edificios, tiempo y emergencia ahora leen directamente `snapshot.state`, garantizando que los datos del servidor lleguen al cliente aun sin eventos dedicados.
- **Compatibilidad**: Se mantienen caídas amigables para payloads antiguos mientras el frontend termina de actualizarse.

## 📝 Acciones Recomendadas

1.  **Probar comandos de control**: Validar `AGENT_COMMAND`, `ANIMAL_COMMAND` y `BUILDING_COMMAND` desde la UI para asegurar que las nuevas rutas funcionan (mover agentes, spawnear animales, encolar construcciones).
2.  **Monitorear snapshots**: Revisar que los adaptadores (social, economía, edificios, tiempo, emergencia) reaccionan correctamente ante cambios en `snapshot.state` y eventos agregados.
3.  **Documentar payloads**: Actualizar la guía de integración para reflejar los nuevos nombres de campos (`teacherId`, `studentId`, `buildingType`, etc.) y evitar regresiones en futuros clientes.
