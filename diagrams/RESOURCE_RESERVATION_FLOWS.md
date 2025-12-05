# 🧾 Sistema de Reservas de Recursos — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESOURCE RESERVATION SYSTEM                                │
│                                                                              │
│  reserve(taskId,cost) → consume(taskId) / release(taskId)                    │
│  getAvailableResources(includeReserved)                                      │
│  Limpieza de reservas obsoletas                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `reserve(taskId, cost)` valida disponibilidad (global + stockpiles − reservas)
2) `consume(taskId)` → paga desde stockpiles (`InventorySystem`) y borra reserva
3) `release(taskId)` → cancela reserva sin pagar
4) `cleanupStaleReservations(maxAgeMs)` o `update()` periódico

## 📡 Integración

- `GovernanceSystem`: reserva/consume para proyectos
- `NeedsSystem`: limpia reservas al satisfacer necesidades críticas
- `InventorySystem`: fuente de stockpiles para pago

---

### Casuística y Garantías

- **Cálculo real de disponibilidad.** `getAvailableResources(includeReserved)` suma `GameState.resources.materials` más los stockpiles globales (`InventorySystem.getSystemStats()`) y, salvo que se solicite lo contrario, descuenta todas las reservas activas antes de responder.
- **Reservas únicas por tarea.** `reserve(taskId, cost)` rechaza duplicados porque `reservations` es un `Map` indexado por taskId. También valida fondos mediante `hasSufficientResources`, lo que evita sobrereservar stockpiles.
- **Consumo atómico.** `consume(taskId)` llama a `pay()` (carga desde stockpiles/global) y sólo elimina la reserva si el pago fue exitoso; cualquier excepción deja la reserva intacta y se loggea para investigación.
- **Limpieza reactiva.** Además del `update()` cada 60 s (limpieza estándar), el sistema escucha `NEED_SATISFIED` para hambre/sed y ejecuta `cleanupStaleReservations(2 min)` cuando una necesidad crítica se resuelve de forma emergente.
- **Visibilidad en tiempo real.** Cada mutación (`reserve`, `consume`, `release`, `cleanup`) invoca `broadcastUpdate()` para que monitores/UI puedan reflejar cuántos recursos están bloqueados.

---

## 📌 Resumen Operativo

ResourceReservationSystem actúa como contabilidad paralela entre `GameState.resources` y los stockpiles del `InventorySystem`, bloqueando recursos para tareas y liberándolos cuando se consumen o caducan. Los flujos descritos coinciden con la implementación en `src/domain/simulation/systems/economy/ResourceReservationSystem.ts`.
