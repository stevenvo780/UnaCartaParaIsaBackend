import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { CONFIG } from "../config/config";
import { container } from "../config/container";
import { TYPES } from "../config/Types";
import { SimulationRunner } from "../domain/simulation/core/SimulationRunner";

const simulationRunner = container.get<SimulationRunner>(
  TYPES.SimulationRunner,
);
simulationRunner.initialize();

simulationRunner
  .initializeWorldResources({
    width: 128,
    height: 128,
    tileSize: 32,
    biomeMap: [],
  })
  .then(() => {
    logger.info("World resources initialized");
    simulationRunner.start();
  })
  .catch((err) => {
    logger.error("Failed to initialize world resources:", err);
  });
import type {
  SimulationCommand,
  SimulationRequest,
} from "../shared/types/commands/SimulationCommand";
import { ChunkStreamServer } from "../infrastructure/services/chunk/chunk/ChunkStreamServer";
import { logger } from "../infrastructure/utils/logger.js";

const server = app.listen(CONFIG.PORT, () => {
  logger.info(`Save server running on http://localhost:${CONFIG.PORT}`);
  if (!CONFIG.USE_LOCAL_STORAGE) {
    logger.info(`Using GCS bucket: ${CONFIG.BUCKET_NAME}`);
  } else {
    logger.info(`Using local storage: ${CONFIG.LOCAL_SAVES_PATH}`);
  }
});

const simulationWss = new WebSocketServer({ noServer: true });
const chunkStreamServer = new ChunkStreamServer({ maxInflight: 128 });

let cachedTickMessage: string | null = null;
let cachedTickNumber = -1;

server.on("upgrade", (request, socket, head) => {
  const host = request.headers.host ?? "localhost";
  const url = request.url ?? "/";
  let pathname: string;
  try {
    pathname = new URL(url, `http://${host}`).pathname;
  } catch {
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

simulationWss.on("connection", (ws: WebSocket) => {
  logger.info("Client connected to simulation");

  ws.send(
    JSON.stringify({
      type: "SNAPSHOT",
      payload: simulationRunner.getInitialSnapshot(),
    }),
  );

  const tickHandler = (): void => {
    if (ws.readyState === WebSocket.OPEN && cachedTickMessage) {
      ws.send(cachedTickMessage);
    }
  };

  simulationRunner.on("tick", tickHandler);

  ws.on("close", () => {
    simulationRunner.off("tick", tickHandler);
  });

  ws.on("message", (data: Buffer) => {
    try {
      const message = data.toString();
      if (message.length > 10000) {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            message: "Message too large",
          }),
        );
        return;
      }

      const parsed = JSON.parse(message) as Record<string, unknown>;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("type" in parsed) ||
        typeof parsed.type !== "string"
      ) {
        ws.send(
          JSON.stringify({
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
          JSON.stringify({
            type: "RESPONSE",
            requestId: request.requestId,
            payload: responsePayload,
          }),
        );
        return;
      }

      const accepted = simulationRunner.enqueueCommand(
        command as SimulationCommand,
      );
      if (!accepted) {
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Command queue full" }),
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Failed to parse command:", errorMessage);
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "Failed to parse command",
        }),
      );
    }
  });
});

simulationRunner.on("tick", (snapshot: unknown) => {
  const currentTick = (snapshot as { tick?: number }).tick ?? 0;
  if (currentTick !== cachedTickNumber || !cachedTickMessage) {
    cachedTickMessage = JSON.stringify({
      type: "TICK",
      payload: snapshot,
    });
    cachedTickNumber = currentTick;
  }

  simulationWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(cachedTickMessage!);
    }
  });
});
