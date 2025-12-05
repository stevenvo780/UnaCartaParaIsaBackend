# 🕒 Sistema de Tiempo y Clima — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TIME SYSTEM                                      │
│                                                                              │
│  update() → updateTime() (cada 1s) → TIME_CHANGED                             │
│  update() → updateWeather() (intervalo configurado)                           │
│                                                                              │
│  Efectos: fase del día, luz, temperatura; turnos de trabajo (WorkShift)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

- Avance de minutos/jornada en base a `minutesPerGameHour`
- Cálculo de `phase`, `lightLevel`, `temperature` (funciones periódicas)
- Clima cambia según intervalo y probabilidad (`shouldChangeWeather`)
- Emite `TIME_CHANGED` con snapshot

## 📡 Integración

- `RoleSystem` (turnos), `AmbientAwarenessSystem` (mood, música, clima)
- `AISystem` (detectores sensibles al tiempo)

---

## 📌 Validación

- `src/domain/simulation/systems/core/TimeSystem.ts`: contiene `update`, `updateTime`, `updateWeather`, `shouldChangeWeather` y emite `TIME_CHANGED`, confirmando cada punto descrito.
- Las dependencias con `RoleSystem` y `AmbientAwarenessSystem` se realizan mediante el snapshot de `TimeSystem` que consumen esos sistemas, validando la integración mencionada.
