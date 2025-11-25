import { Router } from "express";
import { performanceMonitor } from "../../domain/simulation/core/PerformanceMonitor";

const router = Router();

router.get("/metrics/runtime", (_req, res) => {
  res.json(performanceMonitor.getSnapshot());
});

router.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(performanceMonitor.toPrometheus());
});

export default router;
