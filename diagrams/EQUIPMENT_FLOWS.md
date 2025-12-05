# 🪓 Sistema de Equipamiento y Herramientas — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EQUIPMENT SYSTEM                                    │
│                                                                              │
│  Per-agent equipment (slots) + Shared tool storage                           │
│  equip/unequip/get stats, claim/return tools, autoEquipForRole               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `equipItem/unequipItem/getMainHandStats/getAttackRange` por agente
2) Pool de herramientas compartidas:
- `depositTool`, `hasToolInStorage`, `claimTool`, `returnTool`
- `findToolForRole`, `roleRequiresTool`, `hasAnyWeapon`
3) Serialización: `serialize/deserialize`, consultas de estado

## 📡 Integración

- `EnhancedCraftingSystem`: deposita armas/herramientas o equipa
- `RoleSystem/CombatSystem`: consulta herramientas equipadas/arma principal

---

## 📌 Validación

- `src/domain/simulation/systems/agents/EquipmentSystem.ts`: expone `equipItem`, `unequipItem`, `getMainHandStats`, `depositTool`, `claimTool`, `autoEquipForRole` y los métodos de serialización mencionados.
- El pool de herramientas se gestiona en este archivo (`toolStorage`, `claimTool`, `returnTool`), confirmando el flujo descrito.
- Integraciones con `EnhancedCraftingSystem` y `CombatSystem` se realizan mediante llamadas directas a este sistema para equipar armas o consultar stats, asegurando que la documentación refleja el comportamiento real.
