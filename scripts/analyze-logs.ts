#!/usr/bin/env npx tsx

/**
 * Log Analysis Script
 *
 * Analyze simulation logs to study agent behavior patterns.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { LogLevel, LogCategory } from "../src/shared/constants/LogEnums.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LogEntry {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  timestamp: string;
  timestampMs: number;
  agentId?: string;
  correlationId?: string;
  tick?: number;
  data?: Record<string, unknown>;
}

interface LogStats {
  totalEntries: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  byAgent: Record<string, number>;
  timeRange: { start: string; end: string };
  topMessages: { message: string; count: number }[];
}

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

function getLatestLogFile(): string {
  const logsDir = path.resolve(__dirname, "../logs");

  if (!fs.existsSync(logsDir)) {
    throw new Error(`Logs directory not found: ${logsDir}`);
  }

  const files = fs.readdirSync(logsDir)
    .filter(f => f.endsWith(".jsonl"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("No log files found");
  }

  return path.join(logsDir, files[0]);
}

function readLogFile(filePath: string): LogEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());

  return lines.map(line => {
    try {
      return JSON.parse(line) as LogEntry;
    } catch (error) {
      console.error("Failed to parse log line:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }).filter(Boolean) as LogEntry[];
}

function filterLogs(
  entries: LogEntry[],
  filters: {
    category?: string;
    level?: string;
    agent?: string;
    search?: string;
  }
): LogEntry[] {
  return entries.filter(entry => {
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.level && entry.level !== filters.level) return false;
    if (filters.agent && entry.agentId !== filters.agent) return false;
    if (filters.search && !entry.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

function calculateStats(entries: LogEntry[]): LogStats {
  const byLevel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  const messageCount: Map<string, number> = new Map();

  entries.forEach(entry => {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    if (entry.agentId) {
      byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1;
    }
    const msgKey = entry.message.slice(0, 50);
    messageCount.set(msgKey, (messageCount.get(msgKey) || 0) + 1);
  });

  const topMessages = Array.from(messageCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }));

  return {
    totalEntries: entries.length,
    byLevel,
    byCategory,
    byAgent,
    timeRange: {
      start: entries[0]?.timestamp || "N/A",
      end: entries[entries.length - 1]?.timestamp || "N/A",
    },
    topMessages,
  };
}

function printStats(stats: LogStats): void {
  console.log("\n📊 LOG ANALYSIS REPORT\n");
  console.log("=".repeat(60));

  console.log("\n📈 TOTAL ENTRIES:", stats.totalEntries);

  console.log("\n⏱️ TIME RANGE:");
  console.log("  Start:", stats.timeRange.start);
  console.log("  End:  ", stats.timeRange.end);

  console.log("\n📋 BY LEVEL:");
  Object.entries(stats.byLevel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([level, count]) => {
      const pct = ((count / stats.totalEntries) * 100).toFixed(1);
      console.log("  " + level.padEnd(10) + count.toString().padStart(6) + " (" + pct + "%)");
    });

  console.log("\n🏷️ BY CATEGORY:");
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      const pct = ((count / stats.totalEntries) * 100).toFixed(1);
      console.log("  " + cat.padEnd(15) + count.toString().padStart(6) + " (" + pct + "%)");
    });

  const agentEntries = Object.entries(stats.byAgent).sort((a, b) => b[1] - a[1]);
  if (agentEntries.length > 0) {
    console.log("\n👤 TOP AGENTS:");
    agentEntries.slice(0, 10).forEach(([agent, count]) => {
      console.log("  " + agent.padEnd(20) + count.toString().padStart(6));
    });
  }

  console.log("\n💬 TOP MESSAGES:");
  stats.topMessages.forEach(({ message, count }) => {
    console.log("  " + count.toString().padStart(6) + "x  " + message + "...");
  });

  console.log("\n" + "=".repeat(60));
}

function printEntries(entries: LogEntry[], limit?: number): void {
  const toShow = limit ? entries.slice(-limit) : entries;

  toShow.forEach(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const cat = entry.category.padEnd(12);
    const agent = entry.agentId ? "[" + entry.agentId + "]" : "";

    console.log(time + " " + level + " " + cat + " " + agent + " " + entry.message);
  });
}

async function main(): Promise<void> {
  const args = parseArgs();

  try {
    const filePath = typeof args.file === "string" ? args.file : getLatestLogFile();
    console.log("📂 Analyzing:", filePath, "\n");

    const entries = readLogFile(filePath);
    console.log("📝 Loaded", entries.length, "entries\n");

    const filtered = filterLogs(entries, {
      category: args.category as string,
      level: args.level as string,
      agent: args.agent as string,
      search: args.search as string,
    });

    if (args.stats) {
      const stats = calculateStats(filtered);
      printStats(stats);
    } else if (args.last) {
      const limit = parseInt(args.last as string, 10);
      printEntries(filtered, limit);
    } else {
      printEntries(filtered.slice(-20));
    }

    if (typeof args.export === "string") {
      const exportPath = args.export;
      fs.writeFileSync(exportPath, filtered.map(e => JSON.stringify(e)).join("\n"));
      console.log("\n✅ Exported", filtered.length, "entries to", exportPath);
    }

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
