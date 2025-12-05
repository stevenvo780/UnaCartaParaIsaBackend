# 📜 Sistema de Descubrimiento de Recetas — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECIPE DISCOVERY SYSTEM                                │
│                                                                              │
│  Biome exploration → attemptBiomeDiscovery → teachRecipe                      │
│  Experimentation → attemptExperimentation → teachRecipe                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Recetas básicas: se inicializan (BASIC_RECIPES)
2) Descubrimiento por bioma:
- 10% de prob. al explorar bioma con recetas → registra en `RecipesCatalog`
3) Experimentación:
- Si ingredientes coinciden con receta, calcula chance y enseña receta
4) Consultas:
- `agentKnowsRecipe`, `getAgentRecipes`, `getAvailableRecipes`

## 📡 Integración

- `EnhancedCraftingSystem`: usa catálogo de recetas y recetas conocidas
- `BiomeRecipesCatalog`: aporta recetas por bioma

---

## 📌 Validación

- `src/domain/simulation/systems/economy/RecipeDiscoverySystem.ts`: implementa `initializeBasicRecipes`, `attemptBiomeDiscovery`, `attemptExperimentation`, `agentKnowsRecipe` y `getAgentRecipes`, siguiendo el flujo documentado.
- `BASIC_RECIPES`, `BiomeRecipesCatalog` y la integración con `EnhancedCraftingSystem` se usan directamente en este archivo, confirmando la relación descrita.
