# 🧠 Sistema de Conocimiento Compartido — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED KNOWLEDGE SYSTEM                                │
│                                                                              │
│  registerResourceFind / registerThreat → alerts → propagate (spatial)         │
│  update() → expiración de alertas                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Registro:
- Recurso: `registerResourceFind(agent, resourceId,type,pos)` → `RESOURCE_DISCOVERED`
- Amenaza: `registerThreat(agent, threatId,type,pos,severity)` → `THREAT_DETECTED`
2) Propagación:
- Con `SharedSpatialIndex`: `queryRadius` (radio por severidad en amenazas)
- Sin índice: calcula distancias cuadradas a agentes en GameState/Registry
3) Consulta:
- `getKnownResourceAlerts(agentId)`, `getKnownThreatAlerts(agentId)`
4) `update()`: expira alertas vencidas; logs/perf `getStats()`

## 📡 Integración

- `AISystem`: detectores se nutren de alertas informadas
- `Social/Governance`: señales ambientales (amenazas/recursos)

---

## 📌 Validación

- `src/domain/simulation/systems/agents/ai/SharedKnowledgeSystem.ts`: implementa `registerResourceFind`, `registerThreat`, `getKnownResourceAlerts`, `getKnownThreatAlerts`, `update` y la propagación vía `SharedSpatialIndex`, coincidiendo con el flujo descrito.
- Los eventos `RESOURCE_DISCOVERED` y `THREAT_DETECTED` son emitidos desde este archivo y consumidos por IA/social/gobernanza.
