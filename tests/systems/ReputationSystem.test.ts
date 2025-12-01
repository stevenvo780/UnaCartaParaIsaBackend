import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReputationSystem } from "../../src/domain/simulation/systems/social/ReputationSystem";
import { createMockGameState } from "../setup";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events";
import type { GameState } from "../../src/shared/types/game-types";

const agentA = "agent-a";
const agentB = "agent-b";

describe("ReputationSystem", () => {
  let gameState: GameState;
  let system: ReputationSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    gameState = createMockGameState();
    system = new ReputationSystem(gameState);
    emitSpy = vi.spyOn(simulationEvents, "emit");
  });

  afterEach(() => {
    vi.useRealTimers();
    emitSpy.mockRestore();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("updateTrust respeta límites y actualiza timestamp", () => {
    system.updateTrust(agentA, agentB, 1);
    expect(system.getTrust(agentA, agentB)).toBe(1);

    system.updateTrust(agentA, agentB, -2);
    expect(system.getTrust(agentA, agentB)).toBe(0);
  });

  it("updateReputation guarda historial y aplica clamps", () => {
    system.updateReputation(agentA, 0.6, "quest");
    system.updateReputation(agentA, -2, "exploit");

    expect(system.getReputation(agentA)).toBe(0);
    const history = system.getReputationHistory(agentA);
    expect(history).toHaveLength(2);
    expect(history[0].reason).toBe("quest");
  });

  it("update aplica decaimiento y actualiza stats en el gameState", () => {
    system.updateTrust(agentA, agentB, 0.2);
    system.updateReputation(agentA, 0.2);
    vi.setSystemTime(5000);

    system.update();

    const stats = system.getSystemStats();
    expect(stats.agents).toBe(1);
    expect(gameState.reputation?.data.trust).toBeDefined();
    expect(gameState.reputation?.stats.agents).toBe(1);
  });

  it("handleSocialRelationChanged ajusta confianza y reputación", () => {
    system.handleSocialRelationChanged({ aId: agentA, bId: agentB, type: "friendship", delta: 2 });
    expect(system.getTrust(agentA, agentB)).toBeGreaterThan(0.5);
    expect(system.getReputation(agentA)).toBeGreaterThan(0.5);
  });

  it("handleCombatHit reduce reputación del atacante", () => {
    system.updateTrust(agentB, agentA, 0);
    system.handleCombatHit({ attackerId: agentA, targetId: agentB, damage: 100 });
    expect(system.getReputation(agentA)).toBeLessThan(0.5);
    expect(system.getTrust(agentB, agentA)).toBeLessThan(0.5);
  });

  it("handleInteractionGame registra eventos y ajusta confiabilidad", () => {
    system.handleInteractionGame({ game: "pd", aId: agentA, bId: agentB, payoffs: { [agentA]: 1, [agentB]: 1 } });
    expect(system.getTrust(agentA, agentB)).toBeGreaterThan(0.5);

    system.handleInteractionGame({ game: "pd", aId: agentA, bId: agentB, payoffs: { [agentA]: 2, [agentB]: 0 } });
    expect(system.getTrust(agentB, agentA)).toBeLessThan(0.5);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.INTERACTION_GAME_PLAYED,
      expect.objectContaining({ agentA: agentA, agentB: agentB }),
    );
  });

  it("serialize y deserialize preservan datos", () => {
    system.updateTrust(agentA, agentB, 0.2);
    system.updateReputation(agentA, 0.3);

    const payload = system.serialize();
    const restored = new ReputationSystem(gameState);
    restored.deserialize(payload);

    expect(restored.getTrust(agentA, agentB)).toBeCloseTo(system.getTrust(agentA, agentB));
    expect(restored.getReputation(agentA)).toBeCloseTo(system.getReputation(agentA));
  });

  it("getReputationHistory respeta límite y orden", () => {
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(1000);
      system.updateReputation(agentA, 0.01, `tick_${i}`);
    }
    const history = system.getReputationHistory(agentA, 10);
    expect(history).toHaveLength(10);
    expect(history[0].timestamp).toBeGreaterThan(history[9].timestamp);
  });
});
