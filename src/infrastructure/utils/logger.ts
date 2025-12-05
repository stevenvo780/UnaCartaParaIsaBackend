/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import { RandomUtils } from "@/shared/utils/RandomUtils";

/**
 * Advanced logging utility for the backend with behavior analysis support.
 *
 * Features:
 * - Console output with colored levels
 * - Memory buffer with periodic file evacuation
 * - Daily rotating log files for historical analysis
 * - Category-based logging for subsystem identification
 * - Correlation IDs for tracking related events
 * - Aggregated metrics per category/level
 * - Export utilities for log analysis
 * - Throttling to prevent log spam
 */

import { LogLevel, LogCategory } from "../../shared/constants/LogEnums";

/**
 * Extended log entry with category and correlation support.
 */
export interface LogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** Log severity level */
  level: LogLevel;
  /** Log category/subsystem */
  category: LogCategory;
  /** Human-readable message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Unix timestamp for sorting/filtering */
  timestampMs: number;
  /** Optional correlation ID to link related events */
  correlationId?: string;
  /** Optional agent ID if log relates to a specific agent */
  agentId?: string;
  /** Current simulation tick when log was created */
  tick?: number;
  /** Additional structured data */
  data?: unknown;
}

/**
 * Aggregated metrics for analysis.
 */
interface LogMetrics {
  /** Count by level */
  byLevel: Record<LogLevel, number>;
  /** Count by category */
  byCategory: Record<LogCategory, number>;
  /** Count by level and category */
  byCategoryAndLevel: Record<LogCategory, Record<LogLevel, number>>;
  /** First log timestamp */
  startTime: number;
  /** Last log timestamp */
  endTime: number;
  /** Total log count */
  totalCount: number;
}

/**
 * Filter options for log queries.
 */
export interface LogFilter {
  /** Filter by levels */
  levels?: LogLevel[];
  /** Filter by categories */
  categories?: LogCategory[];
  /** Filter by correlation ID */
  correlationId?: string;
  /** Filter by agent ID */
  agentId?: string;
  /** Start time (unix ms) */
  startTime?: number;
  /** End time (unix ms) */
  endTime?: number;
  /** Text search in message */
  messageContains?: string;
  /** Maximum results */
  limit?: number;
}

interface LoggerConfig {
  maxMemoryLogs: number;
  evacuationThreshold: number;
  logDir: string;
  throttleWindowMs: number;
  maxThrottleCount: number;
  /** Enable daily file rotation */
  enableRotation: boolean;
  /** Max days to keep rotated files */
  maxRotationDays: number;
  /** Enable JSON Lines format for easy parsing */
  useJsonLines: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxMemoryLogs: 5000,
  evacuationThreshold: Number(process.env.LOG_EVACUATION_THRESHOLD ?? 4000),
  logDir: process.env.LOG_DIR
    ? path.resolve(process.env.LOG_DIR)
    : path.join(process.cwd(), "logs"),
  throttleWindowMs: Number(process.env.LOG_THROTTLE_WINDOW_MS ?? 5000),
  maxThrottleCount: Number(process.env.LOG_MAX_THROTTLE_COUNT ?? 3),
  enableRotation: process.env.LOG_ENABLE_ROTATION !== "false",
  maxRotationDays: Number(process.env.LOG_MAX_ROTATION_DAYS ?? 7),
  useJsonLines: process.env.LOG_USE_JSONLINES !== "false",
};

/**
 * Generate a unique ID for log entries.
 */
function generateLogId(): string {
  return `${Date.now()}-${RandomUtils.float().toString(36).substring(2, 9)}`;
}

/**
 * Get current date string for file rotation (YYYY-MM-DD).
 */
function getDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Logger class with memory buffering, file evacuation, and analysis support.
 * Console: All levels with colors
 * Memory: All levels with full metadata
 * Files: Rotated daily with JSON/JSONL format
 */
class Logger {
  private config: LoggerConfig;
  private memoryBuffer: LogEntry[] = [];
  private throttleMap = new Map<string, { count: number; lastTime: number }>();
  private isEvacuating = false;
  private lastEvacuation = Date.now();
  private evacuationInterval?: NodeJS.Timeout;
  private evacuationPromise: Promise<void> = Promise.resolve();
  private currentLogDate: string;
  private metrics: LogMetrics;
  private currentTick = 0;
  private activeCorrelationId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDir();
    this.currentLogDate = getDateString();
    this.metrics = this.initMetrics();

    const writeIntervalMs = Number(process.env.LOG_WRITE_INTERVAL_MS ?? 5000);
    this.evacuationInterval = setInterval(
      () => this.checkEvacuation(),
      writeIntervalMs,
    );

    this.ensureLogFile();

    const flushAndExit = async (): Promise<void> => {
      try {
        await this.flush();
      } catch (error) {
        console.error(
          "Failed to flush logs on exit:",
          error instanceof Error ? error.message : String(error),
        );
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

  private initMetrics(): LogMetrics {
    const byLevel = {} as Record<LogLevel, number>;
    const byCategory = {} as Record<LogCategory, number>;
    const byCategoryAndLevel = {} as Record<
      LogCategory,
      Record<LogLevel, number>
    >;

    for (const level of Object.values(LogLevel)) {
      byLevel[level] = 0;
    }
    for (const cat of Object.values(LogCategory)) {
      byCategory[cat] = 0;
      byCategoryAndLevel[cat] = {} as Record<LogLevel, number>;
      for (const level of Object.values(LogLevel)) {
        byCategoryAndLevel[cat][level] = 0;
      }
    }

    return {
      byLevel,
      byCategory,
      byCategoryAndLevel,
      startTime: Date.now(),
      endTime: Date.now(),
      totalCount: 0,
    };
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

  private getLogFilePath(): string {
    if (this.config.enableRotation) {
      const ext = this.config.useJsonLines ? "jsonl" : "json";
      return path.join(
        this.config.logDir,
        `logs-${this.currentLogDate}.${ext}`,
      );
    }
    return path.join(
      this.config.logDir,
      this.config.useJsonLines ? "logs.jsonl" : "logs.json",
    );
  }

  private ensureLogFile(): void {
    const logFilePath = this.getLogFilePath();
    if (!fs.existsSync(logFilePath)) {
      try {
        const initialContent = this.config.useJsonLines ? "" : "[]";
        fs.writeFileSync(logFilePath, initialContent, "utf-8");
      } catch (error) {
        console.warn(
          `Failed to create initial log file ${logFilePath}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private checkDateRotation(): void {
    const today = getDateString();
    if (today !== this.currentLogDate) {
      void this.flush();
      this.currentLogDate = today;
      this.ensureLogFile();
      this.cleanupOldLogs();
    }
  }

  private cleanupOldLogs(): void {
    if (!this.config.enableRotation) return;

    try {
      const files = fs.readdirSync(this.config.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxRotationDays);

      for (const file of files) {
        const match = file.match(/^logs-(\d{4}-\d{2}-\d{2})\.(json|jsonl)$/);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(this.config.logDir, file));
          }
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup old logs:", error);
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatConsoleMessage(
    level: LogLevel,
    category: LogCategory,
    message: string,
  ): string {
    const timestamp = this.getTimestamp();
    const levelColors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: "\x1b[36m",
      [LogLevel.INFO]: "\x1b[32m",
      [LogLevel.WARN]: "\x1b[33m",
      [LogLevel.ERROR]: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const color = levelColors[level] || "";
    return `${color}[${timestamp}] [${level.toUpperCase()}] [${category}]${reset} ${message}`;
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

  private updateMetrics(entry: LogEntry): void {
    this.metrics.byLevel[entry.level]++;
    this.metrics.byCategory[entry.category]++;
    this.metrics.byCategoryAndLevel[entry.category][entry.level]++;
    this.metrics.endTime = entry.timestampMs;
    this.metrics.totalCount++;
  }

  private addToMemory(entry: LogEntry): void {
    this.memoryBuffer.push(entry);
    this.updateMetrics(entry);

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

    this.checkDateRotation();
    this.isEvacuating = true;
    const logsToWrite = [...this.memoryBuffer];
    this.memoryBuffer = [];

    const logFilePath = this.getLogFilePath();

    try {
      if (this.config.useJsonLines) {
        const lines = logsToWrite.map((log) => JSON.stringify(log)).join("\n");
        await fs.promises.appendFile(logFilePath, lines + "\n", "utf-8");
      } else {
        let existingLogs: LogEntry[] = [];
        try {
          if (fs.existsSync(logFilePath)) {
            const fileContent = await fs.promises.readFile(
              logFilePath,
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

        await fs.promises.writeFile(
          logFilePath,
          JSON.stringify(logsToKeep, null, 2),
          "utf-8",
        );
      }

      this.lastEvacuation = Date.now();
    } catch (error) {
      this.memoryBuffer = [...logsToWrite, ...this.memoryBuffer].slice(
        0,
        this.config.maxMemoryLogs,
      );
      console.error("Failed to evacuate logs:", {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: logsToWrite.length,
        filePath: logFilePath,
      });
    } finally {
      this.isEvacuating = false;
    }
  }

  private checkEvacuation(): void {
    this.checkDateRotation();

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
   * Set the current simulation tick for log context.
   */
  setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Start a correlation context for related logs.
   * @returns The correlation ID to use or pass to related operations
   */
  startCorrelation(prefix?: string): string {
    this.activeCorrelationId = `${prefix || "corr"}-${generateLogId()}`;
    return this.activeCorrelationId;
  }

  /**
   * End the current correlation context.
   */
  endCorrelation(): void {
    this.activeCorrelationId = undefined;
  }

  /**
   * Create a log entry with full metadata.
   */
  private createEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options?: {
      correlationId?: string;
      agentId?: string;
      data?: unknown;
    },
  ): LogEntry {
    const now = Date.now();
    return {
      id: generateLogId(),
      level,
      category,
      message,
      timestamp: new Date(now).toISOString(),
      timestampMs: now,
      correlationId: options?.correlationId || this.activeCorrelationId,
      agentId: options?.agentId,
      tick: this.currentTick,
      data: options?.data,
    };
  }

  /**
   * Log with explicit category and options.
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options?: { correlationId?: string; agentId?: string; data?: unknown },
  ): void {
    if (this.shouldThrottle(message)) return;

    const entry = this.createEntry(level, category, message, options);
    this.addToMemory(entry);

    const consoleMsg = this.formatConsoleMessage(level, category, message);
    switch (level) {
      case LogLevel.DEBUG:
        console.log(consoleMsg, options?.data ?? "");
        break;
      case LogLevel.INFO:
        console.info(consoleMsg, options?.data ?? "");
        break;
      case LogLevel.WARN:
        console.warn(consoleMsg, options?.data ?? "");
        break;
      case LogLevel.ERROR:
        console.error(consoleMsg, options?.data ?? "");
        break;
    }
  }

  /**
   * Debug level log with category.
   */
  debug(
    message: string,
    categoryOrData?: LogCategory | unknown,
    data?: unknown,
  ): void {
    const category =
      typeof categoryOrData === "string" &&
      Object.values(LogCategory).includes(categoryOrData as LogCategory)
        ? (categoryOrData as LogCategory)
        : LogCategory.GENERAL;
    const logData = category === categoryOrData ? data : categoryOrData;

    this.log(LogLevel.DEBUG, category, message, { data: logData });
  }

  /**
   * Info level log with category.
   */
  info(
    message: string,
    categoryOrData?: LogCategory | unknown,
    data?: unknown,
  ): void {
    const category =
      typeof categoryOrData === "string" &&
      Object.values(LogCategory).includes(categoryOrData as LogCategory)
        ? (categoryOrData as LogCategory)
        : LogCategory.GENERAL;
    const logData = category === categoryOrData ? data : categoryOrData;

    this.log(LogLevel.INFO, category, message, { data: logData });
  }

  /**
   * Warn level log with category.
   */
  warn(
    message: string,
    categoryOrData?: LogCategory | unknown,
    data?: unknown,
  ): void {
    const category =
      typeof categoryOrData === "string" &&
      Object.values(LogCategory).includes(categoryOrData as LogCategory)
        ? (categoryOrData as LogCategory)
        : LogCategory.GENERAL;
    const logData = category === categoryOrData ? data : categoryOrData;

    this.log(LogLevel.WARN, category, message, { data: logData });
  }

  /**
   * Error level log with category.
   */
  error(
    message: string,
    categoryOrData?: LogCategory | unknown,
    data?: unknown,
  ): void {
    const category =
      typeof categoryOrData === "string" &&
      Object.values(LogCategory).includes(categoryOrData as LogCategory)
        ? (categoryOrData as LogCategory)
        : LogCategory.GENERAL;
    const logData = category === categoryOrData ? data : categoryOrData;

    const entry = this.createEntry(LogLevel.ERROR, category, message, {
      data: logData,
    });
    this.addToMemory(entry);
    console.error(
      this.formatConsoleMessage(LogLevel.ERROR, category, message),
      logData ?? "",
    );
  }

  /**
   * Log an agent-specific event.
   */
  agentLog(
    level: LogLevel,
    category: LogCategory,
    agentId: string,
    message: string,
    data?: unknown,
  ): void {
    this.log(level, category, `[Agent:${agentId}] ${message}`, {
      agentId,
      data,
    });
  }

  /**
   * Get current aggregated metrics.
   */
  getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful after exporting).
   */
  resetMetrics(): void {
    this.metrics = this.initMetrics();
  }

  /**
   * Query logs from memory buffer with filters.
   */
  queryLogs(filter: LogFilter = {}): LogEntry[] {
    let results = [...this.memoryBuffer];

    if (filter.levels?.length) {
      results = results.filter((e) => filter.levels!.includes(e.level));
    }
    if (filter.categories?.length) {
      results = results.filter((e) => filter.categories!.includes(e.category));
    }
    if (filter.correlationId) {
      results = results.filter((e) => e.correlationId === filter.correlationId);
    }
    if (filter.agentId) {
      results = results.filter((e) => e.agentId === filter.agentId);
    }
    if (filter.startTime) {
      results = results.filter((e) => e.timestampMs >= filter.startTime!);
    }
    if (filter.endTime) {
      results = results.filter((e) => e.timestampMs <= filter.endTime!);
    }
    if (filter.messageContains) {
      const search = filter.messageContains.toLowerCase();
      results = results.filter((e) => e.message.toLowerCase().includes(search));
    }
    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  /**
   * Export logs to a file for analysis.
   */
  async exportLogs(
    outputPath: string,
    filter: LogFilter = {},
  ): Promise<number> {
    await this.flush();

    const logs = this.queryLogs(filter);
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(logs, null, 2),
      "utf-8",
    );
    return logs.length;
  }

  /**
   * List available log files.
   */
  listLogFiles(): string[] {
    try {
      return fs
        .readdirSync(this.config.logDir)
        .filter(
          (f) =>
            f.startsWith("logs") &&
            (f.endsWith(".json") || f.endsWith(".jsonl")),
        );
    } catch (error) {
      console.error(
        "Failed to list log files:",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Read logs from a specific file.
   */
  async readLogFile(filename: string): Promise<LogEntry[]> {
    const filePath = path.join(this.config.logDir, filename);
    const content = await fs.promises.readFile(filePath, "utf-8");

    if (filename.endsWith(".jsonl")) {
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as LogEntry);
    }
    return JSON.parse(content) as LogEntry[];
  }

  /**
   * Force immediate evacuation of logs to file.
   */
  async flush(): Promise<void> {
    await this.evacuationPromise;
    await this.doEvacuate();
  }

  /**
   * Get current memory buffer size.
   */
  getBufferSize(): number {
    return this.memoryBuffer.length;
  }

  /**
   * Retrieves recent logs from memory buffer.
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.memoryBuffer.slice(-count);
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    if (this.evacuationInterval) {
      clearInterval(this.evacuationInterval);
    }
    void this.evacuationPromise.then(() => this.doEvacuate());
  }
}

export const logger = new Logger();

export { LogLevel, LogCategory } from "../../shared/constants/LogEnums";
