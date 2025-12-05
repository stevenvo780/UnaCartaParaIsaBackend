# 🎁 Sistema de Generación de Ítems — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ITEM GENERATION SYSTEM                               │
│                                                                              │
│  Reglas (catálogo) → processZoneGeneration → tryGenerateItem/respawn          │
│                                                                              │
│  deps: BaseMaterialsCatalog, GameState (zones)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Inicializa reglas desde `BaseMaterialsCatalog` (mapeo biome→zoneType)
2) `update()` cada `generationIntervalSec` por zona:
- Evalúa reglas, respawn si corresponde, respeta `maxItemsPerZone`
3) Emite `ITEM_GENERATED` al crear y `ITEM_COLLECTED` al recolectar
4) API: `forceSpawnItem`, `addGenerationRule`, `clearZoneItems`, consultas

## 📡 Integración

- `RecipeDiscoverySystem`: puede basarse en materiales disponibles por bioma
- Agentes/IA: recolectan via zonas; produce recursos para Economy/Crafting

---

## 📌 Validación

- `src/domain/simulation/systems/world/ItemGenerationSystem.ts`: define `processZoneGeneration`, `tryGenerateItem`, `forceSpawnItem`, `addGenerationRule`, `clearZoneItems` y los eventos `ITEM_GENERATED/ITEM_COLLECTED`, confirmando el flujo descrito.
- El catálogo base (`BaseMaterialsCatalog`) se usa directamente en este archivo para inicializar reglas según bioma/zoneType, validando la dependencia documentada.
