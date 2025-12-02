# 📦 Sistema de Inventario — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INVENTORY SYSTEM                                    │
│                                                                              │
│  AgentInventory (capacidad)  |  Zone Stockpiles (compartidos)                │
│  Transferencias, consumo, totales por asentamiento                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Operaciones clave

- `initializeAgentInventory(agentId, capacity?)`
- `addResource(agentId, type, amount)` / `remove` (implícito vía consumo)
- `createStockpile(zoneId, type, capacity?)`
- `addToStockpile(stockpileId, type, amount)` / `consumeFromStockpile(...)`
- `getTotalStockpileResources()` para crafting/proyectos comunitarios

## 📡 Integración

- `EnhancedCraftingSystem` y `EconomySystem`: consumen/añaden
- `ResourceReservationSystem`: consume stockpiles si hay reservas aprobadas
- `ProductionSystem`: deposita output en stockpile de la zona

## ⚙️ Observabilidad

- Logs de capacidad llena/estadísticas de stockpiles
- `PerformanceMonitor` en operaciones intensivas

