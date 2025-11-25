/**
 * Servicio de timestamp compartido por frame
 *
 * Evita múltiples llamadas a Date.now() durante el mismo tick.
 * El scheduler actualiza este valor una vez al inicio de cada tick,
 * y todos los sistemas consultan este valor en lugar de llamar Date.now().
 *
 * Beneficio: Reduce ~100+ llamadas a Date.now() por tick a solo 1.
 */

let _frameTimestamp = Date.now();

/**
 * Obtiene el timestamp del frame actual.
 * Usar esto en lugar de Date.now() dentro de sistemas.
 */
export function getFrameTime(): number {
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
