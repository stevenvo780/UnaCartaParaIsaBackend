# 💰 Sistema de Economía — v4

## 📊 Arquitectura del Sistema de Economía

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ECONOMY SYSTEM STACK                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        EconomySystem (Orchestrator)                      ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ ││
│  │  │ yieldResiduals │  │ config         │  │ lastSalaryPayment          │ ││
│  │  │ Map<string,num>│  │ EconomyConfig  │  │ timestamp tracking         │ ││
│  │  └────────────────┘  └────────────────┘  └────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────┐           │
│         ▼                           ▼                           ▼           │
│  ┌────────────────┐     ┌────────────────┐         ┌────────────────────┐   │
│  │InventorySystem│     │  SocialSystem  │         │    RoleSystem      │   │
│  │ addResource   │     │ getGroupForAgent│         │  getAgentRole      │   │
│  │ removeFromAgt │     │ teamBonus calc │         │  salary modifiers  │   │
│  └────────────────┘     └────────────────┘         └────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Money Management                                 ││
│  │  ┌────────────┐  ┌────────────────┐  ┌─────────────┐  ┌──────────────┐  ││
│  │  │ getMoney() │  │ addMoney()     │  │removeMoney()│  │transferMoney │  ││
│  │  │ canAfford()│  │ MONEY_CHANGED  │  │validation   │  │atomic ops    │  ││
│  │  └────────────┘  └────────────────┘  └─────────────┘  └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      Production & Work System                            ││
│  │  ┌────────────────────────┐  ┌────────────────────────────────────────┐ ││
│  │  │ handleWorkAction()     │  │ computeTeamBonus()                     │ ││
│  │  │ zone → resourceType    │  │ - Group members in zone +5% each       │ ││
│  │  │ role → yield modifier  │  │ - Max bonus: 50%                       │ ││
│  │  │ yieldResiduals tracking│  │ - Role specialization bonuses          │ ││
│  │  └────────────────────────┘  └────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Trabajo Económico

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EconomySystem.update(delta)                               │
│                                                                              │
│  1. INTERVAL CHECK (cada 10 segundos)                                       │
│     ├── cleanupOldResiduals() - Limpia map si > 100 entradas               │
│     └── updateEconomyStats() - Actualiza estadísticas globales             │
│                                                                              │
│  2. SALARY PAYMENT (cada 60 segundos)                                       │
│     └── processSalaryPayments()                                             │
│           ├── Por cada agente vivo con rol:                                 │
│           │     ├── FARMER/QUARRYMAN/LOGGER: 15 monedas                    │
│           │     ├── BUILDER/CRAFTSMAN: 20 monedas                          │
│           │     └── GUARD/LEADER: 25 monedas                               │
│           └── Emit SALARY_PAID event                                        │
│                                                                              │
│  3. WORK ACTION (on-demand via handleWorkAction)                            │
│     ├── Zone validation                                                     │
│     ├── Resource type determination                                         │
│     ├── Team bonus calculation                                              │
│     ├── Role specialization bonus                                           │
│     ├── Yield residual tracking                                             │
│     ├── Add to inventory (or global if full)                               │
│     └── Pay salary based on yield                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS DE ECONOMÍA                                 │
│                                                                              │
│  EMISIÓN:                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  EconomySystem.updateEconomyStats()                                         │
│    └── ECONOMY_RESERVATIONS_UPDATE { economy, timestamp }                   │
│                                                                              │
│  EconomySystem.processSalaryPayments()                                      │
│    └── SALARY_PAID { agentId, amount, role, timestamp }                     │
│                                                                              │
│  EconomySystem.addMoney()                                                   │
│    └── MONEY_CHANGED { agentId, amount, newBalance, type: "add" }           │
│                                                                              │
│  EconomySystem.removeMoney()                                                │
│    └── MONEY_CHANGED { agentId, amount, newBalance, type: "remove" }        │
│                                                                              │
│  EconomySystem.transferMoney()                                              │
│    └── MONEY_TRANSFERRED { fromId, toId, amount, timestamp }                │
│                                                                              │
│  INTEGRACIÓN CON OTROS SISTEMAS:                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ResourceReservationSystem                                                   │
│    └── ECONOMY_RESERVATIONS_UPDATE (reservaciones de recursos)              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes del Sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| EconomySystem → GameState | ✅ Conectado | @inject(TYPES.GameState) |
| EconomySystem → InventorySystem | ✅ Conectado | @inject(TYPES.InventorySystem) |
| EconomySystem → SocialSystem | ✅ Conectado | @inject(TYPES.SocialSystem) |
| EconomySystem → EntityIndex | ✅ Conectado | @inject @optional |
| EconomySystem → AgentRegistry | ✅ Conectado | @inject @optional |
| EconomySystem → RoleSystem | ✅ Conectado | Via setDependencies() |

### Funcionalidades de Dinero

| Función | Estado | Descripción |
|---------|--------|-------------|
| getMoney() | ✅ Funcional | Retorna balance del agente |
| canAfford() | ✅ Funcional | Valida si puede pagar |
| addMoney() | ✅ Funcional | Añade dinero + evento |
| removeMoney() | ✅ Funcional | Remueve dinero + validación |
| transferMoney() | ✅ Funcional | Transferencia atómica |

### Zonas de Trabajo

| Zona | Recurso | Base Yield | Estado |
|------|---------|------------|--------|
| WORK (wood) | wood | 1.5 | ✅ |
| WORK (stone) | stone | 1.0 | ✅ |
| FOOD | food | 2.0 | ✅ |
| WATER | water | 3.0 | ✅ |

### Salarios por Rol

| Rol | Salario Base | Bonus de Especialización | Estado |
|-----|-------------|-------------------------|--------|
| FARMER | 15 | +50% en FOOD | ✅ |
| QUARRYMAN | 15 | +80% en STONE | ✅ |
| LOGGER | 15 | +60% en WOOD | ✅ |
| BUILDER | 20 | +30% en WOOD/STONE | ✅ |
| CRAFTSMAN | 20 | - | ✅ |
| GATHERER | 10 | +30% en WATER/FOOD | ✅ |
| GUARD | 25 | - | ✅ |
| LEADER | 25 | - | ✅ |

### Flujo de Eventos

| Evento | Emisor | Receptor | Estado |
|--------|--------|----------|--------|
| ECONOMY_RESERVATIONS_UPDATE | EconomySystem | Client, UI | ✅ |
| SALARY_PAID | EconomySystem | Client, Stats | ✅ |
| MONEY_CHANGED | EconomySystem | Client, UI | ✅ |
| MONEY_TRANSFERRED | EconomySystem | Client, Stats | ✅ |

---

## 🔍 ANÁLISIS DETALLADO

### Optimizaciones Implementadas

1. **Yield Residuals**
   - Acumulación de fracciones para producción precisa
   - Cleanup automático cuando Map > 100 entradas
   - Evita pérdida de recursos por redondeo

2. **Team Bonus System**
   - Bonus cooperativo por trabajar en grupo
   - Max 50% bonus (10 miembros = máximo)
   - Integración con SocialSystem.getGroupForAgent()

3. **Role Specialization**
   - Bonuses específicos por rol y recurso
   - FARMER en FOOD: +50%
   - QUARRYMAN en STONE: +80%
   - LOGGER en WOOD: +60%

4. **Salary Payment Batching**
   - Procesamiento cada 60 segundos
   - Evita overhead de pagos individuales

### Puntos de Integración

| Sistema | Integración | Estado |
|---------|-------------|--------|
| InventorySystem | addResource(), removeFromAgent() | ✅ |
| SocialSystem | getGroupForAgent() | ✅ |
| RoleSystem | getAgentRole() | ✅ |
| EntityIndex | getEntity() | ✅ |
| AgentRegistry | getAllProfiles() | ✅ |

---

### 1. Fallback a Recursos Globales (Severidad: Info)

**Ubicación:** `EconomySystem.handleWorkAction()` - línea 243

**Código:**
```typescript
if (amount > 0) {
  const added = this.inventorySystem.addResource(agentId, resourceType, amount);
  if (!added) {
    this.addToGlobalResources(resourceType, amount);
  }
}
```

**Observación:** Si el inventario del agente está lleno, los recursos van al pool global.

**Análisis:** Diseño intencional - los recursos no se pierden.

**Estado:** ✅ Diseño correcto

### 2. Salario Pagado Incluso Sin Trabajo (Severidad: Info)

**Ubicación:** `EconomySystem.processSalaryPayments()` - línea 168

**Observación:** El salario se paga a todo agente con rol, independientemente de si trabajó.

**Análisis:** Simula un sistema de "salario base" más realista. Los agentes reciben un ingreso mínimo.

**Estado:** ✅ Diseño intencional

### 3. EntityIndex vs GameState Agents (Severidad: Info)

**Ubicación:** `EconomySystem.updateEconomyStats()` - líneas 126-140

**Código:**
```typescript
if (this.agentRegistry) {
  for (const agent of this.agentRegistry.getAllProfiles()) { ... }
} else if (this.state.agents) {
  for (const agent of this.state.agents) { ... }
}
```

**Observación:** Hay dos formas de iterar sobre agentes según disponibilidad de dependencias.

**Análisis:** Fallback graceful para compatibilidad.

**Estado:** ✅ Patrón correcto

---

### Fortalezas del Sistema

- ✅ **Sistema de dinero completo** - getMoney, addMoney, removeMoney, transferMoney
- ✅ **Transferencias atómicas** - Rollback si falla el destinatario
- ✅ **Yield residuals** - Precisión sin pérdida por redondeo
- ✅ **Team bonuses** - Incentiva trabajo cooperativo
- ✅ **Role specialization** - Cada rol tiene ventajas específicas
- ✅ **Salary system** - Ingreso pasivo por rol
- ✅ **Eventos bien definidos** - SALARY_PAID, MONEY_CHANGED, MONEY_TRANSFERRED
- ✅ **Validación de entradas** - Rechaza montos negativos
- ✅ **Integración con sistemas** - InventorySystem, SocialSystem, RoleSystem

### Conectividad General
**Estado: 100% Conectado Correctamente**

Todos los componentes están correctamente conectados:
- EconomySystem → InventorySystem ✅
- EconomySystem → SocialSystem ✅
- EconomySystem → RoleSystem ✅
- EconomySystem → EntityIndex ✅
- EconomySystem → AgentRegistry ✅
- Eventos bidireccionales funcionando ✅

---

## 🎯 CONCLUSIÓN

El sistema de economía está **bien diseñado y completamente funcional**. No se identificaron problemas que requieran corrección. Las observaciones menores son decisiones de diseño válidas.

**Puntuación: 10/10** ✅
