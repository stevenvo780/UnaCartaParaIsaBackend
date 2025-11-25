import { EventEmitter } from "node:events";

/**
 * Event emitter with buffering for batch processing.
 *
 * Queues events during simulation ticks and flushes them all at once,
 * preventing synchronous blocking during tick execution. This improves
 * performance by batching event processing.
 *
 * @see simulationEvents for the global instance used throughout the simulation
 */
export class BatchedEventEmitter extends EventEmitter {
  private eventQueue: Array<{ name: string; payload: unknown }> = [];
  private batchingEnabled = true;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Overrides emit() to automatically queue events when batching is enabled.
   *
   * @param event - Event name or symbol
   * @param args - Event payload arguments
   * @returns Always returns true when batching is enabled
   */
  public emit(event: string | symbol, ...args: unknown[]): boolean {
    if (this.batchingEnabled) {
      this.queueEvent(String(event), args[0]);
      return true;
    }
    return super.emit(event, ...args);
  }

  /**
   * Queues an event for batch processing.
   * If batching is disabled, emits immediately.
   *
   * @param name - Event name
   * @param payload - Event payload
   */
  public queueEvent(name: string, payload: unknown): void {
    if (!this.batchingEnabled) {
      super.emit(name, payload);
      return;
    }

    this.eventQueue.push({ name, payload });
  }

  /**
   * Flushes all queued events, emitting them synchronously.
   * Temporarily disables batching during flush to prevent re-queuing.
   * Called automatically by the scheduler after each tick.
   */
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

  /**
   * Enables or disables event batching.
   * If disabled, flushes any queued events immediately.
   *
   * @param enabled - Whether to enable batching
   */
  public setBatchingEnabled(enabled: boolean): void {
    this.batchingEnabled = enabled;
    if (!enabled) {
      this.flushEvents();
    }
  }

  /**
   * Clears all queued events without emitting them.
   */
  public clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Gets the current number of queued events.
   *
   * @returns Queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}
