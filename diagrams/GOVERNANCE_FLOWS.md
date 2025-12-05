# 🏛️ Sistema de Gobernanza — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GOVERNANCE SYSTEM                                  │
│                                                                              │
│  Señales → Demands → Policies → Projects/Assignments → Snapshot              │
│                                                                              │
│  deps: LifeCycleSystem, InventorySystem, ResourceReservationSystem,          │
│        RoleSystem, AgentRegistry (opcional)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Señales (eventos):
- HOUSEHOLD_* (ocupación, homeless), CRISIS_*, PRODUCTION_* → `createDemand()`

2) `update()` (cada `checkIntervalMs`):
- Expira demandas antiguas
- Evalúa necesidades del asentamiento
- Genera `snapshot` (stats, policies, demands, history, reservas)

3) Resolución automática (si `autoGenerateProjects`):
- Reserva recursos (`ResourceReservationSystem.reserve/consume`)
- Asigna roles (`RoleSystem`) cuando apliquen
- Aplica efectos (p. ej., boosts de comida/agua)
- Marca demanda como resuelta o en curso
- Emite `GOVERNANCE_ACTION`

## 📡 Eventos

- Emite: `DEMAND_CREATED`, `DEMAND_RESOLVED`, `PROJECT_FAILED`,
  `POLICY_CHANGED`, `PRODUCTION_*` (historia)
- Escucha: `PRODUCTION_OUTPUT_GENERATED`, `PRODUCTION_WORKER_REMOVED`,
  `HOUSEHOLD_*`, `CRISIS_*`

## ⚙️ Políticas (ejemplos)

- FOOD_SECURITY: construir/reforzar infraestructura de alimentos
- WATER_SUPPLY: priorizar recolección/refuerzo de agua
- HOUSING_EXPANSION: iniciar proyectos de vivienda

---

## 📌 Validación

- `src/domain/simulation/systems/structures/GovernanceSystem.ts`: gestiona `demands`, `policies`, `history` y los métodos `createDemand`, `update`, `autoGenerateProjects`, confirmando cada paso descrito.
- Los eventos escuchados/emisiones (`DEMAND_CREATED`, `GOVERNANCE_ACTION`, `PRODUCTION_OUTPUT_GENERATED`, etc.) están cableados en este archivo, validando la sección de eventos.
