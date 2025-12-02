# 💍 Sistema de Matrimonio — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARRIAGE SYSTEM                                     │
│                                                                              │
│  Proposals → Accept/Reject → Groups (poly) → Cohesion/Divorces               │
│                                                                              │
│  deps: GameState; escucha AGENT_DEATH                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo

1) Propuesta `proposeMarriage(proposer, target, group?)` → `MARRIAGE_PROPOSED`
2) Aceptar `acceptProposal(target)`:
- Une al grupo del proponente o crea grupo nuevo
- `MARRIAGE_GROUP_FORMED`/`MARRIAGE_MEMBER_JOINED` + `MARRIAGE_ACCEPTED`
3) Rechazar `rejectProposal(target)` → `MARRIAGE_REJECTED`
4) Divorcio `initiateDivorce(agent, group, reason)`:
- `DIVORCE_INITIATED` → ajustes de miembros/cohesión → `DIVORCE_COMPLETED`
5) Muerte `handleMemberDeath` → `WIDOWHOOD_REGISTERED`

## 📡 Eventos

- Emite: `MARRIAGE_*`, `DIVORCE_*`, `WIDOWHOOD_REGISTERED`
- Escucha: `AGENT_DEATH` (limpieza y disoluciones)

## 📈 Cohesión y beneficios

- Cohesión decae levemente con el tiempo y con tamaño del grupo
- Beneficios (moral/productividad/social) en función de cohesión/tamaño

