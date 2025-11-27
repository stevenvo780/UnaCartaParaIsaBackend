import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { CONFIG } from "../config/config";
import { container } from "../config/container";
import { TYPES } from "../config/Types";
import { SimulationRunner } from "../domain/simulation/core/SimulationRunner";
import { detectGPUAvailability } from "../infrastructure/utils/gpuDetector";
import { encodeMsgPack, decodeMessage } from "../shared/MessagePackCodec";
import type {
  SimulationCommand,
  SimulationRequest,
} from "../shared/types/commands/SimulationCommand";
import { ChunkStreamServer } from "../infrastructure/services/chunk/chunk/ChunkStreamServer";
import { logger } from "../infrastructure/utils/logger.js";

/**
 * Main server entry point.
 *
 * Initializes the simulation runner and sets up HTTP and WebSocket servers.
 * Handles WebSocket upgrades for two endpoints:
 * - `/ws/sim` - Real-time simulation state streaming (50Hz snapshots)
 * - `/ws/chunks` - Asynchronous terrain chunk generation streaming
 *
 * The simulation runner maintains authoritative game state and broadcasts
 * tick snapshots to connected clients via MessagePack encoding.
 *
 * @module application
 */

const simulationRunner = container.get<SimulationRunner>(
  TYPES.SimulationRunner,
);

console.log("🚀 [SERVER] Backend starting...");
logger.info("🚀 Backend: Starting simulation initialization process...");

import { storageService } from "../infrastructure/services/storage/storageService";
import { GameState } from "../domain/types/game-types";

// Define server variable in outer scope so it's accessible for upgrade handling
let server: ReturnType<typeof app.listen>;
const simulationWss = new WebSocketServer({ noServer: true });
const chunkStreamServer = new ChunkStreamServer({ maxInflight: 128 });
let cachedTickBuffer: Buffer | null = null;
let cachedTickNumber = -1;

console.log("🚀 [SERVER] Starting simulation initialization...");
simulationRunner
  .initialize()
  .then(async () => {
    console.log("🚀 [SERVER] SimulationRunner.initialize() completed");
    logger.info("✅ Backend: SimulationRunner initialized successfully");

    const saves = await storageService.listSaves();
    console.log(`🚀 [SERVER] Found ${saves.length} saves`);
    if (saves.length > 0) {
      const latestSaveId = saves[0].id;
      console.log(`🚀 [SERVER] Loading save: ${latestSaveId}`);
      logger.info(`💾 Found existing save: ${latestSaveId}. Loading...`);
      const saveData = await storageService.getSave(latestSaveId);

      if (saveData && saveData.state) {
        console.log("🚀 [SERVER] Save data loaded, restoring state...");
        const gameState = container.get<GameState>(TYPES.GameState);
        Object.assign(gameState, saveData.state);

        await simulationRunner.ensureInitialFamily();

        console.log("🚀 [SERVER] State restored, starting simulation...");
        logger.info("✅ Backend: State loaded and family verified");
        simulationRunner.start();
        console.log("🚀 [SERVER] Simulation STARTED from save");
        logger.info("✅ Backend: Simulation started from save");
      } else {
        // Fallback if save is corrupted
        console.log("🚀 [SERVER] Save invalid, initializing fresh world...");
        logger.warn("⚠️ Saved state invalid. Falling back to fresh world.");
        await initializeFreshWorld();
      }
    } else {
      console.log("🚀 [SERVER] No saves found, initializing fresh world...");
      logger.info("🆕 No valid save found. Initializing fresh world...");
      await initializeFreshWorld();
    }

    // Initialize hardware and start server ONLY after simulation is ready
    console.log("🚀 [SERVER] Detecting GPU availability...");
    detectGPUAvailability();

    console.log(`🚀 [SERVER] Starting HTTP server on port ${CONFIG.PORT}...`);
    server = app.listen(CONFIG.PORT, () => {
      console.log(`🚀 [SERVER] HTTP server listening on port ${CONFIG.PORT}`);
      logger.info(`Save server running on http://localhost:${CONFIG.PORT}`);
      if (!CONFIG.USE_LOCAL_STORAGE) {
        logger.info(`Using GCS bucket: ${CONFIG.BUCKET_NAME}`);
      } else {
        logger.info(`Using local storage: ${CONFIG.LOCAL_SAVES_PATH}`);
      }
    });

    console.log("🚀 [SERVER] Setting up WebSocket upgrades...");
    setupServerUpgrades();
    console.log("🚀 [SERVER] === SERVER FULLY STARTED ===");
  })
  .catch((err) => {
    console.error("❌ [SERVER] FATAL: Failed to initialize simulation:", err);
    logger.error("❌ Backend: Failed to initialize simulation:", err);
    process.exit(1); // Exit if critical initialization fails
  });

async function initializeFreshWorld() {
  return simulationRunner
    .initializeWorldResources({
      width: 128,
      height: 128,
      tileSize: 32,
      biomeMap: [],
    })
    .then(() => {
      logger.info("🌍 Backend: World resources initialized");
      simulationRunner.start();
      logger.info("✅ Backend: Simulation started and running");
    });
}

function setupServerUpgrades() {
  server.on("upgrade", (request, socket, head) => {
    const host = request.headers.host ?? "localhost";
    const url = request.url ?? "/";
    let pathname: string;
    try {
      pathname = new URL(url, `http://${host}`).pathname;
    } catch (error) {
      logger.debug("Invalid URL in WebSocket upgrade request", {
        url,
        host,
        error: error instanceof Error ? error.message : String(error),
      });
      socket.destroy();
      return;
    }

    if (pathname === "/ws/sim") {
      simulationWss.handleUpgrade(request, socket, head, (ws) => {
        simulationWss.emit("connection", ws, request);
      });
      return;
    }

    if (pathname === "/ws/chunks") {
      chunkStreamServer.handleUpgrade(request, socket, head);
      return;
    }

    socket.destroy();
  });
}

simulationWss.on("connection", (ws: WebSocket) => {
  console.log("📡 [WS] New client connected to /ws/sim");
  logger.info("Client connected to simulation");

  const snapshot = simulationRunner.getInitialSnapshot();
  console.log(`📡 [WS] Sending initial SNAPSHOT: tick=${snapshot.tick}`);
  ws.send(
    encodeMsgPack({
      type: "SNAPSHOT",
      payload: snapshot,
    }),
  );

  const tickHandler = (): void => {
    if (ws.readyState === WebSocket.OPEN && cachedTickBuffer) {
      ws.send(cachedTickBuffer);
    }
  };

  simulationRunner.on("tick", tickHandler);

  ws.on("close", () => {
    console.log("📡 [WS] Client disconnected from /ws/sim");
    simulationRunner.off("tick", tickHandler);
  });

  ws.on("message", (data: Buffer) => {
    try {
      const parsed = decodeMessage<Record<string, unknown>>(data);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("type" in parsed) ||
        typeof parsed.type !== "string"
      ) {
        ws.send(
          encodeMsgPack({
            type: "ERROR",
            message: "Invalid command format",
          }),
        );
        return;
      }

      const command = parsed as SimulationCommand | SimulationRequest;

      if (command.type.startsWith("REQUEST_")) {
        const request = command as SimulationRequest;
        let responsePayload: unknown = null;

        switch (request.type) {
          case "REQUEST_FULL_STATE":
            responsePayload = simulationRunner.getInitialSnapshot();
            break;
          case "REQUEST_ENTITY_DETAILS":
            responsePayload = simulationRunner.getEntityDetails(
              request.entityId,
            );
            break;
          case "REQUEST_PLAYER_ID":
            responsePayload = { playerId: simulationRunner.getPlayerId() };
            break;
        }

        ws.send(
          encodeMsgPack({
            type: "RESPONSE",
            requestId: request.requestId,
            payload: responsePayload,
          }),
        );
        return;
      }

      logger.info(`📨 Received command from client: ${command.type}`, command);
      const accepted = simulationRunner.enqueueCommand(
        command as SimulationCommand,
      );
      if (!accepted) {
        logger.warn(`⚠️ Command rejected (queue full): ${command.type}`);
        ws.send(
          encodeMsgPack({ type: "ERROR", message: "Command queue full" }),
        );
      } else {
        logger.info(`✅ Command enqueued successfully: ${command.type}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Failed to parse command:", errorMessage);
      ws.send(
        encodeMsgPack({
          type: "ERROR",
          message: "Failed to parse command",
        }),
      );
    }
  });
});

simulationRunner.on("tick", (snapshot: unknown) => {
  const currentTick = (snapshot as { tick?: number }).tick ?? 0;
  if (currentTick !== cachedTickNumber || !cachedTickBuffer) {
    cachedTickBuffer = encodeMsgPack({
      type: "TICK",
      payload: snapshot,
    });
    cachedTickNumber = currentTick;
  }

  for (const client of simulationWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(cachedTickBuffer!);
    }
  }
});
