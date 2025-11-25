import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GameState } from "../../src/domain/types/game-types";
import { LivingLegendsSystem } from "../../src/domain/simulation/systems/LivingLegendsSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";
import { createMockGameState } from "../setup";

describe("LivingLegendsSystem", () => {
  let gameState: GameState;
  let livingLegendsSystem: LivingLegendsSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Hero",
          lifeStage: "adult",
          ageYears: 30,
          traits: {
            cooperation: 0.5,
            diligence: 0.5,
            curiosity: 0.5,
          },
        },
      ],
    });

    emitSpy = vi.spyOn(simulationEvents, "emit");
    livingLegendsSystem = new LivingLegendsSystem(gameState);
  });

  afterEach(() => {
    emitSpy.mockRestore();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  const emitReputation = (value: number, delta: number): void => {
    simulationEvents.emit(GameEventNames.REPUTATION_UPDATED, {
      entityId: "agent-1",
      newReputation: value,
      delta,
      reason: "test",
    });
    simulationEvents.flushEvents();
  };

  it("crea y actualiza registros de leyendas al recibir reputación", () => {
    emitReputation(0.85, 0.2);

    const legend = livingLegendsSystem.getLegend("agent-1");
    expect(legend?.reputation).toBe(0.85);
    expect(legend?.reputationTrend).toBe("rising");
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.LEGEND_UPDATE,
      expect.objectContaining({
        legend: expect.objectContaining({ agentId: "agent-1" }),
      }),
    );
  });

  it("actualiza títulos y aura cuando se alcanza reputación mítica", () => {
    emitReputation(0.95, 0.3);
    livingLegendsSystem.update(6000); // supera titleUpdateInterval

    const legend = livingLegendsSystem.getLegend("agent-1");
    expect(legend?.legendTier).toBe("mythical");
    expect(legend?.currentTitle).toBe("Mythical Being");
    expect(livingLegendsSystem.getActiveLegends()).toContain("agent-1");
  });

  it("registra deeds exitosos e ignora acciones fallidas", () => {
    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: "agent-1",
      actionType: "build",
      success: true,
      impact: 5,
    });
    simulationEvents.flushEvents();

    let legend = livingLegendsSystem.getLegend("agent-1");
    expect(legend?.deeds).toHaveLength(1);

    simulationEvents.emit(GameEventNames.AGENT_ACTION_COMPLETE, {
      agentId: "agent-1",
      actionType: "build",
      success: false,
      impact: 5,
    });
    simulationEvents.flushEvents();

    legend = livingLegendsSystem.getLegend("agent-1");
    expect(legend?.deeds).toHaveLength(1);
  });

  it("mantiene historial de reputación limitado", () => {
    for (let i = 0; i < 60; i++) {
      emitReputation(0.2 + i * 0.01, 0.01);
    }

    const legends = livingLegendsSystem.getAllLegends();
    const legend = legends.get("agent-1");
    expect(legend?.lastUpdate).toBeDefined();
    expect(legend?.reputation).toBeCloseTo(0.2 + 59 * 0.01);
  });
});
