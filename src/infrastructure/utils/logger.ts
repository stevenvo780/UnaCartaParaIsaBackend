/* eslint-disable no-console */
import fs from "fs";
import path from "path";

/**
 * Advanced logging utility for the backend.
 *
 * Features:
 * - Console output: Only WARN and ERROR levels
 * - Memory buffer: Stores DEBUG and INFO logs
 * - File evacuation: Periodically appends logs to a single JSON file
 * - Throttling: Prevents log spam from repetitive messages
 */

import { LogLevel } from "../../shared/constants/LogEnums";

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
  private evacuationPromise: Promise<void> = Promise.resolve();
  private logFilePath: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDir();
    this.logFilePath = path.join(this.config.logDir, "logs.json");

    const writeIntervalMs = Number(process.env.LOG_WRITE_INTERVAL_MS ?? 5000);
    this.evacuationInterval = setInterval(
      () => this.checkEvacuation(),
      writeIntervalMs,
    );

    if (!fs.existsSync(this.logFilePath)) {
      try {
        fs.writeFileSync(this.logFilePath, "[]", "utf-8");
      } catch (error) {
        console.warn(
          `Failed to create initial log file ${this.logFilePath}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const flushAndExit = async (): Promise<void> => {
      try {
        await this.flush();
      } catch {
        // Ignore flush errors during exit
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
    } catch (error) {
      console.warn(
        `Failed to create log directory ${this.config.logDir}:`,
        error instanceof Error ? error.message : String(error),
      );
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

  private evacuateToFile(): void {
    this.evacuationPromise = this.evacuationPromise.then(() =>
      this.doEvacuate(),
    );
  }

  private async doEvacuate(): Promise<void> {
    if (this.isEvacuating) return;

    if (this.memoryBuffer.length === 0) return;

    this.isEvacuating = true;
    const logsToWrite = [...this.memoryBuffer];
    this.memoryBuffer = [];

    try {
      let existingLogs: LogEntry[] = [];
      try {
        if (fs.existsSync(this.logFilePath)) {
          const fileContent = await fs.promises.readFile(
            this.logFilePath,
            "utf-8",
          );
          if (fileContent.trim()) {
            existingLogs = JSON.parse(fileContent) as LogEntry[];
          }
        }
      } catch (parseError) {
        console.warn("Log file corrupted, starting fresh:", parseError);
        existingLogs = [];
      }

      const allLogs = [...existingLogs, ...logsToWrite];
      const maxLogsInFile = this.config.maxMemoryLogs * 2;
      const logsToKeep = allLogs.slice(-maxLogsInFile);

      await fs.promises.mkdir(this.config.logDir, { recursive: true });
      await fs.promises.writeFile(
        this.logFilePath,
        JSON.stringify(logsToKeep, null, 2),
        "utf-8",
      );

      this.lastEvacuation = Date.now();
    } catch (error) {
      this.memoryBuffer = [...logsToWrite, ...this.memoryBuffer].slice(
        0,
        this.config.maxMemoryLogs,
      );
      console.error("Failed to evacuate logs:", {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: logsToWrite.length,
        filePath: this.logFilePath,
        dirExists: fs.existsSync(this.config.logDir),
        fileExists: fs.existsSync(this.logFilePath),
      });
    } finally {
      this.isEvacuating = false;
    }
  }

  private checkEvacuation(): void {
    const timeSinceLastEvacuation = Date.now() - this.lastEvacuation;
    const minWriteIntervalMs = 3000;

    if (
      this.memoryBuffer.length >= this.config.evacuationThreshold ||
      (this.memoryBuffer.length > 0 &&
        timeSinceLastEvacuation > minWriteIntervalMs)
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

  /**
   * Debug level - shown in console AND stored in memory
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: LogLevel.DEBUG,
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.log(this.formatConsoleMessage(LogLevel.DEBUG, message), ...args);
    } else {
      console.log(this.formatConsoleMessage(LogLevel.DEBUG, message));
    }
  }

  /**
   * Info level - shown in console AND stored in memory
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: LogLevel.INFO,
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.info(this.formatConsoleMessage(LogLevel.INFO, message), ...args);
    } else {
      console.info(this.formatConsoleMessage(LogLevel.INFO, message));
    }
  }

  /**
   * Warn level - shown in console AND stored in memory
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldThrottle(message)) return;

    const entry: LogEntry = {
      level: LogLevel.WARN,
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.warn(this.formatConsoleMessage(LogLevel.WARN, message), ...args);
    } else {
      console.warn(this.formatConsoleMessage(LogLevel.WARN, message));
    }
  }

  /**
   * Error level - shown in console AND stored in memory
   */
  error(message: string, ...args: unknown[]): void {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: this.getTimestamp(),
      data: args.length > 0 ? args : undefined,
    };

    this.addToMemory(entry);

    if (args.length > 0) {
      console.error(
        this.formatConsoleMessage(LogLevel.ERROR, message),
        ...args,
      );
    } else {
      console.error(this.formatConsoleMessage(LogLevel.ERROR, message));
    }
  }

  /**
   * Force immediate evacuation of logs to file
   */
  async flush(): Promise<void> {
    await this.evacuationPromise;
    await this.doEvacuate();
  }

  /**
   * Get current memory buffer size
   */
  getBufferSize(): number {
    return this.memoryBuffer.length;
  }

  /**
   * Retrieves recent logs from memory buffer.
   *
   * @param count - Number of recent logs to retrieve (default: 100)
   * @returns Array of recent log entries, most recent last
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
    void this.evacuationPromise.then(() => this.doEvacuate());
  }
}

export const logger = new Logger();
