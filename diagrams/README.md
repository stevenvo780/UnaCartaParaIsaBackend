# 📚 Índice de Diagramas — v4

Guía de navegación de los flujos y arquitectura del backend. Cada documento describe el sistema, su ciclo principal, eventos e integraciones.

## General
- [APP_OVERVIEW.md](APP_OVERVIEW.md) — Visión general: arranque, scheduler, HTTP/WS, GPU, monitoreo
- [WORLD_QUERY_FLOWS.md](WORLD_QUERY_FLOWS.md) — Fachada de consultas (recursos/animales/agentes/tiles/zonas)

## IA y Agentes
- [AI_FLOWS.md](AI_FLOWS.md) — IA v4: EventBus → TaskQueue → Handlers → SystemRegistry
- [MOVEMENT_FLOWS.md](MOVEMENT_FLOWS.md) — Movimiento, pathfinding, batch + GPU opcional
- [NEEDS_FLOWS.md](NEEDS_FLOWS.md) — Decay/cross-effects, batch + GPU opcional
- [SHARED_KNOWLEDGE_FLOWS.md](SHARED_KNOWLEDGE_FLOWS.md) — Alertas compartidas de recursos/amenazas
- [AMBIENT_AWARENESS_FLOWS.md](AMBIENT_AWARENESS_FLOWS.md) — Bienestar, estado ambiental y atracción de recursos
- [TASK_FLOWS.md](TASK_FLOWS.md) — Creación, progreso colaborativo, estancamiento y snapshot
- [LIFECYCLE_FLOWS.md](LIFECYCLE_FLOWS.md) — Edad, nacimientos, muertes, vivienda y roles

## Social
- [SOCIAL_FLOWS.md](SOCIAL_FLOWS.md) — Afinidad, grupos, decay (GPU opcional)
- [MARRIAGE_FLOWS.md](MARRIAGE_FLOWS.md) — Propuestas, grupos, cohesión/divorcios
- [REPUTATION_FLOWS.md](REPUTATION_FLOWS.md) — Reputación/trust, decaimiento a neutro
- [HOUSEHOLD_FLOWS.md](HOUSEHOLD_FLOWS.md) — Asignación a hogares, ocupación, inventario compartido
- [GENEALOGY_FLOWS.md](GENEALOGY_FLOWS.md) — Árbol familiar, nacimientos y muertes

## Economía y Producción
- [ECONOMY_FLOWS.md](ECONOMY_FLOWS.md) — Economía, pagos, yields y zonas de trabajo
- [PRODUCTION_FLOWS.md](PRODUCTION_FLOWS.md) — Producción por zonas, depósito y eventos
- [INVENTORY_FLOWS.md](INVENTORY_FLOWS.md) — Inventarios de agente y stockpiles
- [RESOURCE_RESERVATION_FLOWS.md](RESOURCE_RESERVATION_FLOWS.md) — Reservas/consumo/liberación
- [CRAFTING_FLOWS.md](CRAFTING_FLOWS.md) — Crafteo mejorado, éxito y salidas (equipar/depositar)
- [RECIPE_DISCOVERY_FLOWS.md](RECIPE_DISCOVERY_FLOWS.md) — Descubrimiento por bioma y experimentación
- [EQUIPMENT_FLOWS.md](EQUIPMENT_FLOWS.md) — Equipamiento por agente y pool de herramientas

## Mundo
- [WORLDRESOURCE_FLOWS.md](WORLDRESOURCE_FLOWS.md) — Recursos del mundo y grid espacial
- [TERRAIN_FLOWS.md](TERRAIN_FLOWS.md) — Lectura/modificación de tiles
- [CHUNK_LOADING_FLOWS.md](CHUNK_LOADING_FLOWS.md) — Carga dinámica de chunks
- [WORLD_GENERATION_FLOWS.md](WORLD_GENERATION_FLOWS.md) — Capas de ruido, BiomeResolver y oasis de arranque
- [ITEM_GENERATION_FLOWS.md](ITEM_GENERATION_FLOWS.md) — Generación/respawn de ítems por zona
- [TIME_FLOWS.md](TIME_FLOWS.md) — Tiempo y clima, efectos ambientales
- [GOVERNANCE_FLOWS.md](GOVERNANCE_FLOWS.md) — Demandas, políticas y proyectos (roles/reservas)
- [ANIMAL_FLOWS.md](ANIMAL_FLOWS.md) — Registro de animales, estados y batch opcional
- [BUILDING_FLOWS.md](BUILDING_FLOWS.md) — Construcción y mantenimiento
- [COMBAT_FLOWS.md](COMBAT_FLOWS.md) — Detección, distancias y eventos de combate
- [CONFLICT_RESOLUTION_FLOWS.md](CONFLICT_RESOLUTION_FLOWS.md) — Treguas, normas y sanciones

Notas
- GPU opcional: TFJS con lazy‑load; CPU por debajo de umbrales de volumen.
- Todos los flujos siguen terminología v4 (SystemRegistry, WorldQueryService, SharedSpatialIndex).
