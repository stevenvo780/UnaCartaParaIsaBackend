# Economía Autoritativa (Backend)

Este backend ahora incluye la lógica económica que antes residía en el cliente. Componentes clave:

- **Sistema de Favor Divino (`DivineFavorSystem`)**: gestiona poder, bendiciones y multiplicadores para linajes.
- **Sistema de Gobernanza (`GovernanceSystem`)**: analiza estadísticas de la aldea, crea demandas y consume recursos para resolverlas.
- **Reservas de Recursos (`ResourceReservationSystem`)**: evita que múltiples proyectos gasten los mismos materiales.
- **Inventario**: ahora expone métodos para listar y consumir stockpiles, habilitando pagos consistentes.
- **Ciclo de Vida**: permite consultar agentes activos para métricas poblacionales.

> Ejecuta `npm run build` para compilar la nueva lógica. Los eventos expuestos (`GOVERNANCE_UPDATE`, `ECONOMY_RESERVATIONS_UPDATE`, `DIVINE_BLESSING_GRANTED`) pueden consumirse desde otros servicios o websockets.
