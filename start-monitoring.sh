#!/bin/bash

echo "📊 Iniciando Sistema de Monitoreo..."

# Verificar estructura de directorios
echo "🔍 Verificando estructura de directorios..."
if [ ! -d "monitoring/grafana/dashboards" ]; then
    echo "❌ Error: No existe monitoring/grafana/dashboards"
    exit 1
fi

if [ ! -d "monitoring/grafana/provisioning" ]; then
    echo "❌ Error: No existe monitoring/grafana/provisioning"
    exit 1
fi

# Verificar archivos de dashboards
DASHBOARD_COUNT=$(find monitoring/grafana/dashboards -name "*.json" | wc -l)
echo "📈 Encontrados $DASHBOARD_COUNT dashboards"

if [ "$DASHBOARD_COUNT" -eq 0 ]; then
    echo "❌ Error: No hay dashboards en monitoring/grafana/dashboards"
    exit 1
fi

# Verificar permisos
echo "🔧 Verificando permisos..."
chmod 644 monitoring/grafana/dashboards/*.json 2>/dev/null
chmod 644 monitoring/grafana/provisioning/dashboards/*.yml 2>/dev/null
chmod 644 monitoring/grafana/provisioning/datasources/*.yml 2>/dev/null

# Detener servicios anteriores
echo "🛑 Deteniendo servicios anteriores..."
docker stop uci-grafana uci-prometheus uci-backend-monitoring 2>/dev/null
docker rm uci-grafana uci-prometheus uci-backend-monitoring 2>/dev/null

# Iniciar servicios
echo "🚀 Iniciando servicios..."
docker-compose -f docker-compose.monitoring.yml up -d 2>/dev/null || docker compose -f docker-compose.monitoring.yml up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que Grafana esté listo..."
sleep 5

# Verificar estado
echo ""
echo "✅ Estado de los servicios:"
docker ps --filter "name=uci-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📊 Accede a Grafana en: http://localhost:3001"
echo "   Usuario: admin"
echo "   Contraseña: admin"
echo ""
echo "📈 Accede a Prometheus en: http://localhost:9090"
echo ""
echo "💡 Para ver logs de Grafana:"
echo "   docker logs uci-grafana -f"
echo ""
echo "🔍 Para verificar provisioning:"
echo "   docker logs uci-grafana | grep -i provision"
