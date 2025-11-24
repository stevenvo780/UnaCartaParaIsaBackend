import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { CONFIG } from "../config/config";
import { simulationRunner } from "../domain/simulation/core/index";
import type { SimulationCommand } from "../shared/types/commands/SimulationCommand";
import { ChunkStreamServer } from "../infrastructure/services/chunk/chunk/ChunkStreamServer";

const server = app.listen(CONFIG.PORT, () => {
  console.log(`🎮 Save server running on http://localhost:${CONFIG.PORT}`);
  if (!CONFIG.USE_LOCAL_STORAGE) {
    console.log(`☁️  Using GCS bucket: ${CONFIG.BUCKET_NAME}`);
  } else {
    console.log(`📁 Using local storage: ${CONFIG.LOCAL_SAVES_PATH}`);
  }
});

// WebSocket Setup
const simulationWss = new WebSocketServer({ noServer: true });
const chunkStreamServer = new ChunkStreamServer({ maxInflight: 128 });

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
  console.log("Client connected to simulation");

  ws.send(
    JSON.stringify({
      type: "SNAPSHOT",
      payload: simulationRunner.getSnapshot(),
    }),
  );

  ws.on("message", (data: string) => {
    try {
      const command = JSON.parse(data.toString()) as SimulationCommand;
      const accepted = simulationRunner.enqueueCommand(command);
      if (!accepted) {
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Command queue full" }),
        );
      }
    } catch (err) {
      console.error("Failed to parse command:", err);
    }
  });
});

simulationRunner.on("tick", (snapshot) => {
  const message = JSON.stringify({
    type: "TICK",
    payload: snapshot,
  });

  simulationWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});
