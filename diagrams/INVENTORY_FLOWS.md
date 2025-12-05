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

---

### Casuística y Garantías

- **Capacidad estricta por agente.** `addResource()` calcula la carga actual (wood+stone+food+water+minerales). Si `load + amount > capacity`, rechaza la inserción, loggea el evento y devuelve `false`, permitiendo a EconomySystem derivar excedentes a reservas globales.
- **Stockpiles registrados por zona.** `createStockpile()` genera un id único, inicializa inventario compartido y lo inserta en `stockpilesByZone`. Esto hace que `getStockpilesInZone()` responda en O(n ids) y que ProductionSystem pueda depositar sin conocer internamente los almacenamientos.
- **Sincronización con GameState.** `syncToGameState()` copia inventarios de agentes y stockpiles a `gameState.inventory`, además de exponer un agregado `global` (stockpiles + agentes). `StateDirtyTracker` se marca para que los consumidores (UI/network) reciban los cambios.
- **Métricas agregadas disponibles.** `getTotalStockpileResources()` y `getSystemStats()` exponen cantidades totales para crafting/reservas. ResourceReservationSystem usa esos números para decidir si un proyecto puede bloquear materiales sin depender de inspecciones manuales.
- **Depuración automática.** Cada intervalo (`SIMULATION_CONSTANTS.TIMING.DEPRECATION_INTERVAL_MS`) se limpian inventarios obsoletos y se registran métricas en `PerformanceMonitor`, evitando “auditorías” manuales para detectar fugas de stock.

---

## 📌 Resumen Operativo

InventorySystem centraliza la capacidad de agentes y stockpiles, garantiza que ninguna inserción exceda los límites configurados y publica estadísticas agregadas para sistemas como Economy y ResourceReservation. Esta descripción refleja la implementación en `src/domain/simulation/systems/economy/InventorySystem.ts`.
