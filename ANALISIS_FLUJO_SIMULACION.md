# Mapa Actualizado de Flujos y Eventos de la Simulación

_Última revisión: 25-nov-2025_

---

## 1. Resumen Ejecutivo

- **Motor de eventos estable:** 112 eventos definidos tras la limpieza (`EMERGENCE_PATTERN_ACTIVE` e `INHERITANCE_RECEIVED` eliminados). 32 tienen efectos de backend, el resto alimenta únicamente UI/telemetría.
- **Conexiones críticas cubiertas:** nacimiento/muerte de agentes, movimiento, necesidades críticas, tareas completadas y sanciones sociales ya disparan efectos concretos (ver §4.1).
- **Mejoras recientes:**  
  - `AGENT_AGED` ahora asigna roles y vivienda automáticamente.  
  - `NORM_SANCTION_APPLIED` ajusta reputación cuando se castiga una infracción.  
  - `CONFLICT_TRUCE_ACCEPTED/REJECTED` modifican afinidad social y reputación.  
- **Áreas con deuda:** eventos de _economía, construcción temprana, conocimiento, quests/comercio_ siguen sin listeners; varios se emiten solo para visualización y deben documentarse como tales.
- **Backlog prioritario:** enganchar `NEED_SATISFIED` para liberar reservas, escuchar `BUILDING_CONSTRUCTION_STARTED`, consumir eventos de producción/economía y definir reacción a `CRISIS_PREDICTION`.

---

## 2. Arquitectura de Orquestación

```
┌──────────────────────────────────────────┐
│            SimulationRunner              │
│  - Orquesta 40 sistemas                   │
│  - Administra MultiRateScheduler          │
│  - Captura y reenvía eventos              │
│  - Expone snapshots/δ vía WebSocket       │
└──────────────┬───────────────────────────┘
               │ simulationEvents (BatchedEventEmitter)
               ▼
┌──────────────────────────────────────────┐
│       Sistemas dominiales (AI, Needs,    │
│       Economy, Social, etc.)             │
└──────────────────────────────────────────┘
```

**BatchedEventEmitter** queuea durante el tick y hace _flush_ al final, evitando reentrancias. SimulationRunner inyecta listeners en `setupEventListeners()` y, además, captura todos los eventos para emitirlos al cliente (mapa `eventNameMapper`).

---

## 3. Fases del Tick (MultiRateScheduler)

| Frecuencia | Intervalo | Sistemas principales | Eventos claves |
|-----------|-----------|----------------------|----------------|
| **FAST (10 Hz)** | 100 ms | `MovementSystem`, `CombatSystem`, `TrailSystem` | `MOVEMENT_ARRIVED_AT_ZONE`, `AGENT_ACTION_COMPLETE`, `COMBAT_HIT` |
| **MEDIUM (2 Hz)** | 500 ms | `AISystem`, `NeedsSystem`, `SocialSystem`, `HouseholdSystem`, `LifeCycleSystem`, `TimeSystem`, `RoleSystem`, `TaskSystem` | `NEED_CRITICAL`, `AGENT_AGED`, `TASK_STALLED`, `ROLE_SHIFT_CHANGED` |
| **SLOW (1 Hz)** | 1000 ms | Economía, gobierno, crafting, quests, marriage, emergence, etc. | `ECONOMY_RESERVATIONS_UPDATE`, `CRISIS_PREDICTION`, `QUEST_STARTED`, `CRAFTING_JOB_COMPLETED`, ... |

Tras cada tick:  
1. Se hace _flush_ de eventos.  
2. `StateCache` marca secciones sucias.  
3. Se emite snapshot/tick o delta según corresponda.

---

## 4. Estado del Bus de Eventos

### 4.1 Conexiones operativas

| Dominio | Evento | Emisor → Suscriptores/Acciones |
|---------|--------|--------------------------------|
| Ciclo de vida | `AGENT_BIRTH` | `LifeCycleSystem` → `SimulationRunner` (genealogía, apariencia) |
| Ciclo de vida | `AGENT_DEATH` | `NeedsSystem` / `LifeCycleSystem` → `SimulationRunner` (índices), `ProductionSystem` |
| Ciclo de vida | `AGENT_RESPAWNED` | `NeedsSystem` → `SimulationRunner` (reactiva AI/movimiento) |
| Movimiento | `MOVEMENT_ARRIVED_AT_ZONE` | `MovementSystem` → `SimulationRunner` → `AISystem.notifyEntityArrived()` |
| Necesidades | `NEED_CRITICAL` | `NeedsSystem` → `SimulationRunner` (reevalúa goal), `CardDialogueSystem` |
| Tareas | `TASK_COMPLETED` | `TaskSystem` → `SimulationRunner` (reputación + quests) |
| Normas | `NORM_SANCTION_APPLIED` | `NormsSystem` → `SimulationRunner` → `ReputationSystem.updateReputation()` |
| Conflictos | `CONFLICT_TRUCE_ACCEPTED/REJECTED` | `ConflictResolutionSystem` → `SimulationRunner` (modifica afinidad y reputación) |
| Roles/Housing | `AGENT_AGED` | `LifeCycleSystem` → `SimulationRunner` (asigna rol/vivienda, ajusta seniors) |

### 4.2 Eventos informativos (solo frontend / analytics)

`TIME_CHANGED`, `TIME_WEATHER_CHANGED`, `KNOWLEDGE_*`, `ROLE_*`, `QUEST_*`, `TRADE_*`, `DIALOGUE_SHOW_CARD`, `DIALOGUE_CARD_EXPIRED`, `INTERACTION_GAME_PLAYED`, `LEGEND_UPDATE`, `APPEARANCE_*`, `RESOURCE_STATE_CHANGE`, `RESOURCE_SPAWNED`.  
> **Acción recomendada:** Documentar explícitamente que estos eventos no necesitan listeners backend para evitar falsos positivos en auditorías.

### 4.3 Eventos con deuda funcional

| Evento | Motivo | Acción sugerida |
|--------|--------|-----------------|
| `NEED_SATISFIED` | permitir liberar reservas/objetivos | Hacer que `ResourceReservationSystem` escuche y libere cupos |
| `BUILDING_CONSTRUCTION_STARTED` | sin tracking de progreso | Notificar `TaskSystem`/`Governance` para dashboards |
| `HOUSEHOLD_AGENT_ASSIGNED`, `HOUSEHOLD_RESOURCE_*` | datos disponibles pero no consumidos | Resolver en UI o estadísticas |
| `ECONOMY_RESERVATIONS_UPDATE`, `SALARY_PAID`, `PRODUCTION_OUTPUT_GENERATED` | ideal para panel económico | Conectar a `GovernanceSystem` o telemetría |
| `WORLD RESOURCE STATE_CHANGE` | recursos cambian sin broadcast | Propagar a frontend para actualizaciones diferidas |
| `QUEST_*`, `TRADE_*` | progreso no reflejado en backend | Consumir desde `QuestSystem`/`MarketSystem` o marcarlos explícitamente como UI-only |
| `KNOWLEDGE_*` | actualmente solo log | Integrar con AI (habilitar recetas/acciones) |
| `CRISIS_PREDICTION` | Predicciones sin respuesta | Reaccionar desde `AISystem`/`GovernanceSystem` con planes preventivos |

### 4.4 Eventos inexistentes / limpiados

- `EMERGENCE_PATTERN_ACTIVE` y `INHERITANCE_RECEIVED` eliminados (no tenían caso de uso).
- `SOCIAL_RALLY`, `DIVORCE_INITIATED`, `MARRIAGE_MEMBER_LEFT`, `REPRODUCTION_ATTEMPT`, `INVENTORY_DROPPED` **sí** tienen emisores en código (SocialSystem, MarriageSystem, LifeCycleSystem). El documento anterior los clasificaba erróneamente como “nunca emitidos”.

---

## 5. Flujos Transversales Destacados

1. **Nacimiento → Integración completa**  
   `LifeCycleSystem.spawnAgent()` → `AGENT_BIRTH` → genealogía, apariencia, inicialización de Needs/Inventory/Movement.

2. **Muerte / Respawn**  
   `NeedsSystem` detecta muerte → `AGENT_DEATH` → Genealogía + EntityIndex + Production.  
   Si el respawn está habilitado → `AGENT_RESPAWNED` reactiva AI y movimiento.

3. **Ciclo social/normativo**  
   Combate en zona protegida → `NormsSystem.handleCombatInZone()` → `NORM_VIOLATED` + `NORM_SANCTION_APPLIED` → reputación negativa + posibles treguas (`SocialSystem.imposeTruce`).

4. **Resolución de conflictos**  
   `ConflictResolutionSystem` media cards de diálogo → `CONFLICT_TRUCE_*` → SimulationRunner ajusta afinidad y reputación, con efecto directo en `SocialSystem`.

5. **Necesidades ↔ AI ↔ Movimiento**  
   `NEED_CRITICAL` obliga reevaluar objetivos; `AISystem` ordena movimiento; `MovementSystem` confirma llegada; al completarse, `AGENT_ACTION_COMPLETE` alimenta genealogía y LivingLegends.

---

## 6. Riesgos y Backlog Prioritario

1. **Liberación de recursos** (`NEED_SATISFIED` sin listener) — riesgo de reservas bloqueadas.
2. **Economía opaca** — eventos de economía/producción no se consumen (difícil analizar cuello de botella).
3. **Construcción temprana** — sin listener para `BUILDING_CONSTRUCTION_STARTED` no se puede mostrar progreso parcial.
4. **Crisis sin respuesta** — `CRISIS_PREDICTION` y `CRISIS_IMMEDIATE_WARNING` solo disparan reevaluación general; faltan planes específicos.
5. **Conocimiento y quests desconectados** — `KNOWLEDGE_*` y `QUEST_*` solo alimentan UI.
6. **Front-back desalineado** — documentar y/o mover eventos UI-only a un namespace separado para reducir ruido.

---

## 7. Métricas de Cobertura

| Métrica | Valor aproximado |
|---------|------------------|
| Eventos definidos | 112 |
| Eventos con efectos backend | 32 |
| Eventos UI-only (telemetría/visualización) | 48 |
| Eventos con deuda (emitidos sin listener) | 18 |
| Eventos sin emisor (rebalancear o eliminar) | 4 (`GOVERNANCE_ACTION`, `AGENT_ACTIVITY_STARTED`, `SOCIAL_RELATION_CHANGED`, `INTERACTION_GAME_PLAYED` desde reputación) |

> **Recomendación:** Mantener esta tabla viva; cualquier nueva adición a `GameEventNames` debe registrarse en una de las tres categorías (backend, UI-only, pendiente) para evitar regresiones.

---

## 8. Próximos Pasos Sugeridos

1. **Corto plazo**
   - Consumir `NEED_SATISFIED` en `ResourceReservationSystem`.
   - Exponer `ECONOMY_RESERVATIONS_UPDATE` al HUD o dashboards internos.
   - Registrar progreso inicial de construcción (`BUILDING_CONSTRUCTION_STARTED`).

2. **Mediano plazo**
   - Conectar `CRISIS_PREDICTION` con objetivos AI específicos (evacuación, stockpiling).
   - Dar significado a `KNOWLEDGE_*` (habilitar recetas avanzadas / perks).
   - Normalizar eventos UI-only en un prefijo (`ui:*`) para reducir ruido.

3. **Largo plazo**
   - Diseñar pipeline de “historias” usando `LEGEND_UPDATE`, `SOCIAL_RALLY`, `QUEST_*`.
   - Revisar tasas del MultiRateScheduler si la carga aumenta (telemetría indica 40 ms promedio por tick en hardware actual).

---

### Conclusión

El bus de eventos está saludable y las rutas críticas están cubiertas. La deuda restante se concentra en **telemetría sin consumidor** y **respuestas económicas/sociales** que todavía no se materializan. Con las mejoras recientes (roles al envejecer, sanciones normativas y treguas), la simulación reacciona mejor al comportamiento emergente; el siguiente paso es aprovechar los eventos informativos para construir paneles y automatismos que hoy no existen.

