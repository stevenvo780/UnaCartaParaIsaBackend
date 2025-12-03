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

