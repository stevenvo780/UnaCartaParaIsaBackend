import { Router } from "express";
import { performanceMonitor } from "../../domain/simulation/core/PerformanceMonitor";

const router = Router();

/**
 * Returns runtime performance metrics as JSON.
 *
 * Provides current performance snapshot including system stats,
 * frame times, and simulation metrics.
 *
 * @returns JSON object with performance metrics
 */
router.get("/metrics/runtime", (_req, res) => {
  res.json(performanceMonitor.getSnapshot());
});

/**
 * Returns performance metrics in Prometheus format.
 *
 * Exposes metrics in Prometheus text format for monitoring systems.
 * Sets appropriate Content-Type header for Prometheus scraping.
 *
 * @returns Plain text in Prometheus format (version 0.0.4)
 */
router.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(performanceMonitor.toPrometheus());
});

export default router;
