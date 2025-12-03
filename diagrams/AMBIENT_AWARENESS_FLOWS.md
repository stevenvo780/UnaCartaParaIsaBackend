# 🌡️ Sistema de Conciencia Ambiental — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AMBIENT AWARENESS SYSTEM                                │
│                                                                              │
│  computeWellbeing → computeAmbientState → snapshot                            │
│  updateResourceAttraction (desires/fields/emergencies)                        │
│                                                                              │
│  deps: NeedsSystem, GameState                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `update()`:
- Calcula bienestar colectivo (promedio, varianza, críticos, trend)
- Resuelve `ambientState` (música, luz, partículas, clima sesgado)
- Actualiza `gameState.ambientMood`
- Actualiza atracción de recursos: `desires`, `fields`, `emergencies`, `stats`

2) Umbrales de deseo (NeedType):
- Hunger/Thirst/Energy/Hygiene → mapeo a `ResourceType` y zonas

## 📡 Integración

- `AI/Needs`: señales agregadas para modulación de comportamientos
- `Governance`: señales de crisis (vía otros sistemas) y correlaciones

