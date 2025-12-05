# 👥 Sistema Social — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               SOCIAL SYSTEM                                  │
│                                                                              │
│  Edges (afinidad)  →  Proximidad  →  Reforzamiento/Decaimiento               │
│  Permanent bonds   →  Grupos      →  Truces/conflictos (señales)             │
│                                                                              │
│  deps: SharedSpatialIndex, GPUComputeService (opcional), EntityIndex         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Ciclo

1) `update(dt)`:
- Actualiza proximidad (5 Hz aprox.)
- Decaimiento de afinidad (cada 2s; GPU opcional si hay muchas aristas)
- Recalcula grupos cuando hay cambios relevantes
- Sincroniza `socialGraph` al `gameState`

2) Enlaces permanentes (family/marriage):
- Reducen decaimiento (bono) y fijan afinidades base

## 📡 Eventos

- Escucha: `MARRIAGE_ACCEPTED`, `DIVORCE_COMPLETED` → modifica afinidades
- Emite: sincronización de `socialGraph` (dirty tracker)

## 🤝 Integración

- `MarriageSystem`: crea/remueve bonds permanentes
- `ReputationSystem`: puede influir en afinidades/decisiones
- `ConflictResolutionSystem`: señales para treguas/relaciones

## ⚙️ Rendimiento

- GPU opcional para decaimiento de grandes grafos (buffers `Float32Array`)
- Edges con |valor| < minAffinity → clamp a 0 para evitar trabajo innecesario

---

## 📌 Validación

- `src/domain/simulation/systems/social/SocialSystem.ts`: contiene `update`, la integración con `SharedSpatialIndex`, `GPUComputeService`, los listeners de matrimonios/divorcios y la sincronización de `socialGraph`, validando el comportamiento descrito.
- El decaimiento de afinidad, grupos permanentes y la sincronización con `gameState` están implementados en ese archivo, confirmando la documentación.
