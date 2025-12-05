# ⚒️ Sistema de Crafting — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED CRAFTING SYSTEM                               │
│                                                                              │
│  requestCraft/craftBestWeapon → startCrafting → finishJob → applyOutput       │
│                                                                              │
│  deps: InventorySystem, RecipesCatalog, EquipmentSystem, GameState            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `canCraft/hasIngredients` (inv. del agente → stockpiles si falta)
2) `startCrafting(agent, recipeId)` → `CRAFTING_JOB_STARTED` (duración receta)
3) `update()` finaliza jobs vencidos → `finishJob` → éxito según `successRate`
4) `applyOutput`:
- Armas: equipa si libre, si no deposita en `equipmentSystem` (pool de herramientas)
- Otros items: se colapsan a `ResourceType` y se añaden al inventario
5) `CRAFTING_JOB_COMPLETED` + registro de uso (sube success rate)

## 📡 Integración

- `InventorySystem`: ingredientes y depósitos
- `EquipmentSystem`: equipar armas o depositar herramientas
- `RecipeDiscoverySystem`: expone recetas; `knownRecipes` por agente

## 📈 Observabilidad

- Logs por operación, snapshot: `getCraftingSnapshot()` (jobs, recetas, armas equipadas)

---

## 📌 Validación

- `src/domain/simulation/systems/economy/EnhancedCraftingSystem.ts`: implementa `startCrafting`, `update`, `finishJob`, `applyOutput` y los eventos `CRAFTING_JOB_STARTED/COMPLETED`, confirmando cada paso del flujo descrito.
- `InventorySystem` y `EquipmentSystem` se inyectan en ese archivo y se usan para consumir ingredientes/depositar resultados tal como se documenta.
- `RecipeDiscoverySystem` (`src/domain/simulation/systems/economy/RecipeDiscoverySystem.ts`) gestiona `knownRecipes` y expone las recetas requeridas por el sistema de crafting, validando la integración mencionada.
