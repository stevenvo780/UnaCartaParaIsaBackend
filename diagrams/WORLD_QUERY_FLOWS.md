# 🔎 WorldQuery Service — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORLD QUERY SERVICE                                 │
│                                                                              │
│  Facade: resources, animals, agents, tiles, zones                            │
│  API: findNearest*, find*InRadius, getTileAt, findTilesInArea                │
│  deps: WorldResourceSystem, AnimalRegistry, AgentRegistry, TerrainSystem     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Uso típico

- IA: buscar agua/comida/objetivos cercanos
- Construcción: validar áreas y terrenos
- Combate/Social: proximidad de agentes/animales

## ⚙️ Rendimiento

- Apalanca `SharedSpatialIndex` reconstruido por tick
- Para lotes masivos, combinar con `GPUBatchQueryService` (distancias)

