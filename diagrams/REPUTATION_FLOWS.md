# ⭐ Sistema de Reputación — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPUTATION SYSTEM                                  │
│                                                                              │
│  Trust edges (a↔b)  → updateTrust() → decay → clamp                          │
│  Reputation (agent) → updateReputation() → history                           │
│                                                                              │
│  Escucha/Emite: GameEvents.REPUTATION_UPDATED                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Ciclo

1) `update()` (1s+):
- Decaimiento suave hacia valor neutral (0.5) de trust y reputation
- Cálculo de estadísticas (agentes, promedio)

2) Mutaciones puntuales:
- `updateTrust(a,b,delta)` y `updateReputation(agent,delta,reason)`
- Guarda historial acotado por agente
- Emite `REPUTATION_UPDATED` cuando hay cambios

## 📡 Integración

- `SocialSystem`: puede consultar trust para formar grupos/relaciones
- `Combat/Social`: cambios por daño/interacciones pueden ajustar reputation

---

## 📌 Validación

- `src/domain/simulation/systems/social/SocialSystem.ts`: gestiona tanto los edges de trust (`edges`, `addEdge`, `getAffinityBetween`) como `updateReputation`, `getReputation` y el historial (`reputationHistory`), confirmando el flujo descrito.
- El decaimiento hacia el valor neutral se ejecuta dentro de `update()` del mismo archivo y se emite `GameEventType.REPUTATION_UPDATED`, validando la integración indicada.
