# 🌳 Sistema de Genealogía — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GENEALOGY SYSTEM                                    │
│                                                                              │
│  registerBirth → familyTree (ancestors,lineages,relationships) → snapshot     │
│  recordDeath   → livingMembers--, history                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `registerBirth(agent, fatherId?, motherId?)`:
- Hereda `lineageId` de padre/madre o crea nueva línea
- Actualiza ancestors/lineage y graba evento en historial

2) `recordDeath(agentId)`:
- Quita de `livingMembers`, incrementa `totalDied`, agrega evento

3) Snapshots/serialización:
- `getSerializedFamilyTree()` para front (mapas → arrays/records)

## 📡 Integración

- `LifeCycleSystem`: llama a birth/death
- `Reputation/Social`: pueden visualizar relaciones familiares

