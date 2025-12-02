# 🗺️ Sistema de Terreno — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TERRAIN SYSTEM                                    │
│                                                                              │
│  getTile(x,y) / modifyTile(x,y,patch) / propiedades (walkable, biome, asset) │
│  Integrado con generación (ChunkLoading/WorldGen)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Operaciones típicas

- Lectura de tiles para pathfinding y consultas de IA
- Modificaciones visuales (p. ej., GRASS ↔ DIRT por producción/animales)
- Sincronización con tiles generados por `ChunkLoadingSystem`

## 📡 Integración

- `WorldQueryService`: consultas de tiles, filtrado por biome/asset
- `ProductionSystem`/`AnimalSystem`: cambios locales de terreno
- `ChunkLoadingSystem`: alta de tiles por chunk

