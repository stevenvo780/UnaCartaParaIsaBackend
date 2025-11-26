# 📊 Sistema de Monitoreo de Simulación

Sistema completo de monitoreo con **Prometheus** y **Grafana** para analizar el rendimiento de cada sistema de la simulación sin afectar el rendimiento.

## 🚀 Inicio Rápido

### Prerrequisitos
- Docker instalado
- Docker Compose instalado (o Docker con plugin compose)

### Iniciar Monitoreo

```bash
cd UnaCartaParaIsaBackend

# Opción 1: Con docker-compose
docker-compose -f docker-compose.monitoring.yml up -d

# Opción 2: Con docker compose (nuevo)
docker compose -f docker-compose.monitoring.yml up -d
```

### Acceder a los Dashboards

- **Grafana**: http://localhost:3001
  - Usuario: `admin`
  - Contraseña: `admin`
- **Prometheus**: http://localhost:9090
- **Backend Metrics**: http://localhost:8080/metrics

## 📈 Dashboards Disponibles

El sistema incluye **5 dashboards detallados**:

### 1. Rendimiento General y Ticks
- Duración promedio y máxima de cada tick (FAST, MEDIUM, SLOW)
- Estadísticas del scheduler
- Utilización del event loop
- Número de entidades en el scheduler

**Métricas clave**:
- `backend_tick_duration_ms` - Duración promedio de ticks
- `backend_tick_duration_max_ms` - Duración máxima de ticks
- `backend_scheduler_entity_count` - Total de entidades
- `backend_event_loop_utilization` - Carga del event loop

### 2. Análisis Detallado por Sistema
- Top 10 sistemas más costosos en tiempo de ejecución
- Análisis separado por rate (FAST, MEDIUM, SLOW)
- Comparación visual con bar gauges
- Heatmap de distribución de tiempos

**Métricas clave**:
- `backend_system_execution_ms{system="...", rate="..."}` - Tiempo de ejecución por sistema

### 3. Memoria y Recursos del Servidor
- Uso de memoria heap (usado vs total)
- RSS (Resident Set Size)
- Memoria externa y array buffers
- Tendencias y tasas de crecimiento
- Alertas por thresholds

**Métricas clave**:
- `backend_memory_bytes{type="heapUsed"}` - Heap usado
- `backend_memory_bytes{type="heapTotal"}` - Heap total
- `backend_memory_bytes{type="rss"}` - Resident set size
- `backend_memory_bytes{type="external"}` - Memoria externa

### 4. Subsistemas y Operaciones Detalladas
- Top 20 operaciones más costosas
- Frecuencia de llamadas por operación
- Tiempo total acumulado
- Tabla detallada con todas las operaciones
- Análisis por entidad (si aplica)

**Métricas clave**:
- `backend_subsystem_duration_ms{system="...", operation="..."}` - Duración promedio
- `backend_subsystem_calls_total{system="...", operation="..."}` - Total de llamadas
- `backend_subsystem_total_duration_ms{system="...", operation="..."}` - Tiempo total

### 5. Entidades y Lógica de Juego
- Agentes activos
- Recursos del mundo
- Edificios/zonas
- Correlaciones rendimiento vs entidades
- Tasas de crecimiento

**Métricas clave**:
- `backend_active_agents_total` - Total de agentes activos
- `backend_total_resources` - Total de recursos
- `backend_total_buildings` - Total de edificios

## 🔧 Configuración

### Prometheus

El archivo `monitoring/prometheus.yml` contiene la configuración de scraping:
- Scrape interval: 5 segundos
- Timeout: 4 segundos
- Target: Backend en puerto 8080

### Grafana

Los dashboards se cargan automáticamente desde:
- `monitoring/grafana/dashboards/` - Archivos JSON de dashboards
- `monitoring/grafana/provisioning/` - Configuración de provisioning

## 📊 Métricas Exportadas

### Ticks y Scheduler
- `backend_tick_duration_ms` - Duración promedio de ticks por rate
- `backend_tick_duration_max_ms` - Duración máxima de ticks
- `backend_scheduler_enabled_systems` - Sistemas habilitados por rate
- `backend_scheduler_tick_avg_ms` - Promedio de tick reportado por scheduler
- `backend_scheduler_entity_count` - Número de entidades

### Sistemas
- `backend_system_execution_ms` - Tiempo de ejecución por sistema y rate

### Subsistemas
- `backend_subsystem_duration_ms` - Duración promedio de operaciones
- `backend_subsystem_calls_total` - Total de llamadas
- `backend_subsystem_total_duration_ms` - Tiempo total acumulado

### Memoria
- `backend_memory_bytes{type="heapUsed"}` - Heap usado
- `backend_memory_bytes{type="heapTotal"}` - Heap total
- `backend_memory_bytes{type="rss"}` - RSS
- `backend_memory_bytes{type="external"}` - Memoria externa
- `backend_memory_bytes{type="arrayBuffers"}` - Array buffers

### Lógica de Juego
- `backend_active_agents_total` - Agentes activos
- `backend_total_resources` - Recursos totales
- `backend_total_buildings` - Edificios/zonas totales

### Event Loop
- `backend_event_loop_utilization` - Utilización del event loop Node.js

## 🎯 Optimización de Rendimiento

### Cómo Identificar Problemas

1. **Ticks Lentos**: Si `backend_tick_duration_ms` supera:
   - FAST: 10ms (objetivo < 5ms)
   - MEDIUM: 16ms (objetivo < 10ms)
   - SLOW: 33ms (objetivo < 20ms)

2. **Sistemas Costosos**: Revisar el dashboard 2 para identificar sistemas que consumen más tiempo

3. **Fugas de Memoria**: Monitorear tendencias en dashboard 3
   - Crecimiento constante de heap = posible fuga
   - Revisar tasa de crecimiento (MB/min)

4. **Event Loop Bloqueado**: Si `backend_event_loop_utilization` > 0.7 (70%)

5. **Operaciones Lentas**: Usar dashboard 4 para identificar operaciones específicas

### Thresholds Recomendados

**FPS equivalente**:
- FAST (60 FPS): 16.67ms por tick máximo
- MEDIUM (30 FPS): 33.33ms por tick máximo
- SLOW (15 FPS): 66.67ms por tick máximo

**Memoria**:
- Heap usado < 1GB: Verde
- Heap usado 1-1.5GB: Amarillo
- Heap usado > 1.5GB: Rojo

**Event Loop**:
- < 70%: Verde
- 70-90%: Amarillo
- > 90%: Rojo

## 🛠️ Comandos Útiles

```bash
# Ver logs de Prometheus
docker logs uci-prometheus -f

# Ver logs de Grafana
docker logs uci-grafana -f

# Ver logs del backend
docker logs uci-backend-monitoring -f

# Detener servicios
docker-compose -f docker-compose.monitoring.yml down

# Reiniciar servicios
docker-compose -f docker-compose.monitoring.yml restart

# Ver métricas raw del backend
curl http://localhost:8080/metrics

# Query Prometheus directamente
curl 'http://localhost:9090/api/v1/query?query=backend_tick_duration_ms'
```

## 📝 Notas

- Los dashboards se actualizan cada 5 segundos
- Prometheus retiene métricas por 30 días
- Las métricas se exportan en formato Prometheus estándar
- **No afecta el rendimiento**: Las métricas son pasivas y se calculan durante las operaciones normales
- Los dashboards son editables desde Grafana

## 🐛 Troubleshooting

### Problema: Grafana no muestra datos

1. Verificar que Prometheus esté scrapeando:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Verificar que el backend esté exportando métricas:
   ```bash
   curl http://localhost:8080/metrics
   ```

3. Verificar conexión de datasource en Grafana:
   - Settings → Data Sources → Simulation Prometheus → Save & Test

### Problema: Dashboards no aparecen

1. Verificar que los archivos JSON están en:
   ```bash
   ls -la monitoring/grafana/dashboards/
   ```

2. Reiniciar Grafana:
   ```bash
   docker restart uci-grafana
   ```

3. Verificar logs de provisioning:
   ```bash
   docker logs uci-grafana | grep -i provision
   ```

## 📚 Referencias

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node.js Performance](https://nodejs.org/api/perf_hooks.html)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
