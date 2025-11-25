import { EventEmitter } from "node:events";

/**
 * EventEmitter con buffer de eventos para procesamiento por lotes
 * Evita bloqueos sincrónicos durante el tick
 */
export class BatchedEventEmitter extends EventEmitter {
  private eventQueue: Array<{ name: string; payload: unknown }> = [];
  private batchingEnabled = true;

  public queueEvent(name: string, payload: unknown): void {
    if (!this.batchingEnabled) {
      this.emit(name, payload);
      return;
    }

    this.eventQueue.push({ name, payload });
  }

  public flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0);

    setImmediate(() => {
      for (const event of batch) {
        this.emit(event.name, event.payload);
      }
    });
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
