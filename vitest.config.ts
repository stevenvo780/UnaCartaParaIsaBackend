import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    reporters: ["verbose", "html", "json"],
    outputFile: {
      html: "./coverage/test-report.html",
      json: "./coverage/test-results.json",
    },
    coverage: {
      enabled: false,
      provider: "v8",
      reporter: ["text", "text-summary", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
        "src/simulation/systems/**": {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.config.js",
        "**/types/**",
        "tests/**",
      ],
      all: true,
      clean: true,
    },
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    retry: process.env.CI ? 2 : 0,
    sequence: {
      shuffle: true,
    },
  },
});

