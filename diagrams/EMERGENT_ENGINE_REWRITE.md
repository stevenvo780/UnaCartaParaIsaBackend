# 🌌 Motor de Simulación Emergente v1 — Diseño Unificado (CPU/GPU, Million‑Scale)

Documento maestro que sintetiza el rediseño emergente desde cero con la extensión HPC para millones de entidades aparentes. Mantiene reglas locales simples y permite dinámicas complejas vía estigmergia, reacción‑difusión y flow fields; con presupuestos por tick, multiresolución y GPU opcional.

---

## 🎯 Objetivos

- Simplicidad local, complejidad global: reglas deterministas y baratas en celdas/vecindarios que produzcan patrones ricos (rutas, asentamientos, comercio, conflicto).
- Rendimiento predecible: presupuesto fijo por tick, chunks, multirate; estable con miles de celdas y cientos/miles de microagentes.
- Escalado a millones aparentes: representación densitaria + flow fields + GPU + descomposición de dominio.
- Extensibilidad: añadir mecánicas = añadir campo + 1–2 reglas locales (sin planners por agente).
- Observabilidad y auto‑tuning: métricas, termostatos de estabilidad y escenarios reproducibles.

---

## 🧠 Principios de Diseño

- Campos como primera clase: capas discretas (Float32/f16) actualizadas por kernels locales (difusión, decaimiento, reacción, potenciales).
- Agentes minimalistas: decisiones por gradientes locales (8 vecinos). A* solo para viajes largos puntuales.
- Estigmergia: coordinación por rastros/demanda/peligro; no por árboles/planificadores complejos.
- Multiescala: campos finos (movimiento/consumo) y gruesos (economía/clima/social).
- Chunks + halos: dominio particionado con intercambio de bordes para kernels.

---

## 🗺️ Modelo de Mundo por Campos

### Capas Base (por celda)

- `food`, `water`, `danger`, `trail`, `visited`, `cost`.
- Economía/logística: `inventory[item]` (densitario), `demand[item]`, `labor`.
- Asentamiento/social: `habitat`, `trust`, `governance`, `hostility`.

Representación: SoA por chunk con doble buffer por campo. Tipos f16 para capas suaves; f32 para acumuladores.

### Reglas Locales

- Difusión + decaimiento (9 vecinos): `F' = F + α·Laplace(F) − k·F + fuentes − sumideros`.
- Crecimiento logístico (vegetación): `F += r·F·(1 − F/K) − consumo`.
- Agua con sesgo por pendiente (difusividad anisotrópica).
- Reacción/producción: `outputs += τ·min(inputs)` o cinética `k·A^m·B^n − decay`.
- Trails: depósito por paso + difusión/decay.

### Flow/Potential Fields (Navegación Masiva)

- Potencial: `P = w_cost·cost − w_trail·trail − w_food·food − w_water·water + w_danger·danger`.
- Vector de flujo = ∇(−P) (Sobel 3×3). 
- Distance/nearest fields multi‑fuente:
  - CPU: Brushfire/BFS multi‑fuente por chunk + halo.
  - GPU: Jump Flooding Algorithm (JFA) o Fast Sweeping Method (Eikonal).
- Recalcular parcialmente cuando cambian fuentes (stockpiles/agua) o cada N ticks.

### Multiresolución

- Pirámide (1×, 1/2×, 1/4×): economía/social/clima en baja resolución; movimiento/consumo en 1×.
- Down/upsample con filtros bilineales rápidos o compute GPU.

---

## 🧍 Representación Híbrida y Agentes

### Densidad + Microagentes

- `agent_density` por celda simula la mayoría (millones aparentes) vía ecuaciones de flujo hacia el flow field.
- Microagentes se “materializan” solo en hotspots (proyectos, combate, UI, eventos raros). Promoción/democión dinámica según interés local.

### Estado mínimo (micro)

- `pos(x,y)`, `energía`, `inv[slots]`, `dir preferida`, `seed`.

### Movimiento por gradiente (micro)

`score = +w_food·food + w_water·water + w_trail·trail − w_danger·danger − w_cost·cost − w_visited·visited + ruido`

- Elige mejor vecino (8 direcciones). Sin A* para explorar; A* limitado para objetivos lejanos.
- Deposita `trail` y aumenta `visited` al moverse.

### Vida y reproducción (densitario y micro)

- Consumo local reduce `food/water`; `energía += ingesta − gasto`.
- Muerte si `energía ≤ 0`; reproducción si `energía ≥ θ` y `habitat` alto.

### Animales

- Depredador‑presa densitario (Lotka‑Volterra discretizado) o micro livianos con reglas idénticas a agentes.

---

## 🏭 Economía y Logística Emergente

### DSL de Reacciones (JSON)

```json
{
  "reactions": [
    { "id": "wood_to_planks", "inputs": {"wood": 1}, "outputs": {"plank": 0.7}, "rate": 0.02,
      "requires": {"labor": 0.1, "building:workbench": true} },
    { "id": "ore_to_metal", "inputs": {"ore": 1, "charcoal": 0.5}, "outputs": {"metal": 0.6}, "rate": 0.01,
      "requires": {"labor": 0.2, "building:furnace": true} }
  ]
}
```

### Producción por celda

- Inputs en vecindad + `labor` → avanza reacción; genera outputs y consume inputs.
- `demand[item]` difunde desde consumidores (hogares/edificios) y atrae carriers.

### Stockpiles y carriers

- Stockpiles = celdas con `inventory[item]` densitaria.
- Carriers densitarios siguen `∇demand[item] − ∇cost` y transportan masa discretamente. Microcarriers solo en escenas detalladas.

---

## 🧱 Construcción Emergente

`build_potential = f(habitat + demand[vivienda|producción] + material_near + labor − danger − cost)`

- Si supera umbral, nace proyecto con `progress` (campo). `progress` crece por `labor` + llegada de materiales. Al completarse, habilita modificadores de campo (eficiencia, seguridad, producción).

---

## 👥 Social, Gobernanza y Conflicto

- `trust` difunde en clusters y sube por co‑trabajo/vecindad; baja con escasez/daño.
- `governance` redirige fracción de `labor` a proyectos públicos; reduce `hostility` con sanciones.
- `hostility` sube por competencia/ densidad; al pasar umbral genera eventos de conflicto (daño local, dispersión).

---

## 🌦️ Tiempo y Clima

- Día/noche y estaciones (multires) modulan consumo/crecimiento/peligros y tasas de reacciones.

---

## ⏱️ Scheduler, Chunks y Dominio Distribuido

### Multi‑rate + Presupuestos

- FAST (20–50 ms): movimiento (densitario y micro), consumo, depósitos `trail/visited`, conflictos locales.
- MEDIUM (250 ms): difusión/decay `trail/visited/danger`, carriers, stockpiles.
- SLOW (1 s): reacciones economía (1/2–1/4), `demand[item]`, social/gobierno, clima.
- Presupuestos: `maxCellsPerTickPerKernel`, `maxKernelsPerTick`. Ronda por chunks (“dirty‑first”). Pausas cooperativas entre lotes largos.

### Descomposición de dominio (chunks + halo)

- Chunks (p.ej. 64×64). Cada worker procesa un set. Intercambio de halos (1–2 celdas) por kernel.
- Barreras ligeras cuando un paso exige datos de borde frescos (difusión/flow fields).

### Multi‑proceso/GPU y balanceo

- Maestro/Workers con IPC de memoria compartida o RPC binario.
- Balanceo dinámico: migrar regiones “calientes” (alta actividad/densidad) a GPU o a workers menos cargados.

### Distribuido multi‑nodo (opcional)

- Sharding espacial por nodos; replicación ligera de halos; colas para migración de microagentes entre nodos.

---

## ⚙️ CPU vs GPU y Memoria

### CPU (por defecto)

- SoA, indexación plana `i = x + y*W`, kernels 9‑vecinos sin ramas; doble buffer; excelente localidad de caché.

### GPU (WebGPU/TFJS)

- Kernels compute: `diffuse_decay`, `compose_potential`, `jump_flooding` / `fast_sweeping`, `gradient_to_flow`, `react`, `downsample/upsample`.
- Activación lazy al cruzar umbrales (nº campos/chunks activos). 
- Cuantización a f16 para capas suaves; mantener acumuladores en f32.

### Presupuesto de memoria (ejemplo 4096×4096)

- 16.8M celdas × 8 campos f16 ≈ 256 MB; doble buffer + flow vec2 f16 ≈ +512 MB → ~768 MB.
- Microagentes (si 1e6 simultáneos): SoA ~ 32–48 MB. Preferir densidades por defecto.

---

## 🧩 Arquitectura de Código

- `FieldEngine`: campos por chunk, dobles buffers, kernels, multires y presupuestos; API `step({budget})`.
- `FlowFieldEngine`: potentials, JFA/FSM, gradientes; rebuild parcial con marcas sucias.
- `ChunkManager`: ciclo de vida de buffers; worldgen; actividad (activar/desactivar campos).
- `AgentLayer`: densidades y microagentes/carriers; promoción/democión.
- `EconomyLayer`: DSL, reacciones, stockpiles y demanda.
- `EventBus/Metrics`: métricas por kernel/chunk/worker; termostatos.
- `Snapshotter`: snapshots compactos (submuestreo campos + entidades visibles) para UI/WS.

### API (borrador)

```ts
const engine = new FieldEngine({ chunkSize: 64, tileSize: 32, gpu: 'auto' });
engine.addField('food', { diffusion: 0.18, decay: 0.01, init: fromBiome });
engine.addField('trail', { diffusion: 0.08, decay: 0.05 });
engine.addField('visited', { diffusion: 0.0, decay: 0.02 });

engine.step({
  fastBudget: { cells: 200_000 },
  mediumBudget: { cells: 100_000 },
  slowBudget: { kernels: 50 },
});

engine.sampleNeighborhood('food', x, y); // 3×3
engine.deposit('trail', x, y, 0.05);
flow.sampleVector(x, y); // dirección de flujo
```

---

## 🔬 Instrumentación y Auto‑Tuning

- Métricas: `tick_ms p50/p95`, `cells_updated`, `%gpu`, `debt_queue`, `halo_bytes`, `flow_rebuilds`, `mortalidad`, `nacimientos`, `stockouts`, `throughput_reacciones`, `dist_viajes`, `cluster_count`.
- Termostatos:
  - Si `tick_p95 > SLA` → bajar α (difusión), subir cadencias SLOW, aumentar submuestreo micro.
  - Si `gpu_util < 30%` y `cells_ready > 2×budget` → subir tamaño de lotes.
  - Si `mortalidad↑` y `water↓` → más peso `water` y menor radio de exploración temporal.

---

## 🧪 Escenarios y KPIs

- Colonización: agua/food descubiertos, rutas emergen, primer asentamiento.
- Crecimiento sostenido: baja mortalidad, rutas densas, economía estable.
- Shock de recursos: caída `food` → reasignación a primario, recuperación.
- Conflicto local: `hostility`↑ → daño y re‑asentamiento.
- Stress 1e6: densidades masivas + 100–1000 microagentes; 200+ chunks activos.

KPIs: estabilidad `tick_ms`, población, nacim/muertes, % stockouts, throughput reacciones, distancia media de viajes, entropía de rutas, tamaño de clusters sociales.

---

## 🗺️ Roadmap

1) Núcleo: campos + gradiente + consumo (CPU) → trails/visited, chunks, métricas.
2) Economía/logística: DSL, `demand[item]`, stockpiles/carriers, construcción por potencial.
3) Social/gobierno/clima: `trust/governance/hostility`, proyectos públicos, estaciones.
4) GPU/flow fields: JFA/FSM, potentials y gradientes; activación por umbral; auto‑tuning.
5) Multi‑proceso/distribuido: workers, halo IPC, balanceo.

---

## 📎 Anexo A — Pseudocódigo Kernels CPU

```ts
function diffuseDecay(F: F32, out: F32, W: number, H: number, a: number, k: number) {
  for (let y=1; y<H-1; y++) for (let x=1; x<W-1; x++) {
    const i = x + y*W, c=F[i];
    const n=F[i-W], s=F[i+W], w=F[i-1], e=F[i+1], nw=F[i-W-1], ne=F[i-W+1], sw=F[i+W-1], se=F[i+W+1];
    const lap = n+s+e+w+nw+ne+sw+se - 8*c;
    out[i] = c + a*lap*0.125 - k*c;
  }
}

function stepAgent(a: Agent, fields: Fields) {
  let best=-1e9, bx=a.x, by=a.y;
  for (const [dx,dy] of dirs8) {
    const x=a.x+dx, y=a.y+dy, i=idx(x,y);
    const score = wF*food[i] + wW*water[i] + wT*trail[i] - wD*danger[i] - wC*cost[i] - wV*visited[i] + jitter(a.seed);
    if (score>best) { best=score; bx=x; by=y; }
  }
  a.x=bx; a.y=by; trail[idx(bx,by)] += deposit; visited[idx(bx,by)] += stepVis;
}
```

---

## 📎 Anexo B — Pseudocódigo GPU (WGSL conceptual)

```wgsl
// compose_potential.wgsl
@group(0) @binding(0) var<storage, read> cost: array<f16>;
@group(0) @binding(1) var<storage, read> trail: array<f16>;
@group(0) @binding(2) var<storage, read> food: array<f16>;
@group(0) @binding(3) var<storage, read> water: array<f16>;
@group(0) @binding(4) var<storage, read> danger: array<f16>;
@group(0) @binding(5) var<storage, read_write> potential: array<f16>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x + gid.y * WIDTH;
  let p = 0.8*cost[i] - 0.5*trail[i] - 1.0*food[i] - 0.6*water[i] + 1.2*danger[i];
  potential[i] = f16(p);
}
```

```wgsl
// gradient_to_flow.wgsl (Sobel 3×3 simplificado)
// flow[i] = normalize(-∇P)
```

---

## 📎 Anexo C — Parámetros Sugeridos

- `trail`: α=0.08, k=0.05, depósito=0.05; `visited`: α=0.00, k=0.02.
- `food`: r=0.02, K=1.0, consumo≤0.03/tick; `water`: α=0.15, k=0.01.
- Pesos movimiento: wF=1.0, wW=0.6, wT=0.5, wD=1.2, wC=0.8, wV=0.3.
- Reproducción: energía≥0.9 y habitat≥0.6; muerte: energía≤0.0.
- Presupuestos iniciales: FAST=200k celdas, MED=100k, SLOW=50 kernels.

---

## 🧮 Complejidad y Escalado

- Kernels: O(celdas_actualizadas) con constantes pequeñas; locality alta. 
- Agentes micro: O(N) con 8 lecturas/step; sin A* en hot path.
- GPU: O(celdas) por despacho; amortizable con workgroups 16×16 y f16.

---

## ✅ Resultado Esperado

Rutas y asentamientos emergen por `trail + cost`; economía fluye por gradientes de `demand`; proyectos aparecen donde la combinación habitat/demanda/labor supera umbral; la sociedad se cohesiona o fragmenta según `trust/hostility`. Todo con ticks estables por presupuesto, escalable a millones aparentes vía densidades + flow fields + GPU.

