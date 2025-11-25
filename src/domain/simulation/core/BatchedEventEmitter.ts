import { EventEmitter } from "node:events";

/**
 * EventEmitter con buffer de eventos para procesamiento por lotes
 * Evita bloqueos sincrónicos durante el tick
 */
export class BatchedEventEmitter extends EventEmitter {
  private eventQueue: Array<{ name: string; payload: unknown }> = [];
  private batchingEnabled = true;

  constructor() {
    super();
    // Aumentar maxListeners para evitar warnings en tests y producción
    // cuando múltiples sistemas se suscriben a eventos
    this.setMaxListeners(50);
  }

  /**
   * Sobrescribe emit() para usar queueEvent() automáticamente cuando batching está habilitado
   */
  public emit(event: string | symbol, ...args: unknown[]): boolean {
    if (this.batchingEnabled) {
      this.queueEvent(String(event), args[0]);
      return true;
    }
    return super.emit(event, ...args);
  }

  public queueEvent(name: string, payload: unknown): void {
    if (!this.batchingEnabled) {
      super.emit(name, payload);
      return;
    }

    this.eventQueue.push({ name, payload });
  }

  public flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0);
    const wasBatchingEnabled = this.batchingEnabled;

    this.batchingEnabled = false;

    try {
      for (const event of batch) {
        super.emit(event.name, event.payload);
      }
    } finally {
      this.batchingEnabled = wasBatchingEnabled;
    }
  }

  public setBatchingEnabled(enabled: boolean): void {
    this.batchingEnabled = enabled;
    if (!enabled) {
      this.flushEvents();
    }
  }

  public clearQueue(): void {
    this.eventQueue = [];
  }

  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}
