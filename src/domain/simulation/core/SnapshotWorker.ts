import { parentPort } from "node:worker_threads";
import type { SimulationSnapshot } from "../../../shared/types/commands/SimulationCommand";

/**
 * Worker thread for processing and emitting simulation snapshots.
 *
 * This worker runs in a separate thread to avoid blocking the main event loop
 * with snapshot serialization and emission. It receives snapshot data via
 * postMessage and emits it to connected clients.
 *
 * Benefits:
 * - Main simulation loop remains unblocked
 * - Event loop utilization stays low even with large snapshots
 * - Better scalability with many connected clients
 */

interface SnapshotMessage {
  type: "snapshot";
  data: SimulationSnapshot;
}

interface ShutdownMessage {
  type: "shutdown";
}

type WorkerMessage = SnapshotMessage | ShutdownMessage;

if (!parentPort) {
  throw new Error("SnapshotWorker must be run as a worker thread");
}

parentPort.on("message", (message: WorkerMessage) => {
  if (message.type === "snapshot") {
    try {
      const serialized = JSON.stringify(message.data);

      parentPort!.postMessage({
        type: "snapshot-ready",
        data: serialized,
        size: serialized.length,
      });
    } catch (error) {
      parentPort!.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (message.type === "shutdown") {
    process.exit(0);
  }
});

parentPort.postMessage({ type: "ready" });
