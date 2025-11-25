import { describe, it, expect, beforeEach, vi } from "vitest";
import { NeedsSystem } from "../../src/domain/simulation/systems/NeedsSystem";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/domain/types/game-types";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events";

const entityId = "agent-1";

describe("NeedsSystem", () => {
  let gameState: GameState;
  let system: NeedsSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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

  it("handleZoneBenefits aumenta necesidades según el tipo de zona", () => {
    const needs = system.initializeEntityNeeds(entityId);
    needs.thirst = 10;

    (system as any).handleZoneBenefits(entityId, needs, 1);
    expect(needs.thirst).toBeGreaterThan(10);
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

    const respawnTime = Date.now() + 31000;
    (system as any).processRespawnQueue(respawnTime);
    const respawnedNeeds = system.getNeeds(entityId);
    expect(respawnedNeeds?.hunger).toBe(100);
    expect(gameState.entities?.[0].isDead).toBe(false);
  });
});
