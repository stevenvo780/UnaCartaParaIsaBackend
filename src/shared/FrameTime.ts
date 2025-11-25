/**
 * Servicio de timestamp compartido por frame
 *
 * Evita múltiples llamadas a Date.now() durante el mismo tick.
 * El scheduler actualiza este valor una vez al inicio de cada tick,
 * y todos los sistemas consultan este valor en lugar de llamar Date.now().
 *
 * Beneficio: Reduce ~100+ llamadas a Date.now() por tick a solo 1.
 */

let _frameTimestamp = 0; // Inicializar en 0 para forzar actualización

/**
 * Obtiene el timestamp del frame actual.
 * Usar esto en lugar de Date.now() dentro de sistemas.
 *
 * IMPORTANTE: Si _frameTimestamp está muy desactualizado (>100ms),
 * automáticamente se actualiza. Esto permite que los sistemas funcionen
 * correctamente en tests con fake timers y durante desarrollo.
 */
export function getFrameTime(): number {
  const realNow = Date.now();
  if (realNow - _frameTimestamp > 100) {
    _frameTimestamp = realNow;
  }
  return _frameTimestamp;
}

/**
 * Actualiza el timestamp del frame.
 * Solo debe ser llamado por el scheduler al inicio de cada tick.
 */
export function updateFrameTime(): number {
  _frameTimestamp = Date.now();
  return _frameTimestamp;
}

/**
 * Alias para compatibilidad - retorna el timestamp actual del frame
 */
export const now = getFrameTime;
