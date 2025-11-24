# Checklist de Migración: Monolith (Frontend) -> Backend/Frontend Split

Este documento detalla el estado de la migración de los sistemas desde la arquitectura monolítica (rama `dev` del frontend) hacia la nueva arquitectura distribuida (Backend + Frontend).

## 🚨 Componentes Críticos Faltantes en Backend

Estos sistemas existían en el monolito y son esenciales para la simulación, pero no se encuentran en el Backend.

| Sistema | Estado | Impacto |
| :--- | :--- | :--- |
| **MovementSystem** | ❌ **FALTANTE** | Los agentes no actualizarán su posición física en el servidor. La IA puede decidir moverse, pero la ejecución del movimiento no ocurre. |
| **TrailSystem** | ❌ **FALTANTE** | Lógica de rastros (huellas, caminos) perdida. Puede afectar la navegación o mecánicas de rastreo. |

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

## 📝 Acciones Recomendadas

1.  **Implementar `MovementSystem` en Backend**: Es urgente portar la lógica de movimiento (actualización de coordenadas `x, y` basada en velocidad y delta time) al Backend. Sin esto, los agentes estarán estáticos lógicamente aunque la IA intente moverlos.
2.  **Revisar `TrailSystem`**: Decidir si la lógica de rastros (impacto en gameplay) es necesaria en Backend o si se queda como efecto visual.
3.  **Verificar `AgingSystem`**: Confirmar que toda la lógica de envejecimiento está cubierta en `LifeCycleSystem`.
4.  **Sincronización**: Asegurar que los `Client*System` en Frontend estén recibiendo correctamente los estados del Backend (especialmente posiciones si se arregla el movimiento).
