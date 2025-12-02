# 🌍 Sistema de Carga de Chunks — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHUNK LOADING SYSTEM                                  │
│                                                                              │
│  Agents (pos) → calculateChunksToLoad() → loadChunk()                         │
│    ├── Terrain tiles (biome, walkable, asset)                                 │
│    ├── Animals (spawn)                                                        │
│    └── World resources (spawn)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) `update()` cada `CHECK_INTERVAL_MS`:
- Obtiene agentes activos (AgentRegistry o GameState)
- Calcula radio de chunks a cargar (LOAD_RADIUS_CHUNKS)
- Carga chunks faltantes (terrain → animals → resources)

2) `initialize(worldConfig)`: fija tamaño de tile/chunk y límites

## 📡 Integración

- `WorldGenerationService`: generación de mosaicos por chunk
- `AnimalSystem` y `WorldResourceSystem`: spawn por chunk
- `TerrainSystem`: alta de tiles con biome/walkable/asset

