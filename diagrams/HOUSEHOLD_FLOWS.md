# 🏠 Sistema de Households — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOUSEHOLD SYSTEM                                    │
│                                                                              │
│  Zones (REST) → rebuildFromZones → households Map                             │
│  update() → occupancy/homeless → señales                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `rebuildFromZones()` crea households desde zonas REST (capacidad proporcional)
2) `assignToHouse(agent, role)` asigna agente y emite `HOUSEHOLD_AGENT_ASSIGNED`
3) `update()` cada `updateIntervalMs`:
- Calcula stats → `HOUSEHOLD_HIGH_OCCUPANCY` si supera umbral
- Detecta homeless → `HOUSEHOLD_AGENTS_HOMELESS`
4) Depósitos y retiros a inventario compartido (`depositToHousehold/withdraw`)

## 📡 Eventos

- Emite: `HOUSEHOLD_AGENT_ASSIGNED`, `HOUSEHOLD_AGENT_LEFT`, `HOUSEHOLD_*_RESOURCE_*`, `HOUSEHOLD_HIGH_OCCUPANCY`, `HOUSEHOLD_AGENTS_HOMELESS`, `HOUSEHOLD_NO_FREE_HOUSES`

## 🤝 Integración

- `GovernanceSystem`: consume señales de ocupación/homeless
- `MarriageSystem`: puede anotarse `marriageGroupId` en household
- `Inventory/Economy`: emplean el inventario compartido

