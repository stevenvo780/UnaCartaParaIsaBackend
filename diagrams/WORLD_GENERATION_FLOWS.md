# 🌍 Servicio de Generación de Mundo — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WORLD GENERATION SERVICE                                 │
│                                                                              │
│  initializeGenerators(seed, dims)                                            │
│  generateChunk(x,y,config) → noise layers → BiomeResolver → assets           │
│  (opcional) generateVoronoiWorld()                                           │
│                                                                              │
│  deps: NoiseUtils, BiomeResolver, VoronoiGenerator                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo de `generateChunk`

1) Inicializa generadores con `seed` y valida dimensiones
2) Para cada tile del chunk (16×16):
- Calcula capas de ruido normalizadas [0..1]:
  - temperatura (noise2D a 0.015)
  - humedad (0.02 + offset)
  - elevación (0.025 + offset)
  - continentalidad (0.008)
- Oasis de arranque: fuerza un pequeño `LAKE` cerca de (6,6) para supervivencia
- Si no aplica oasis: `BiomeResolver.resolveBiome(temperature, moisture, elevation, continentality)`
- Genera assets determinísticos por tile (`generateAssetsForTile`) en base a:
  - `SimpleBiomeConfig` (densities, clustering)
  - RNG seed por tile (`seedrandom(`${x},${y}-${seed}`)`)
  - Ruido adicional para clustering/structures
- Marca `isWalkable` según bioma (no walkable: OCEAN/LAKE)

3) Devuelve `TerrainTile[][]` con:
- `biome`, `biomeStrength`, `temperature`, `moisture`, `elevation`, `isWalkable`
- `assets`: `{ terrain: terrain_<biome>, vegetation|props|structures|decals }`

## 🧭 BiomeResolver (resumen)

- Umbrales relajados para promover agua:
  - OCEAN: continentalidad < 0.35
  - LAKE: elevación < 0.48 y humedad > 0.50
  - Primer agua garantizada si aún no hay, con elevación < 0.52

## 🧪 Voronoi (opcional)

- `generateVoronoiWorld`: prepara regiones y asigna biomas (WIP)
- Útil para macro‑regiones; no afecta chunking estándar actual

## 📡 Integración

- `ChunkLoadingSystem`: solicita `generateChunk(x,y,config)` por proximidad a agentes
- `TerrainSystem`: registra tiles generados
- `WorldResourceSystem`/`AnimalSystem`: spawn posterior por chunk

---

## 📌 Validación

- `src/domain/simulation/systems/world/generation/worldGenerationService.ts`: implementa `initializeGenerators`, `generateChunk`, `generateVoronoiWorld` y utiliza `NoiseUtils`, `BiomeResolver`, `seedrandom` y `SimpleBiomeConfig` como se describe.
- `ChunkLoadingSystem` invoca `generateChunk` directamente desde este servicio, validando la integración documentada.
