import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import saveRoutes from "./routes/saveRoutes.js";
import worldRoutes from "./routes/worldRoutes.js";
import simulationRoutes from "./routes/simulationRoutes.js";

const app = express();

// Security: CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
    credentials: true,
  }),
);

// Body parser with size limit
app.use(express.json({ limit: "50mb" }));

// Request logging middleware (optional, can be removed in production)
if (process.env.NODE_ENV !== "production") {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use("/", saveRoutes);
app.use("/", worldRoutes);
app.use("/", simulationRoutes);

// Error handling middleware
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    const errorMessage =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message;
    console.error("Unhandled error:", err);
    res.status(500).json({ error: errorMessage });
  },
);

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
