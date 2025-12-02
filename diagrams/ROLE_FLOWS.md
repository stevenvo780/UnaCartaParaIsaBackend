# 🧰 Sistema de Roles — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               ROLE SYSTEM                                     │
│                                                                              │
│  Definiciones → Elegibilidad → Asignación/Turnos → Emisiones de trabajo      │
│                                                                              │
│  deps: GameState, AgentRegistry (opcional), Time/WorkShift                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Definiciones (`ROLE_DEFINITIONS`):
- Requisitos (edad, rasgos), eficiencia, recursos principales, turnos

2) Asignación:
- Manual o por `GovernanceSystem` (demandas)
- Prioriza agentes idle y afines a requisitos/rasgos

3) Turnos (WorkShift):
- Habilita tareas (`GATHER`, `BUILD`, `HUNT`, etc.) en ventanas horarias

## 📡 Integración

- `AISystem`: recibe tareas derivadas del rol
- `GovernanceSystem`: asignación reactiva por demanda
- `Production/Economy`: impactos de productividad

