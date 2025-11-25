# 🎮 Backend de Guardado - Una Carta Para Isa

Backend simple para manejar el guardado de partidas sin límites de tamaño.

## 🚀 Instalación

```bash
npm install
```

## 📦 Dependencias

- `express`: Servidor web
- `cors`: Permitir peticiones desde el cliente
- `fs/promises`: Manejo de archivos

## ▶️ Ejecutar

### Servidor solo
```bash
npm run server
```

### Servidor con hot-reload (desarrollo)
```bash
npm run server:dev
```

### Cliente + Servidor (modo full)
```bash
npm run dev:full
```

## 🔧 Configuración

Crea un archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor
PORT=3001

# URL del backend (para el cliente)
VITE_SAVE_API_URL=http://localhost:3001
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Métricas en tiempo real

| Endpoint              | Descripción                                                   |
| --------------------- | ------------------------------------------------------------- |
| `GET /metrics`        | Formato Prometheus 0.0.4 listo para ser scrapeado             |
| `GET /metrics/runtime`| Snapshot JSON con promedios, máximos y memoria del proceso   |

### Listar guardados
```
GET /api/saves
```

### Obtener un guardado
```
GET /api/saves/:id
```

### Guardar partida
```
POST /api/saves
Content-Type: application/json
```

### Eliminar guardado
```
DELETE /api/saves/:id
```

## 📈 Monitoreo en tiempo real

Se añadió un monitor interno que agrega métricas por _tick rate_, sistema y memoria sin afectar el rendimiento.  
Las métricas se exponen vía `/metrics` (Prometheus) y `/metrics/runtime` (JSON).

### Stack Docker (backend + Prometheus + Grafana)

```bash
docker compose -f docker-compose.monitoring.yml up
```

- El contenedor `backend` levanta el servidor en `http://localhost:8080`.
- Prometheus (http://localhost:9090) scrapea `/metrics` cada 5 s.
- Grafana queda disponible en http://localhost:3001 (usuario/password `admin`).
- Se aprovisiona automáticamente un data source de Prometheus y el dashboard `Simulation Runtime Overview`.

> Nota: el primer arranque instala dependencias dentro del contenedor `backend`. Para producción se recomienda construir la imagen oficial y apuntar Prometheus al dominio correspondiente.

## 📁 Estructura de Archivos

```
server/
├── index.js          # Servidor Express
├── saves/            # Directorio de guardados (creado automáticamente)
│   ├── save_xxx.json
│   └── save_yyy.json
└── tsconfig.json     # Configuración TypeScript
```

## 🔒 Características

- ✅ Sin límite de tamaño (solo limitado por el disco)
- ✅ Historial completo de guardados (no se eliminan automáticamente)
- ✅ CORS habilitado para desarrollo
- ✅ Soporte para JSON grandes (50MB límite)
- ✅ Fallback automático a localStorage si el servidor no está disponible

## 🔄 Flujo de Guardado

1. El cliente verifica si el backend está disponible
2. Si está disponible, guarda en el servidor
3. Si falla, intenta localStorage con optimización
4. Si localStorage está lleno, limpia datos antiguos
5. Como último recurso, guarda solo lo esencial

## 🐛 Debug

El servidor imprime información útil:
```
🎮 Save server running on http://localhost:3001
📁 Saves directory: /path/to/server/saves
```

Los logs del cliente mostrarán:
```
🌐 Backend de guardado disponible
💾 Guardando 123.45 KB...
🌐 Guardado en servidor exitosamente
```

O si el backend no está disponible:
```
💾 Usando localStorage (backend no disponible)
```

## 📝 Notas

- Los guardados se almacenan en `server/saves/` como archivos JSON
- **Los guardados NO se eliminan automáticamente** - se mantiene el historial completo
- El nombre del archivo es `save_{timestamp}.json`
- El backend es opcional: el juego funciona sin él usando localStorage
- Con TB de almacenamiento disponible, puedes guardar años de progreso

## 📚 Documentación

El proyecto cuenta con documentación generada automáticamente a partir del código fuente utilizando **TypeDoc**.

### Generar documentación
```bash
npm run docs
```

Esto generará un sitio web estático en la carpeta `docs/` con toda la información sobre:
- Sistemas de Simulación (Producción, IA, Clima, etc.)
- Estructuras de Datos (Quests, Items, Biomas)
- Flujos de eventos y arquitectura

Para ver la documentación, abre `docs/index.html` en tu navegador.
