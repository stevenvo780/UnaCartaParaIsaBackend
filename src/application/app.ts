import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import saveRoutes from "./routes/saveRoutes.js";
import worldRoutes from "./routes/worldRoutes.js";
import simulationRoutes from "./routes/simulationRoutes.js";
import metricsRoutes from "./routes/metricsRoutes.js";
import { logger } from "../infrastructure/utils/logger.js";
import { HttpStatusCode } from "../shared/constants/HttpStatusCodes";

/**
 * Express application instance.
 *
 * Configures middleware, routes, and error handling for the simulation server.
 * Supports CORS for cross-origin requests and JSON payloads up to 50MB.
 *
 * Routes:
 * - `/api/saves` - Save/load game state operations
 * - `/api/world` - World generation endpoints
 * - `/api/sim` - Simulation control and state endpoints
 * - `/health` - Health check endpoint
 *
 * @module application
 */
const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

app.use("/", saveRoutes);
app.use("/", worldRoutes);
app.use("/", simulationRoutes);
app.use("/", metricsRoutes);

app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    const errorMessage =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message;
    logger.error("Unhandled error:", err.message);
    res
      .status(HttpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ error: errorMessage });
  },
);

app.use((_req: Request, res: Response): void => {
  res.status(HttpStatusCode.NOT_FOUND).json({ error: "Route not found" });
});

export default app;
