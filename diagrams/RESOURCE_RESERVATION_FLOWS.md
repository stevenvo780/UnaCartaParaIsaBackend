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

