import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type {
  WorldGenConfig,
  TerrainTile,
} from "../../../../domain/world/generation/types";
import { WorkerMessageType } from "../../../../shared/constants/WebSocketEnums";

interface ChunkWorkerResult {
  chunk: TerrainTile[][];
  timings: {
    generationMs: number;
  };
}

interface ChunkJob {
  requestId: string;
  coords: { x: number; y: number };
  config: WorldGenConfig;
  resolve: (result: ChunkWorkerResult) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  aborted: boolean;
  signal?: AbortSignal;
  cleanupSignal?: () => void;
  workerId?: number;
}

interface WorkerEnvelope {
  id: number;
  worker: Worker;
  busy: boolean;
  currentJob?: ChunkJob;
  lastActivityTime: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

interface WorkerMessage {
  type: WorkerMessageType.RESULT;
  requestId: string;
  ok: boolean;
  chunk?: TerrainTile[][];
  error?: string;
  timings?: {
    generationMs: number;
  };
}

/**
 * Statistics for chunk worker pool.
 */
export interface ChunkPoolStats {
  queueSize: number;
  workers: number;
  busyWorkers: number;
  maxWorkers: number;
  minWorkers: number;
}

/**
 * Elastic worker pool for asynchronous terrain chunk generation.
 *
 * Features on-demand scaling:
 * - Starts with MIN_WORKERS (default: 1) workers
 * - Spawns new workers when queue has pending jobs and all workers are busy
 * - Terminates idle workers after IDLE_TIMEOUT_MS (default: 30s)
 * - Respects MAX_WORKERS limit (configurable via CHUNK_WORKERS env var)
 *
 * This approach is more efficient than pre-allocating all workers because:
 * - No memory/CPU overhead for unused workers
 * - Scales up automatically under load
 * - Scales down automatically when idle
 *
 * @see ChunkWorker for individual worker implementation
 */
export class ChunkWorkerPool extends EventEmitter {
  private readonly workers: Map<number, WorkerEnvelope> = new Map();
  private readonly queue: ChunkJob[] = [];
  private disposed = false;
  private readonly workerScript: URL;
  private readonly workerExecArgv: string[];
  private readonly maxWorkers: number;
  private readonly minWorkers: number;
  private readonly idleTimeoutMs: number;
  private nextWorkerId = 0;

  constructor(size?: number) {
    super();
    this.workerScript = this.resolveWorkerScript();
    this.workerExecArgv = this.resolveExecArgs();

    // Configuration from environment or defaults
    const parallelism =
      typeof os.availableParallelism === "function"
        ? os.availableParallelism()
        : os.cpus().length;

    const envMaxWorkers = Number.parseInt(
      process.env.CHUNK_WORKERS_MAX ?? process.env.CHUNK_WORKERS ?? "",
      10,
    );
    const envMinWorkers = Number.parseInt(
      process.env.CHUNK_WORKERS_MIN ?? "",
      10,
    );
    const envIdleTimeout = Number.parseInt(
      process.env.CHUNK_WORKER_IDLE_TIMEOUT_MS ?? "",
      10,
    );

    // Max workers: explicit config > size param > parallelism (capped at 8)
    this.maxWorkers = Math.max(
      1,
      !Number.isNaN(envMaxWorkers)
        ? envMaxWorkers
        : (size ?? Math.min(parallelism, 8)),
    );

    // Min workers: explicit config > 1 (always keep at least 1 warm)
    this.minWorkers = Math.max(
      1,
      Math.min(
        !Number.isNaN(envMinWorkers) ? envMinWorkers : 1,
        this.maxWorkers,
      ),
    );

    // Idle timeout: how long before terminating unused workers (default 30s)
    this.idleTimeoutMs = !Number.isNaN(envIdleTimeout)
      ? envIdleTimeout
      : 30_000;

    // Start with minimum workers
    for (let i = 0; i < this.minWorkers; i++) {
      this.spawnWorkerIfNeeded();
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ChunkWorkerPool] Elastic pool initialized: min=${this.minWorkers}, max=${this.maxWorkers}, idleTimeout=${this.idleTimeoutMs}ms`,
    );
  }

  /**
   * Gets current pool statistics.
   *
   * @returns {ChunkPoolStats} Current queue size and worker status
   */
  public getStats(): ChunkPoolStats {
    let busyWorkers = 0;
    for (const w of this.workers.values()) {
      if (w.busy) busyWorkers++;
    }
    return {
      queueSize: this.queue.length,
      workers: this.workers.size,
      busyWorkers,
      maxWorkers: this.maxWorkers,
      minWorkers: this.minWorkers,
    };
  }

  /**
   * Shuts down all workers and clears the queue.
   *
   * Waits for all worker terminations to complete.
   */
  public async destroy(): Promise<void> {
    this.disposed = true;
    const terminations: Array<Promise<number>> = [];
    for (const envelope of this.workers.values()) {
      if (envelope.idleTimer) {
        clearTimeout(envelope.idleTimer);
      }
      terminations.push(envelope.worker.terminate());
    }
    this.workers.clear();
    this.queue.length = 0;
    await Promise.allSettled(terminations);
  }

  /**
   * Enqueues a chunk generation job.
   *
   * @param {string} requestId - Unique request identifier
   * @param {Object} coords - Chunk coordinates
   * @param {number} coords.x - Chunk X coordinate
   * @param {number} coords.y - Chunk Y coordinate
   * @param {WorldGenConfig} config - World generation configuration
   * @param {Object} [options] - Optional job options
   * @param {AbortSignal} [options.signal] - Abort signal for cancellation
   * @returns {Promise<ChunkWorkerResult>} Promise resolving to generated chunk
   * @throws {Error} If pool is disposed
   */
  public enqueue(
    requestId: string,
    coords: { x: number; y: number },
    config: WorldGenConfig,
    options?: { signal?: AbortSignal },
  ): Promise<ChunkWorkerResult> {
    if (this.disposed) {
      return Promise.reject(new Error("ChunkWorkerPool disposed"));
    }

    return new Promise<ChunkWorkerResult>((resolve, reject) => {
      const job: ChunkJob = {
        requestId,
        coords,
        config,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        aborted: false,
      };

      if (options?.signal) {
        const signal = options.signal;
        const handleAbort = (): void => {
          if (job.cleanupSignal) job.cleanupSignal();
          job.aborted = true;
          this.removeJob(job);
          reject(
            new Error(
              `Chunk job ${requestId} aborted after ${
                Date.now() - job.enqueuedAt
              }ms`,
            ),
          );
        };
        if (signal.aborted) {
          handleAbort();
          return;
        }
        signal.addEventListener("abort", handleAbort, { once: true });
        job.signal = signal;
        job.cleanupSignal = (): void =>
          signal.removeEventListener("abort", handleAbort);
      }

      this.queue.push(job);
      this.emit("queue:update", this.queue.length);
      this.dispatch();
    });
  }

  /**
   * Spawns a new worker if we haven't reached maxWorkers.
   * Returns the new worker envelope or undefined if at capacity.
   */
  private spawnWorkerIfNeeded(): WorkerEnvelope | undefined {
    if (this.disposed) return undefined;
    if (this.workers.size >= this.maxWorkers) return undefined;

    const id = this.nextWorkerId++;
    const worker = new Worker(this.workerScript, {
      name: `chunk-worker-${id}`,
      execArgv: this.workerExecArgv,
    });

    const envelope: WorkerEnvelope = {
      id,
      worker,
      busy: false,
      lastActivityTime: Date.now(),
    };

    worker.on("message", (message: WorkerMessage) =>
      this.handleWorkerMessage(envelope, message),
    );
    worker.on("error", (error) => {
      this.emit("worker:error", { id: envelope.id, error });
      this.failCurrentJob(envelope, error);
      if (!this.disposed) {
        this.workers.delete(envelope.id);
        // Spawn replacement if we're below minimum
        if (this.workers.size < this.minWorkers) {
          this.spawnWorkerIfNeeded();
        }
        this.dispatch();
      }
    });
    worker.on("exit", (code) => {
      this.emit("worker:exit", { id: envelope.id, code });
      if (!this.disposed) {
        this.workers.delete(envelope.id);
        // Spawn replacement if we're below minimum
        if (this.workers.size < this.minWorkers) {
          this.spawnWorkerIfNeeded();
        }
        this.dispatch();
      }
    });

    this.workers.set(id, envelope);
    this.emit("worker:spawn", { id, totalWorkers: this.workers.size });
    return envelope;
  }

  /**
   * Schedules termination of an idle worker after timeout.
   * Cancels if the worker becomes busy again.
   */
  private scheduleIdleTermination(envelope: WorkerEnvelope): void {
    // Don't terminate if we're at minimum workers
    if (this.workers.size <= this.minWorkers) return;

    // Clear any existing timer
    if (envelope.idleTimer) {
      clearTimeout(envelope.idleTimer);
    }

    envelope.idleTimer = setTimeout(() => {
      // Double-check conditions before terminating
      if (
        this.disposed ||
        envelope.busy ||
        this.workers.size <= this.minWorkers
      ) {
        return;
      }

      this.emit("worker:idle-terminate", {
        id: envelope.id,
        idleMs: Date.now() - envelope.lastActivityTime,
      });

      envelope.worker.removeAllListeners();
      envelope.worker.terminate().catch(() => {
        // Ignore termination errors
      });
      this.workers.delete(envelope.id);
    }, this.idleTimeoutMs);
  }

  private dispatch(): void {
    if (this.disposed) return;

    // Try to assign jobs to existing idle workers
    for (const envelope of this.workers.values()) {
      if (envelope.busy) continue;

      // Cancel idle termination timer since we might use this worker
      if (envelope.idleTimer) {
        clearTimeout(envelope.idleTimer);
        envelope.idleTimer = undefined;
      }

      const job = this.dequeueNext();
      if (!job) {
        // No more jobs - schedule idle termination for this worker
        this.scheduleIdleTermination(envelope);
        continue;
      }

      this.assignJob(envelope, job);
    }

    // If there are still pending jobs and all workers are busy, spawn more
    while (this.queue.length > 0 && this.workers.size < this.maxWorkers) {
      const allBusy = [...this.workers.values()].every((w) => w.busy);
      if (!allBusy) break; // There's an idle worker that will pick up the job

      const newWorker = this.spawnWorkerIfNeeded();
      if (!newWorker) break; // At capacity

      const job = this.dequeueNext();
      if (job) {
        this.assignJob(newWorker, job);
      }
    }
  }

  private dequeueNext(): ChunkJob | undefined {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      if (job.aborted) continue;
      return job;
    }
    return undefined;
  }

  private assignJob(workerEnvelope: WorkerEnvelope, job: ChunkJob): void {
    if (job.cleanupSignal) {
      job.cleanupSignal();
      job.cleanupSignal = undefined;
    }
    workerEnvelope.busy = true;
    workerEnvelope.currentJob = job;
    workerEnvelope.lastActivityTime = Date.now();
    job.workerId = workerEnvelope.id;
    workerEnvelope.worker.postMessage({
      type: WorkerMessageType.GENERATE,
      requestId: job.requestId,
      coords: job.coords,
      config: job.config,
    });
  }

  private removeJob(job: ChunkJob): void {
    if (job.workerId !== undefined) {
      job.aborted = true;
      return;
    }
    const idx = this.queue.indexOf(job);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      this.emit("queue:update", this.queue.length);
    }
  }

  private resolveWorkerScript(): URL {
    const jsUrl = new URL("./ChunkWorker.js", import.meta.url);
    const tsUrl = new URL("./ChunkWorker.ts", import.meta.url);
    try {
      const jsPath = fileURLToPath(jsUrl);
      if (existsSync(jsPath)) {
        return jsUrl;
      }
    } catch (error) {
      void error;
    }
    return tsUrl;
  }

  private resolveExecArgs(): string[] {
    if (!this.workerScript.pathname.endsWith(".ts")) {
      return [];
    }
    if (this.supportsImportFlag()) {
      return ["--import", "tsx"];
    }
    return ["--loader", "tsx"];
  }

  private supportsImportFlag(): boolean {
    const [major, minor] = process.versions.node
      .split(".")
      .map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(major) || Number.isNaN(major)) {
      return false;
    }
    if (major > 20) {
      return true;
    }
    if (major < 20) {
      return false;
    }
    return Number.isFinite(minor) && !Number.isNaN(minor) && minor >= 6;
  }

  private failCurrentJob(envelope: WorkerEnvelope, error: Error): void {
    const job = envelope.currentJob;
    envelope.currentJob = undefined;
    envelope.busy = false;
    if (!job) return;
    if (job.cleanupSignal) job.cleanupSignal();
    if (!job.aborted) {
      job.reject(error);
    }
  }

  private handleWorkerMessage(
    envelope: WorkerEnvelope,
    message: WorkerMessage,
  ): void {
    if (message.type !== "result") return;
    const job = envelope.currentJob;
    envelope.currentJob = undefined;
    envelope.busy = false;
    envelope.lastActivityTime = Date.now();

    // Schedule idle termination check
    this.scheduleIdleTermination(envelope);

    // Try to dispatch more work
    this.dispatch();

    if (!job) return;
    if (job.cleanupSignal) job.cleanupSignal();
    if (job.aborted) {
      return;
    }

    if (message.ok && message.chunk) {
      job.resolve({
        chunk: message.chunk,
        timings: message.timings ?? { generationMs: 0 },
      });
    } else {
      job.reject(
        new Error(
          message.error ??
            `Chunk worker ${envelope.id} failed for request ${message.requestId}`,
        ),
      );
    }
  }
}

export type { ChunkWorkerResult };
