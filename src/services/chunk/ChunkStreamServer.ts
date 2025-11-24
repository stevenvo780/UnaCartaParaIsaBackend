import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import type { WorldGenConfig } from "../../generation/types.js";
import { ChunkWorkerPool } from "./ChunkWorkerPool.js";
import type { ChunkPoolStats } from "./ChunkWorkerPool.js";

interface ChunkRequestMessage {
  type: "CHUNK_REQUEST";
  requestId?: string;
  coords: { x: number; y: number };
  config: WorldGenConfig;
}

interface ChunkCancelMessage {
  type: "CHUNK_CANCEL";
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
  type: "CHUNK_RESULT";
  requestId: string;
  coords: { x: number; y: number };
  chunk: unknown;
  timings: {
    generationMs: number;
  };
}

interface ChunkErrorPayload {
  type: "CHUNK_ERROR";
  requestId: string;
  error: string;
}

interface ChunkAcceptedPayload {
  type: "CHUNK_ACCEPTED";
  requestId: string;
  queueSize: number;
}

interface ChunkServerHello {
  type: "CHUNK_STREAM_READY";
  stats: ChunkPoolStats;
}

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
    ws.on("message", (event) => this.handleMessage(ctx, event));
    ws.on("close", () => this.handleDisconnect(ctx));
    ws.on("error", () => this.handleDisconnect(ctx));

    const hello: ChunkServerHello = {
      type: "CHUNK_STREAM_READY",
      stats: this.pool.getStats(),
    };
    ws.send(JSON.stringify(hello));
  }

  private handleMessage(ctx: ClientContext, raw: WebSocket.RawData): void {
    let json: unknown;
    try {
      json = JSON.parse(raw.toString());
    } catch (error) {
      ctx.ws.send(
        JSON.stringify({
          type: "CHUNK_ERROR",
          requestId: "unknown",
          error: `Invalid JSON: ${error instanceof Error ? error.message : error}`,
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
        : "unknown";
    ctx.ws.send(
      JSON.stringify({
        type: "CHUNK_ERROR",
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
        type: "CHUNK_ERROR",
        requestId: message.requestId ?? "unknown",
        error: `Too many inflight chunk requests (max ${this.maxInflightPerClient})`,
      };
      ctx.ws.send(JSON.stringify(payload));
      return;
    }

    const requestId = message.requestId ?? randomUUID();
    const controller = new AbortController();
    ctx.inflight.set(requestId, {
      abort: () => controller.abort(),
    });

    const accepted: ChunkAcceptedPayload = {
      type: "CHUNK_ACCEPTED",
      requestId,
      queueSize: this.pool.getStats().queueSize,
    };
    ctx.ws.send(JSON.stringify(accepted));

    this.pool
      .enqueue(requestId, message.coords, message.config, {
        signal: controller.signal,
      })
      .then((result) => {
        const payload: ChunkResultPayload = {
          type: "CHUNK_RESULT",
          requestId,
          coords: message.coords,
          chunk: result.chunk,
          timings: result.timings,
        };
        ctx.ws.send(JSON.stringify(payload));
      })
      .catch((error: Error) => {
        const payload: ChunkErrorPayload = {
          type: "CHUNK_ERROR",
          requestId,
          error: error.message,
        };
        ctx.ws.send(JSON.stringify(payload));
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
        JSON.stringify({
          type: "CHUNK_ERROR",
          requestId: message.requestId,
          error: "Request not found or already completed",
        }),
      );
      return;
    }
    entry.abort();
    ctx.inflight.delete(message.requestId);
    ctx.ws.send(
      JSON.stringify({
        type: "CHUNK_CANCELLED",
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
    if (message.type !== "CHUNK_REQUEST") return false;
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
      message.type === "CHUNK_CANCEL" && typeof message.requestId === "string"
    );
  }
}
