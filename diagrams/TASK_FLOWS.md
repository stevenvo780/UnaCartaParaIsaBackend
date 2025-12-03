# 📋 Sistema de Tareas — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 TASK SYSTEM                                    │
│                                                                              │
│  createTask(params) → contributors → progress → complete/cancel               │
│  update() → STALLED detection → cancelStalledTask                              │
│                                                                              │
│  deps: GameState (snapshot), StateDirtyTracker (dirty), EventBus              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `createTask(params)`:
- Valida recursos requeridos (opcional) con `GameState.resources`
- Crea y emite `TASK_CREATED`

2) Progreso colaborativo:
- `contributeToTask(taskId, agentId, contribution, synergy)`
- Aplica `minWorkers` y bonus de cooperación
- Actualiza `progress` y emite `TASK_PROGRESS`
- Al completar: marca `completed`, registra historial y emite `TASK_COMPLETED`

3) Estancamiento/Cancelación:
- `update()` revisa `lastContribution`
- Emite `TASK_STALLED` (umbral) y `cancelStalledTask` si excede máximo

4) Estado/Snapshot:
- `syncTasksState()` rellena `gameState.tasks.tasks` y `stats` cuando `dirty`

## 📡 Integración

- `AISystem`: encola/consume tareas para agentes según roles/necesidades
- `BuildingSystem`: crea tareas de construcción y escucha `TASK_COMPLETED`
- `GovernanceSystem`: puede observar estadísticas para políticas

