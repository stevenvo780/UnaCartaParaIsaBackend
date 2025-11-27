# Scripts de Utilidades

## Limpiador de Comentarios (`clean-comments.ts`)

Script inteligente y seguro para eliminar comentarios innecesarios del código TypeScript, preservando únicamente la documentación JSDoc y las directivas del sistema.

### 🎯 Propósito

Eliminar comentarios inline y de bloque que no aportan valor, manteniendo solo la documentación relevante en JSDoc.

### ✅ Comentarios que SE PRESERVAN

El script mantiene intactos los siguientes tipos de comentarios:

- **JSDoc**: `/** ... */` - Toda la documentación de funciones, clases, etc.
- **Directivas de ESLint**: `// eslint-disable-next-line`, `/* eslint-disable */`, etc.
- **Directivas de TypeScript**: `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`
- **Directivas de Prettier**: `// prettier-ignore`
- **Licencias**: `/* @license ... */`, `/* @preserve ... */`
- **Copyright**: `/* Copyright ... */`, `// Copyright ...`
- **Regiones**: `// #region`, `// #endregion`

### ❌ Comentarios que SE ELIMINAN

- Comentarios inline regulares: `// comentario aquí`
- Comentarios de bloque regulares: `/* comentario aquí */`
- Comentarios "mal parqueados" que no siguen las convenciones

### 🔒 Características de Seguridad

1. **Modo Dry-Run**: Revisa qué se eliminaría sin modificar archivos
2. **Backup Automático**: Crea `.backup` antes de modificar cada archivo
3. **Validación de Sintaxis**: Verifica con TypeScript que el código sigue siendo válido
4. **Rollback Automático**: Restaura el backup si la validación falla
5. **Detección de Strings**: No elimina "comentarios" dentro de strings

### 📖 Uso

#### Modo Dry-Run (Revisar sin modificar)

```bash
npm run clean:comments:dry
```

o

```bash
npm run clean:comments:dry src/
```

#### Modo Producción (Modificar archivos)

```bash
npm run clean:comments
```

o especificar un directorio:

```bash
npm run clean:comments src/domain/
```

### 📊 Ejemplo de Salida

```
🧹 Limpiador de Comentarios TypeScript

Directorio: ./src
Modo: DRY RUN (solo revisión)

ℹ️  Ejecutando en modo DRY RUN - no se modificarán archivos

🔍 [DRY RUN] src/domain/simulation/core/Engine.ts: 5 comentario(s) eliminado(s)
🔍 [DRY RUN] src/infrastructure/services/ChunkService.ts: 3 comentario(s) eliminado(s)
🔍 [DRY RUN] src/utils/SpatialGrid.ts: 2 comentario(s) eliminado(s)

============================================================
📊 Resumen:
============================================================
Archivos procesados:  221
Archivos modificados: 15
Comentarios eliminados: 47
Errores: 0
Tiempo: 3.42s

💡 Para aplicar los cambios, ejecuta sin --dry-run
```

### ⚠️ Recomendaciones

1. **Siempre ejecutar primero en modo dry-run** para revisar los cambios
2. **Hacer commit antes de ejecutar** para poder revertir si es necesario
3. **Ejecutar lint después**: `npm run lint` para formatear el código limpio
4. **Revisar los cambios** con `git diff` antes de hacer commit

### 🔧 Workflow Recomendado

```bash
# 1. Hacer commit de cambios actuales
git add .
git commit -m "chore: cambios antes de limpiar comentarios"

# 2. Revisar qué se eliminaría (dry-run)
npm run clean:comments:dry

# 3. Si estás de acuerdo, aplicar cambios
npm run clean:comments

# 4. Formatear el código
npm run lint

# 5. Revisar cambios
git diff

# 6. Si todo está bien, hacer commit
git add .
git commit -m "chore: eliminar comentarios innecesarios"
```

### 🛡️ ¿Qué pasa si algo sale mal?

El script incluye múltiples capas de seguridad:

1. Si la validación de TypeScript falla, **automáticamente restaura el backup**
2. Los archivos `.backup` se crean antes de cada modificación
3. Puedes revertir todo con `git checkout .` si hiciste commit antes

### 📝 Ejemplos de Transformación

#### Antes:

```typescript
/**
 * Calcula la distancia entre dos puntos
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  // Calcular diferencias
  const dx = x2 - x1; // diferencia en x
  const dy = y2 - y1; // diferencia en y

  /* Aplicar teorema de Pitágoras */
  return Math.sqrt(dx * dx + dy * dy); // retornar resultado
}
```

#### Después:

```typescript
/**
 * Calcula la distancia entre dos puntos
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
}
```

### 🚀 Integración con CI/CD

Puedes agregar este script a tu pipeline de CI para asegurar que no se agreguen comentarios innecesarios:

```yaml
# .github/workflows/lint.yml
- name: Verificar comentarios innecesarios
  run: |
    npm run clean:comments:dry
    # Fallar si encuentra comentarios para eliminar
    if [ $? -eq 0 ]; then exit 1; fi
```
