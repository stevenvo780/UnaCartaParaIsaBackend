# 🕊️ Sistema de Resolución de Conflictos — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONFLICT RESOLUTION / NORMS SYSTEM                        │
│                                                                              │
│  Combat hits → truce proposal (cards) → resolveConflict(choice)               │
│  Norm violations → sanctions/guard dispatch                                   │
│  History (conflicts, mediations), stats                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Golpes de combate (`COMBAT_HIT`):
- Evalúa `lowHealth/heavyHit/default` → chance de tregua
- Crea `cardId`, guarda intento (`mediationAttempts`) y emite `CONFLICT_TRUCE_PROPOSED`

2) Resolución `resolveConflict(cardId, choice)`:
- `TRUCE_ACCEPT` o `APOLOGIZE` → bonus social y evento (historia)
- Actualiza estado y limpia tarjeta activa

3) Normas (zonas protegidas, etc.):
- Detección de violaciones → sanciones y dispatch de guardias (si aplica)
- Registra en `sanctionHistory`/`guardDispatches`

## 📡 Integración

- `CombatSystem`: fuente de `COMBAT_HIT`
- `Reputation/Social`: efectos colaterales por sanciones/treguas
- `Governance`: coordinación con fuerzas/zonas según políticas

---

## 📌 Validación

- `src/domain/simulation/systems/conflict/ConflictResolutionSystem.ts`: define `truceCards`, `mediationAttempts`, `sanctionHistory` y los métodos `handleCombatHit()`, `resolveConflict()` y `handleCombatInZone()` que ejecutan exactamente el flujo descrito.
- Los eventos `CONFLICT_TRUCE_PROPOSED` y las sanciones/dispatch de guardias se emiten desde este archivo, consumidos por sistemas sociales/gubernamentales como se documenta.
- Integración con `CombatSystem` está codificada a través de `simulationEvents.on(GameEventType.COMBAT_HIT, ...)`, verificando que las fuentes/destinatarios del diagrama son reales.
