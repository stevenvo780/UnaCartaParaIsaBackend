import { Worker } from "node:worker_threads";
import { logger } from "../../../../infrastructure/utils/logger";
import { StateCache } from "../StateCache";
import { DeltaEncoder } from "../DeltaEncoder";
import type { SimulationRunner } from "../SimulationRunner";
import { cloneGameState } from "../defaultState";
import type { SimulationSnapshot } from "../../../../shared/types/commands/SimulationCommand";

export class SnapshotManager {
  private stateCache: StateCache;
  private deltaEncoder: DeltaEncoder;
  private lastSnapshotTime = 0;
  private readonly SNAPSHOT_INTERVAL_MS = 250;
  private snapshotWorker?: Worker;
  private snapshotWorkerReady = false;

  constructor(private runner: SimulationRunner) {
    this.stateCache = new StateCache();
    this.deltaEncoder = new DeltaEncoder();
    this.initializeSnapshotWorker();
  }

  private initializeSnapshotWorker(): void {
    try {
      const workerCode = `
        const { parentPort } = require('worker_threads');
        if (!parentPort) throw new Error('SnapshotWorker inline requires parentPort');
        parentPort.postMessage({ type: 'ready' });
        parentPort.on('message', (msg) => {
          try {
            if (msg && msg.type === 'snapshot' && msg.data) {
              const serialized = JSON.stringify(msg.data);
              parentPort.postMessage({ type: 'snapshot-ready', data: serialized, size: serialized.length });
            } else if (msg && msg.type === 'shutdown') {
              process.exit(0);
            }
          } catch (err) {
            parentPort.postMessage({ type: 'error', error: (err && err.message) || String(err) });
          }
        });
      `;

      this.snapshotWorker = new Worker(workerCode, { eval: true });

      this.snapshotWorker.on("message", (rawMessage: unknown) => {
        const message = rawMessage as {
          type: string;
          data?: string;
          error?: string;
        };
        if (message.type === "ready") {
          this.snapshotWorkerReady = true;
          logger.info("🧵 Snapshot worker thread ready");
        } else if (message.type === "snapshot-ready" && message.data) {
          try {
            const parsed: unknown = JSON.parse(message.data as string);
            this.runner.emit("tick", parsed);
          } catch (err) {
            logger.error("Failed to parse snapshot from worker:", err);
          }
        } else if (message.type === "error") {
          logger.error("Snapshot worker error:", message.error);
        }
      });

      this.snapshotWorker.on("error", (error) => {
        logger.error("Snapshot worker thread error:", error);
        this.snapshotWorkerReady = false;
      });

      this.snapshotWorker.on("exit", (code) => {
        if (code !== 0) {
          logger.warn(`Snapshot worker stopped with exit code ${code}`);
        }
        this.snapshotWorkerReady = false;
      });
    } catch (error) {
      logger.error("Failed to initialize snapshot worker:", error);
      this.snapshotWorkerReady = false;
    }
  }

  public generateSnapshotThrottled(): void {
    const now = Date.now();
    if (now - this.lastSnapshotTime < this.SNAPSHOT_INTERVAL_MS) {
      return;
    }
    this.lastSnapshotTime = now;

    if (!this.snapshotWorkerReady || !this.snapshotWorker) {
      return;
    }

    const currentTick = this.runner.getTickCounter();
    const stateSnapshot = this.stateCache.getSnapshot(
      this.runner.state,
      currentTick,
    );

    logger.info(`[SNAPSHOT DEBUG] Before enrichment: agents=${stateSnapshot.agents?.length ?? 'undefined'}, tick=${currentTick}`);

    // Enrich agents with AI state data before sending to frontend
    if (stateSnapshot.agents) {
      stateSnapshot.agents = stateSnapshot.agents.map((agent) => {
        const aiState = this.runner.aiSystem.getAIState(agent.id);

        // Serialize AI state for frontend
        const ai = aiState
          ? {
            currentGoal: aiState.currentGoal || undefined,
            goalQueue: aiState.goalQueue || [],
            currentAction: aiState.currentAction || undefined,
            offDuty: aiState.offDuty || false,
            lastDecisionTime: aiState.lastDecisionTime || 0,
          }
          : undefined;

        return {
          ...agent,
          ai,
        };
      });
    }

    logger.info(`[SNAPSHOT DEBUG] After enrichment: agents=${stateSnapshot.agents?.length ?? 'undefined'}, tick=${currentTick}`);

    // We need to construct a SimulationSnapshot to pass to encodeDelta
    const events =
      this.runner.capturedEvents.length > 0
        ? [...this.runner.capturedEvents]
        : [];
    this.runner.capturedEvents.length = 0;

    const fullSnapshot: SimulationSnapshot = {
      tick: currentTick,
      updatedAt: now,
      state: stateSnapshot,
      events,
    };

    const delta = this.deltaEncoder.encodeDelta(fullSnapshot);

    if (!delta) return;

    const snapshotData = {
      tick: currentTick,
      time: now,
      delta,
      events,
    };

    this.snapshotWorker.postMessage({
      type: "snapshot",
      data: snapshotData,
    });
  }

  public getInitialSnapshot(): SimulationSnapshot {
    const events =
      this.runner.capturedEvents.length > 0
        ? [...this.runner.capturedEvents]
        : undefined;
    const snapshotState = cloneGameState(this.runner.state);
    snapshotState.genealogy =
      this.runner._genealogySystem?.getSerializedFamilyTree() ?? {};

    const allLegends = this.runner.livingLegendsSystem.getAllLegends();
    const activeLegends = this.runner.livingLegendsSystem.getActiveLegends();
    snapshotState.legends = {
      records: allLegends,
      activeLegends,
    };

    // Ensure social graph is populated even before first tick
    if (!snapshotState.socialGraph) {
      snapshotState.socialGraph = this.runner.socialSystem.getGraphSnapshot();
    }

    if (snapshotState.agents) {
      snapshotState.agents = snapshotState.agents.map((agent) => {
        const needs = this.runner.needsSystem.getNeeds(agent.id);
        const role = this.runner.roleSystem.getAgentRole(agent.id);
        const aiState = this.runner.aiSystem.getAIState(agent.id);

        // Serialize AI state for frontend
        const ai = aiState
          ? {
            currentGoal: aiState.currentGoal || undefined,
            goalQueue: aiState.goalQueue || [],
            currentAction: aiState.currentAction || undefined,
            offDuty: aiState.offDuty || false,
            lastDecisionTime: aiState.lastDecisionTime || 0,
          }
          : undefined;

        return {
          ...agent,
          needs: needs ? { ...needs } : undefined,
          role: role ? { ...role } : undefined,
          ai,
        };
      });
    }

    return {
      tick: this.runner.getTickCounter(),
      updatedAt: Date.now(),
      state: snapshotState,
      events,
    };
  }

  public markDirty(sections: string | string[]): void {
    if (Array.isArray(sections)) {
      this.stateCache.markDirtyMultiple(sections);
    } else {
      this.stateCache.markDirty(sections);
    }
  }

  public cleanup(): void {
    if (this.snapshotWorker) {
      this.snapshotWorker.postMessage({ type: "shutdown" });
      this.snapshotWorker.terminate();
      this.snapshotWorker = undefined;
      this.snapshotWorkerReady = false;
    }
  }
}
