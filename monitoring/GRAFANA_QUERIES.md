# Grafana Queries para Métricas de Simulación

## Métricas de Latencia de Tick

### 1. Latencia Actual (Último Tick)
```promql
backend_tick_duration_last_ms
```
Muestra la duración del tick más reciente. Útil para ver variación en tiempo real.

### 2. Latencia Promedio
```promql
backend_tick_duration_ms
```
Promedio acumulado desde el inicio del servidor.

### 3. Máximo en Ventana de 60s (Recomendado para detectar picos)
```promql
backend_tick_duration_recent_max_ms
```
**Este es el más útil para detectar cuellos de botella.** Muestra el peor tick en el último minuto.

### 4. Percentiles con Histograma

```promql
# P50 (mediana) - 50% de los ticks completan en este tiempo
histogram_quantile(0.50, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))

# P95 - 95% de los ticks completan en este tiempo (buen SLO target)
histogram_quantile(0.95, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))

# P99 - Muestra latencia del peor 1%
histogram_quantile(0.99, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))
```

**Importante:** Las queries de percentil requieren `sum(...) by (rate, le)` para funcionar correctamente.

### 5. Percentil para un Rate específico
```promql
# P95 solo para MEDIUM
histogram_quantile(0.95, sum(rate(backend_tick_duration_histogram_ms_bucket{rate="MEDIUM"}[2m])) by (le))
```

### 6. Distribución de Latencias (Heatmap)
```promql
sum(rate(backend_tick_duration_histogram_ms_bucket[1m])) by (le, rate)
```
Para un panel de tipo Heatmap en Grafana.

---

## Detección de Outliers

### 7. Contador de Outliers (tasa por minuto)
```promql
rate(backend_tick_outliers_total[5m]) * 60
```
Tasa de ticks que exceden el umbral (FAST >5ms, MEDIUM >15ms, SLOW >100ms).

### 8. Último Outlier
```promql
backend_tick_last_outlier_ms
```
Duración del último tick que fue outlier.

---

## Identificación de Cuellos de Botella

### 9. Sistema Más Lento en Último Tick
```promql
backend_tick_slowest_system_ms
```
Incluye label `system` para identificar cuál sistema está causando la lentitud.

### 10. Top 10 Sistemas por Latencia Máxima
```promql
topk(10, backend_system_execution_max_ms)
```

### 11. Sistemas con Latencia Alta Reciente
```promql
backend_system_execution_last_ms > 1
```
Sistemas que tomaron más de 1ms en su última ejecución.

---

## Paneles Recomendados para Dashboard

### Panel 1: "Tick Latency Overview"
- Tipo: Time Series
- Queries:
  - `backend_tick_duration_last_ms{rate="MEDIUM"}` (line, verde)
  - `backend_tick_duration_recent_max_ms{rate="MEDIUM"}` (line, rojo)
  - Threshold line at 15ms (umbral outlier MEDIUM)

### Panel 2: "Percentile Distribution"
- Tipo: Time Series
- Queries:
  - P50: `histogram_quantile(0.50, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))`
  - P95: `histogram_quantile(0.95, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))`
  - P99: `histogram_quantile(0.99, sum(rate(backend_tick_duration_histogram_ms_bucket[2m])) by (rate, le))`

### Panel 3: "Outlier Rate"
- Tipo: Time Series
- Query: `rate(backend_tick_outliers_total[1m]) * 60`
- Unit: "outliers per minute"

### Panel 4: "Slowest System"
- Tipo: Table / Bar Gauge
- Query: `topk(5, backend_system_execution_max_ms)`
- Columns: system, rate, value

### Panel 5: "System Breakdown" (para investigar MEDIUM 18ms)
- Tipo: Bar Gauge
- Query: `backend_system_execution_last_ms{rate="MEDIUM"}`

---

## Alertas Recomendadas

### Alerta: High MEDIUM Tick Latency
```yaml
alert: HighMediumTickLatency
expr: backend_tick_duration_recent_max_ms{rate="MEDIUM"} > 20
for: 1m
labels:
  severity: warning
annotations:
  summary: "MEDIUM tick latency exceeded 20ms"
  description: "Max tick duration in last 60s: {{ $value }}ms"
```

### Alerta: Frequent Outliers
```yaml
alert: FrequentOutliers
expr: rate(backend_tick_outliers_total{rate="MEDIUM"}[5m]) > 0.1
for: 2m
labels:
  severity: warning
annotations:
  summary: "More than 10% of MEDIUM ticks are outliers"
```

---

## Buckets del Histograma

Los buckets configurados para latencia (en ms):
- `0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, +Inf`

Estos permiten detectar granularmente:
- Ticks muy rápidos (<1ms)
- Ticks normales (1-10ms)
- Ticks lentos (10-50ms)
- Outliers (>50ms)
