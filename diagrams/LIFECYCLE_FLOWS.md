# 👶 Sistema de Ciclo de Vida — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             LIFECYCLE SYSTEM                                   │
│                                                                              │
│  update(dt) → aging (stages) → death/removal                                  │
│  tryBreeding() → births → initialize agent state                               │
│  housing queue → assignToHouse                                                  │
│  role rebalance (cada 2min)                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Edad y etapas:
- Avanza edad en años virtuales → emite `AGENT_AGED` al cambiar de fase
- Si supera `maxAge` y no es inmortal → `removeAgent`

2) Nacimientos:
- `tryBreeding()` con ventanas de fertilidad y cooldowns
- `spawnAgentProfile(...)` inicializa: needs, inventory, movimiento, genealogía, rol
- Emite `AGENT_BIRTH`

3) Vivienda:
- Adultos en cola de vivienda → `assignToHouse` del `HouseholdSystem`
- Eventos de household según asignación

4) Rebalanceo de roles:
- Cada 120s analiza stockpiles/población → `RoleSystem.rebalanceRoles`

## 📡 Integración

- `Needs/AI/Inventory/Social/Marriage/Genealogy/Household/Movement/Role/Task`
- `AgentRegistry/EntityIndex` para sincronizar entidades

---

## 📌 Validación

- `src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts`: implementa el flujo completo (`update`, `tryBreeding`, `spawnAgentProfile`, `assignToHouseholdQueue`, `rebalanceRoles`) y emite los eventos `AGENT_BIRTH`, `AGENT_AGED`, `AGENT_DEATH`.
- Las dependencias listadas (Needs, AI, Inventory, etc.) se inyectan o se obtienen vía `SystemRegistry`, comprobando las integraciones descritas.
