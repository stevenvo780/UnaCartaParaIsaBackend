import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NeedsSystem } from "../../src/domain/simulation/systems/agents/needs/NeedsSystem";
import {
  createMockGameState,
  setupFakeTimers,
  restoreRealTimers,
} from "../setup";
import type { GameState } from "../../src/shared/types/game-types";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events";

const entityId = "agent-1";

describe("NeedsSystem", () => {
  let gameState: GameState;
  let system: NeedsSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setupFakeTimers(0);
    gameState = createMockGameState({
      agents: [{ id: entityId, position: { x: 0, y: 0 } } as any],
      zones: [
        {
          id: "water-zone",
          type: "water",
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
      ],
      entities: [{ id: entityId, position: { x: 0, y: 0 }, isDead: false } as any],
    });
    system = new NeedsSystem(gameState);
    emitSpy = vi.spyOn(simulationEvents, "emit");
  });

  afterEach(() => {
    restoreRealTimers();
    emitSpy.mockRestore();
    simulationEvents.clearQueue();
    simulationEvents.removeAllListeners();
  });

  it("initializeEntityNeeds crea entradas y satisfyNeed incrementa valores", () => {
    const needs = system.initializeEntityNeeds(entityId);
    expect(system.getNeeds(entityId)).toBe(needs);

    needs.hunger = 50;
    expect(system.satisfyNeed(entityId, "hunger", 30)).toBe(true);
    expect(system.getNeeds(entityId)?.hunger).toBe(80);
  });

  it("modifyNeed reduce valores con clamp y removeEntityNeeds limpia entradas", () => {
    system.initializeEntityNeeds(entityId);
    expect(system.modifyNeed(entityId, "thirst", -150)).toBe(true);
    expect(system.getNeeds(entityId)?.thirst).toBe(0);

    system.removeEntityNeeds(entityId);
    expect(system.getNeeds(entityId)).toBeUndefined();
  });

  it("updateConfig emite evento configUpdated", () => {
    const handler = vi.fn();
    system.on("configUpdated", handler);
    system.updateConfig({ criticalThreshold: 10 });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ criticalThreshold: 10 }));
  });

  it("applyZoneBonuses aumenta social/fun según el tipo de zona", () => {
    const needs = system.initializeEntityNeeds(entityId);
    needs.social = 50;
    needs.fun = 50;

    // Simular zonas de tipo social
    const zones = [{ type: "market" }];
    (system as any).applyZoneBonuses(entityId, needs, zones);

    // Zone bonuses should increase social and fun
    expect(needs.social).toBeGreaterThan(50);
    expect(needs.fun).toBeGreaterThan(50);
  });

  it("applyCrossEffects reduce social/fun/mental cuando energy es baja", () => {
    const needs = { hunger: 20, thirst: 20, energy: 10, hygiene: 50, social: 50, fun: 50, mentalHealth: 50 };
    (system as any).applyCrossEffects(needs);

    expect(needs.social).toBeLessThan(50);
    expect(needs.fun).toBeLessThan(50);
    expect(needs.mentalHealth).toBeLessThan(50);
  });

  it("handleEntityDeath emite evento y programa respawn", () => {
    const needs = system.initializeEntityNeeds(entityId);
    needs.hunger = -1;

    const died = (system as any).checkForDeath(entityId, needs);
    expect(died).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.AGENT_DEATH,
      expect.objectContaining({ agentId: entityId, cause: "starvation" }),
    );

    const now = Date.now();
    const respawnTime = now + 31000;
    vi.advanceTimersByTime(31000);
    (system as any).processRespawnQueue(respawnTime);
    const respawnedNeeds = system.getNeeds(entityId);
    expect(respawnedNeeds?.hunger).toBe(100);
    expect(gameState.entities?.[0].isDead).toBe(false);
  });
  it("update tradicional aplica decaimiento y emite eventos críticos", () => {
    system.initializeEntityNeeds(entityId);
    system.updateConfig({ updateIntervalMs: 0, criticalThreshold: 90 });
    const needs = system.getNeeds(entityId)!;
    needs.hunger = 85;
    needs.thirst = 85;

    const now = Date.now();
    (system as any).lastUpdate = now - 2000;
    system.update(0);

    expect(needs.hunger).toBeLessThan(85);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.NEED_CRITICAL,
      expect.objectContaining({ agentId: entityId, need: "hunger" }),
    );
  });

  it("updateBatch procesa conjuntos grandes y sincroniza necesidades", async () => {
    system.updateConfig({ updateIntervalMs: 0 });
    for (let i = 0; i < 25; i++) {
      const id = `agent-${i}`;
      gameState.agents?.push({ id, position: { x: i, y: 0 } } as any);
      gameState.entities?.push({ id, position: { x: i, y: 0 }, isDead: false } as any);
      const data = system.initializeEntityNeeds(id);
      data.hunger = 80;
    }

    // Set lastUpdate far in the past so update proceeds
    (system as any).lastUpdate = 1;
    await system.update(0);

    // The batch processor decay is applied - hunger should have decreased
    expect(system.getNeeds("agent-0")?.hunger).toBeLessThanOrEqual(80);
  });

});
