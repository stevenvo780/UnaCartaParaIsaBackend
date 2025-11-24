import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type {
  WorldGenConfig,
  TerrainTile,
} from "../../../../domain/world/generation/types";

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
}

interface WorkerMessage {
  type: "result";
  requestId: string;
  ok: boolean;
  chunk?: TerrainTile[][];
  error?: string;
  timings?: {
    generationMs: number;
  };
}

export interface ChunkPoolStats {
  queueSize: number;
  workers: number;
  busyWorkers: number;
}

export class ChunkWorkerPool extends EventEmitter {
  private readonly workers: WorkerEnvelope[] = [];
  private readonly queue: ChunkJob[] = [];
  private disposed = false;
  private readonly workerScript: URL;
  private readonly workerExecArgv: string[];
  private readonly maxWorkers: number;

  constructor(size?: number) {
    super();
    this.workerScript = this.resolveWorkerScript();
    this.workerExecArgv = this.resolveExecArgs();
    const parallelism =
      typeof os.availableParallelism === "function"
        ? os.availableParallelism()
        : os.cpus().length;
    const envWorkers = Number.parseInt(process.env.CHUNK_WORKERS ?? "", 10);
    const desired =
      size ??
      (Number.isNaN(envWorkers) ? parallelism : envWorkers || parallelism);
    this.maxWorkers = Math.max(1, desired);
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers[i] = this.spawnWorker(i);
    }
  }

  public getStats(): ChunkPoolStats {
    const busyWorkers = this.workers.filter((w) => w?.busy).length;
    return {
      queueSize: this.queue.length,
      workers: this.workers.length,
      busyWorkers,
    };
  }

  public async destroy(): Promise<void> {
    this.disposed = true;
    const terminations: Array<Promise<number>> = [];
    for (const worker of this.workers) {
      if (!worker) continue;
      terminations.push(worker.worker.terminate());
    }
    this.queue.length = 0;
    await Promise.allSettled(terminations);
  }

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
        job.cleanupSignal = () =>
          signal.removeEventListener("abort", handleAbort);
      }

      this.queue.push(job);
      this.emit("queue:update", this.queue.length);
      this.dispatch();
    });
  }

  private dispatch(): void {
    if (this.disposed) return;
    for (const envelope of this.workers) {
      if (!envelope || envelope.busy) continue;
      const job = this.dequeueNext();
      if (!job) break;
      this.assignJob(envelope, job);
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
      // Switch from queue abort handling to inflight detection
      job.cleanupSignal();
      job.cleanupSignal = undefined;
    }
    workerEnvelope.busy = true;
    workerEnvelope.currentJob = job;
    job.workerId = workerEnvelope.id;
    workerEnvelope.worker.postMessage({
      type: "generate",
      requestId: job.requestId,
      coords: job.coords,
      config: job.config,
    });
  }

  private removeJob(job: ChunkJob): void {
    if (job.workerId !== undefined) {
      // Inflight job: mark as aborted so the response is discarded
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
    } catch {
      // Ignore
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

  private spawnWorker(index: number): WorkerEnvelope {
    const worker = new Worker(this.workerScript, {
      name: `chunk-worker-${index}`,
      execArgv: this.workerExecArgv,
    });
    const envelope: WorkerEnvelope = {
      id: index,
      worker,
      busy: false,
    };
    worker.on("message", (message: WorkerMessage) =>
      this.handleWorkerMessage(envelope, message),
    );
    worker.on("error", (error) => {
      this.emit("worker:error", { id: envelope.id, error });
      this.failCurrentJob(envelope, error);
      if (!this.disposed) {
        this.restartWorker(envelope);
      }
    });
    worker.on("exit", (code) => {
      this.emit("worker:exit", { id: envelope.id, code });
      if (!this.disposed) {
        this.restartWorker(envelope);
      }
    });
    return envelope;
  }

  private restartWorker(envelope: WorkerEnvelope): void {
    if (this.disposed) return;
    envelope.busy = false;
    envelope.currentJob = undefined;
    envelope.worker.removeAllListeners();
    const replacement = this.spawnWorker(envelope.id);
    this.workers[envelope.id] = replacement;
    this.dispatch();
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
    this.dispatch();

    if (!job) return;
    if (job.cleanupSignal) job.cleanupSignal();
    if (job.aborted) {
      // job was cancelled; drop result silently
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
