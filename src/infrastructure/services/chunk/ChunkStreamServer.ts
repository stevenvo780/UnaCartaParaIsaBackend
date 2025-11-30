import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import type {
  WorldGenConfig,
  TerrainTile,
} from "../../../domain/world/generation/types";
import { ChunkWorkerPool } from "./ChunkWorkerPool";
import type { ChunkPoolStats } from "./ChunkWorkerPool";
import { encodeMsgPack, decodeMessage } from "../../../shared/MessagePackCodec";
import { container } from "../../../config/container";
import { TYPES } from "../../../config/Types";
import type { AnimalSystem } from "../../../domain/simulation/systems/animals/AnimalSystem";
import { logger } from "../../utils/logger";
import { ChunkMessageType } from "../../../shared/constants/WebSocketEnums";
import { UNKNOWN_VALUE as COMMON_UNKNOWN } from "../../../shared/constants/CommonConstants";

interface ChunkRequestMessage {
  type: ChunkMessageType.CHUNK_REQUEST;
  requestId?: string;
  coords: { x: number; y: number };
  config: WorldGenConfig;
}

interface ChunkCancelMessage {
  type: ChunkMessageType.CHUNK_CANCEL;
  requestId: string;
}

interface ClientContext {
  ws: WebSocket;
  inflight: Map<
    string,
    {
      abort: () => void;
    }
  >;
}

interface ChunkResultPayload {
  type: ChunkMessageType.CHUNK_RESULT;
  requestId: string;
  coords: { x: number; y: number };
  chunk: TerrainTile[][];
  timings: {
    generationMs: number;
  };
}

interface ChunkErrorPayload {
  type: ChunkMessageType.CHUNK_ERROR;
  requestId: string;
  error: string;
}

interface ChunkAcceptedPayload {
  type: ChunkMessageType.CHUNK_ACCEPTED;
  requestId: string;
  queueSize: number;
}

interface ChunkServerHello {
  type: ChunkMessageType.CHUNK_STREAM_READY;
  stats: ChunkPoolStats;
}

/**
 * WebSocket server for streaming terrain chunk generation to clients.
 *
 * Features:
 * - Asynchronous chunk generation using worker pool
 * - Request queuing and cancellation
 * - Per-client inflight request limits
 * - MessagePack encoding for efficient transmission
 *
 * @see ChunkWorkerPool for chunk generation workers
 * @see MessagePackCodec for message encoding
 */
export class ChunkStreamServer {
  private readonly pool: ChunkWorkerPool;
  private readonly wss: WebSocketServer;
  private readonly maxInflightPerClient: number;

  constructor(options?: { maxInflight?: number }) {
    this.pool = new ChunkWorkerPool();
    this.maxInflightPerClient = options?.maxInflight ?? 64;
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
  }

  public handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  private handleConnection(ws: WebSocket): void {
    const ctx: ClientContext = {
      ws,
      inflight: new Map(),
    };
    ws.on("message", (event: string | Buffer | ArrayBuffer) =>
      this.handleMessage(ctx, event),
    );
    ws.on("close", () => this.handleDisconnect(ctx));
    ws.on("error", () => this.handleDisconnect(ctx));

    const hello: ChunkServerHello = {
      type: ChunkMessageType.CHUNK_STREAM_READY,
      stats: this.pool.getStats(),
    };
    ws.send(encodeMsgPack(hello));
  }

  private handleMessage(
    ctx: ClientContext,
    raw: string | Buffer | ArrayBuffer,
  ): void {
    let json: unknown;
    try {
      json = decodeMessage<unknown>(raw);
    } catch (error) {
      ctx.ws.send(
        encodeMsgPack({
          type: ChunkMessageType.CHUNK_ERROR,
          requestId: COMMON_UNKNOWN,
          error: `Invalid message: ${error instanceof Error ? error.message : error}`,
        }),
      );
      return;
    }

    if (this.isChunkRequestMessage(json)) {
      this.handleChunkRequest(ctx, json);
      return;
    }

    if (this.isChunkCancelMessage(json)) {
      this.handleChunkCancel(ctx, json);
      return;
    }

    const fallbackId =
      typeof (json as { requestId?: unknown }).requestId === "string"
        ? ((json as { requestId?: string }).requestId as string)
        : COMMON_UNKNOWN;
    ctx.ws.send(
      encodeMsgPack({
        type: ChunkMessageType.CHUNK_ERROR,
        requestId: fallbackId,
        error: "Unsupported chunk message type",
      }),
    );
  }

  private handleChunkRequest(
    ctx: ClientContext,
    message: ChunkRequestMessage,
  ): void {
    if (ctx.inflight.size >= this.maxInflightPerClient) {
      const payload: ChunkErrorPayload = {
        type: ChunkMessageType.CHUNK_ERROR,
        requestId: message.requestId ?? COMMON_UNKNOWN,
        error: `Too many inflight chunk requests (max ${this.maxInflightPerClient})`,
      };
      ctx.ws.send(encodeMsgPack(payload));
      return;
    }

    const requestId = message.requestId ?? randomUUID();
    const controller = new AbortController();
    ctx.inflight.set(requestId, {
      abort: () => controller.abort(),
    });

    const accepted: ChunkAcceptedPayload = {
      type: ChunkMessageType.CHUNK_ACCEPTED,
      requestId,
      queueSize: this.pool.getStats().queueSize,
    };
    ctx.ws.send(encodeMsgPack(accepted));

    this.pool
      .enqueue(requestId, message.coords, message.config, {
        signal: controller.signal,
      })
      .then((result) => {
        try {
          const animalSystem = container.get<AnimalSystem>(TYPES.AnimalSystem);
          const CHUNK_SIZE = 16;
          const tileSize = message.config.tileSize ?? 16;
          const pixelWidth = CHUNK_SIZE * tileSize;
          const pixelHeight = CHUNK_SIZE * tileSize;
          const worldX = message.coords.x * pixelWidth;
          const worldY = message.coords.y * pixelHeight;

          logger.info(
            `🌍 [ChunkStream] Chunk (${message.coords.x},${message.coords.y}) generated, spawning animals at world (${worldX},${worldY})`,
          );

          const spawned = animalSystem.spawnAnimalsForChunk(
            message.coords,
            { x: worldX, y: worldY, width: pixelWidth, height: pixelHeight },
            result.chunk,
          );
          if (spawned > 0) {
            logger.info(
              `🐾 [ChunkStream] Spawned ${spawned} animals for chunk (${message.coords.x},${message.coords.y})`,
            );
          }
        } catch (error) {
          logger.error(
            `❌ [ChunkStream] Failed to spawn animals for chunk: ${error instanceof Error ? error.stack : String(error)}`,
          );
        }

        const payload: ChunkResultPayload = {
          type: ChunkMessageType.CHUNK_RESULT,
          requestId,
          coords: message.coords,
          chunk: result.chunk,
          timings: result.timings,
        };
        ctx.ws.send(encodeMsgPack(payload));
      })
      .catch((error: Error) => {
        const payload: ChunkErrorPayload = {
          type: ChunkMessageType.CHUNK_ERROR,
          requestId,
          error: error.message,
        };
        ctx.ws.send(encodeMsgPack(payload));
      })
      .finally(() => {
        ctx.inflight.delete(requestId);
      });
  }

  private handleChunkCancel(
    ctx: ClientContext,
    message: ChunkCancelMessage,
  ): void {
    const entry = ctx.inflight.get(message.requestId);
    if (!entry) {
      ctx.ws.send(
        encodeMsgPack({
          type: ChunkMessageType.CHUNK_ERROR,
          requestId: message.requestId,
          error: "Request not found or already completed",
        }),
      );
      return;
    }
    entry.abort();
    ctx.inflight.delete(message.requestId);
    ctx.ws.send(
      encodeMsgPack({
        type: ChunkMessageType.CHUNK_CANCELLED,
        requestId: message.requestId,
      }),
    );
  }

  private handleDisconnect(ctx: ClientContext): void {
    for (const [, entry] of ctx.inflight) {
      entry.abort();
    }
    ctx.inflight.clear();
  }

  private isChunkRequestMessage(value: unknown): value is ChunkRequestMessage {
    if (!value || typeof value !== "object") return false;
    const message = value as Record<string, unknown>;
    if (message.type !== ChunkMessageType.CHUNK_REQUEST) return false;
    if (
      !message.coords ||
      typeof message.coords !== "object" ||
      typeof (message.coords as { x?: unknown }).x !== "number" ||
      typeof (message.coords as { y?: unknown }).y !== "number"
    ) {
      return false;
    }
    return typeof message.config === "object" && message.config !== null;
  }

  private isChunkCancelMessage(value: unknown): value is ChunkCancelMessage {
    if (!value || typeof value !== "object") return false;
    const message = value as Record<string, unknown>;
    return (
      message.type === ChunkMessageType.CHUNK_CANCEL &&
      typeof message.requestId === "string"
    );
  }
}
