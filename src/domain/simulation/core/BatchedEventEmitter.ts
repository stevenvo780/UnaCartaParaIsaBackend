import { EventEmitter } from "node:events";

/**
 * EventEmitter con buffer de eventos para procesamiento por lotes
 * Evita bloqueos sincrónicos durante el tick
 */
export class BatchedEventEmitter extends EventEmitter {
  private eventQueue: Array<{ name: string; payload: unknown }> = [];
  private batchingEnabled = true;

  /**
   * Encola un evento para procesamiento posterior
   */
  public queueEvent(name: string, payload: unknown): void {
    if (!this.batchingEnabled) {
      // Si el batching está deshabilitado, emitir inmediatamente
      this.emit(name, payload);
      return;
    }

    this.eventQueue.push({ name, payload });
  }

  /**
   * Procesa todos los eventos encolados
   */
  public flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0);

    // Procesar eventos de forma asíncrona para no bloquear el tick
    setImmediate(() => {
      for (const event of batch) {
        this.emit(event.name, event.payload);
      }
    });
  }

  /**
   * Habilita o deshabilita el batching
   */
  public setBatchingEnabled(enabled: boolean): void {
    this.batchingEnabled = enabled;
    if (!enabled) {
      this.flushEvents();
    }
  }

  /**
   * Limpia la cola de eventos sin procesarlos
   */
  public clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Obtiene el número de eventos en cola
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}
