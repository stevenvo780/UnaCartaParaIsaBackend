import { parentPort } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { WorldGenerationService } from "../../world/worldGenerationService";
import type {
  WorldGenConfig,
  TerrainTile,
} from "../../../../domain/world/generation/types";

interface ChunkWorkerRequest {
  type: "generate";
  requestId: string;
  coords: { x: number; y: number };
  config: WorldGenConfig;
}

interface ChunkWorkerResponse {
  type: "result";
  requestId: string;
  ok: boolean;
  chunk?: TerrainTile[][];
  error?: string;
  timings?: {
    generationMs: number;
  };
}

import { VoronoiGenerator } from "../../../../domain/world/generation/VoronoiGenerator";

/**
 * Worker thread for terrain chunk generation.
 *
 * Runs in a separate thread to avoid blocking the main event loop.
 * Receives generation requests via parentPort and responds with generated chunks.
 * Measures generation time for performance monitoring.
 */

const voronoiGenerator = new VoronoiGenerator();
const generator = new WorldGenerationService(voronoiGenerator);

parentPort?.on("message", async (message: ChunkWorkerRequest) => {
  if (message.type !== "generate") return;

  const start = performance.now();
  try {
    const chunk = await generator.generateChunk(
      message.coords.x,
      message.coords.y,
      message.config,
    );
    const elapsed = performance.now() - start;
    const response: ChunkWorkerResponse = {
      type: "result",
      requestId: message.requestId,
      ok: true,
      chunk,
      timings: {
        generationMs: elapsed,
      },
    };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: ChunkWorkerResponse = {
      type: "result",
      requestId: message.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    parentPort?.postMessage(response);
  }
});
