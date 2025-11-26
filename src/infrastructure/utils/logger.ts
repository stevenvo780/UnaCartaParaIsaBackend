/* eslint-disable no-console */
import fs from "fs";
import path from "path";

/**
 * Advanced logging utility for the backend.
 *
 * Features:
 * - Console output: Only WARN and ERROR levels
 * - Memory buffer: Stores DEBUG and INFO logs
 * - File evacuation: Periodically writes logs to JSON files
 * - Throttling: Prevents log spam from repetitive messages
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

interface LoggerConfig {
  maxMemoryLogs: number;
  evacuationThreshold: number;
  logDir: string;
  throttleWindowMs: number;
  maxThrottleCount: number;
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxMemoryLogs: 5000,
  evacuationThreshold: Number(process.env.LOG_EVACUATION_THRESHOLD ?? 4000),
  logDir: process.env.LOG_DIR
    ? path.resolve(process.env.LOG_DIR)
    : path.join(process.cwd(), "logs"),
  throttleWindowMs: Number(process.env.LOG_THROTTLE_WINDOW_MS ?? 5000),
  maxThrottleCount: Number(process.env.LOG_MAX_THROTTLE_COUNT ?? 3),
};

/**
 * Logger class with memory buffering and file evacuation.
 * Console: Only WARN/ERROR
 * Memory: All levels (DEBUG, INFO, WARN, ERROR)
 * Files: Evacuated periodically to JSON
 */
class Logger {
  private config: LoggerConfig;
  private memoryBuffer: LogEntry[] = [];
  private throttleMap = new Map<string, { count: number; lastTime: number }>();
  private isEvacuating = false;
  private lastEvacuation = Date.now();
  private evacuationInterval?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDir();

    // Periodic evacuation check (every 30 seconds)
    this.evacuationInterval = setInterval(() => this.checkEvacuation(), 30000);

    // Flush on common exit signals to avoid losing buffered logs
    const flushAndExit = async (): Promise<void> => {
      try {
        await this.flush();
      } catch {
        /* ignore */
      }
    };
    process.on("beforeExit", flushAndExit);
    process.on("exit", () => this.destroy());
    process.on("SIGINT", async () => {
      await flushAndExit();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await flushAndExit();
      process.exit(0);
    });
  }

  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
    } catch {
      // Silently fail if we can't create log dir
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatConsoleMessage(level: LogLevel, message: string): string {
    const timestamp = this.getTimestamp();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private shouldThrottle(message: string): boolean {
    const now = Date.now();
    const key = message.substring(0, 100);
    const entry = this.throttleMap.get(key);

    if (!entry) {
      this.throttleMap.set(key, { count: 1, lastTime: now });
      return false;
    }

    if (now - entry.lastTime > this.config.throttleWindowMs) {
      entry.count = 1;
      entry.lastTime = now;
      return false;
    }

    entry.count++;
    return entry.count > this.config.maxThrottleCount;
  }

  private addToMemory(entry: LogEntry): void {
    this.memoryBuffer.push(entry);

    if (this.memoryBuffer.length >= this.config.evacuationThreshold) {
      this.evacuateToFile();
    }
  }

  private async evacuateToFile(): Promise<void> {
    if (this.isEvacuating || this.memoryBuffer.length === 0) return;

    this.isEvacuating = true;
    const logsToWrite = [...this.memoryBuffer];
    this.memoryBuffer = [];

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `logs_${timestamp}.json`;
      const filepath = path.join(this.config.logDir, filename);

      await fs.promises.writeFile(
        filepath,
        JSON.stringify(logsToWrite, null, 2),
        "utf-8",
      );

      this.lastEvacuation = Date.now();
      this.cleanOldLogs();
    } catch (error) {
      // Re-add logs to buffer if write failed
      this.memoryBuffer = [...logsToWrite, ...this.memoryBuffer].slice(
        0,
        this.config.maxMemoryLogs,
      );
      console.error("Failed to evacuate logs:", error);
    } finally {
      this.isEvacuating = false;
    }
  }

  private checkEvacuation(): void {
    const timeSinceLastEvacuation = Date.now() - this.lastEvacuation;
    const forceIntervalMs = Number(process.env.LOG_FORCE_INTERVAL_MS ?? 60000); // 1 min default
    if (
      this.memoryBuffer.length >= this.config.evacuationThreshold ||
      this.memoryBuffer.length > this.config.evacuationThreshold / 2 ||
      (this.memoryBuffer.length > 100 && timeSinceLastEvacuation > 300000) ||
      (this.memoryBuffer.length > 0 &&
        timeSinceLastEvacuation > forceIntervalMs)
    ) {
      void this.evacuateToFile();
    }

    const now = Date.now();
    for (const [key, entry] of this.throttleMap) {
      if (now - entry.lastTime > this.config.throttleWindowMs * 2) {
        this.throttleMap.delete(key);
      }
    }
  }

  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.config.logDir);
      const logFiles = files
        .filter((f) => f.startsWith("logs_") && f.endsWith(".json"))
        .sort()
        .reverse();

      // Keep only last 20 log files
      const filesToDelete = logFiles.slice(20);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(this.config.logDir, file));
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Debug level - stored in memory only, not shown in console
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: "debug",
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);
  }

  /**
   * Info level - stored in memory only, not shown in console
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);
  }

  /**
   * Warn level - shown in console AND stored in memory
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.warn(this.formatConsoleMessage("warn", message), ...args);
    } else {
      console.warn(this.formatConsoleMessage("warn", message));
    }
  }

  /**
   * Error level - shown in console AND stored in memory
   */
  error(message: string, ...args: unknown[]): void {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.error(this.formatConsoleMessage("error", message), ...args);
    } else {
      console.error(this.formatConsoleMessage("error", message));
    }
  }

  /**
   * Force immediate evacuation of logs to file
   */
  async flush(): Promise<void> {
    await this.evacuateToFile();
  }

  /**
   * Get current memory buffer size
   */
  getBufferSize(): number {
    return this.memoryBuffer.length;
  }

  /**
   * Get recent logs from memory (for debugging)
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.memoryBuffer.slice(-count);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.evacuationInterval) {
      clearInterval(this.evacuationInterval);
    }
    void this.evacuateToFile();
  }
}

export const logger = new Logger();
