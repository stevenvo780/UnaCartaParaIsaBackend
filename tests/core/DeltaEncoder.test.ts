import { describe, it, expect, beforeEach } from "vitest";
import { DeltaEncoder } from "../../src/domain/simulation/core/DeltaEncoder";
import { createMockGameState } from "../setup";
import type { GameState } from "../../src/shared/types/game-types";
import type { SimulationSnapshot } from "../../src/shared/types/commands/SimulationCommand";

describe("DeltaEncoder", () => {
  let deltaEncoder: DeltaEncoder;
  let gameState: GameState;

  beforeEach(() => {
    deltaEncoder = new DeltaEncoder();
    gameState = createMockGameState();
  });

  function createSnapshot(
    state: GameState,
    tick: number = 1,
  ): SimulationSnapshot {
    return {
      tick,
      updatedAt: Date.now(),
      events: [],
      state,
    };
  }

  describe("encodeDelta", () => {
    it("debe generar full snapshot cuando forceFull=true", () => {
      const snapshot = createSnapshot(gameState, 1);
      const delta = deltaEncoder.encodeDelta(snapshot, true);

      expect(delta.type).toBe("full");
      expect(delta.changes).toBeDefined();
      expect(delta.tick).toBe(1);
    });

    it("debe generar full snapshot cuando no hay lastSnapshot", () => {
      const snapshot = createSnapshot(gameState, 1);
      const delta = deltaEncoder.encodeDelta(snapshot);

      expect(delta.type).toBe("full");
      expect(delta.changes).toBeDefined();
    });

    it("debe generar full snapshot cuando se supera el intervalo", () => {
      // Primer snapshot siempre es full
      deltaEncoder.encodeDelta(createSnapshot(gameState, 1));

      // Emitir 100 snapshots delta
      for (let tick = 2; tick <= 101; tick++) {
        deltaEncoder.encodeDelta(createSnapshot(gameState, tick));
      }

      // El siguiente debe ser full al alcanzar el umbral
      const delta = deltaEncoder.encodeDelta(createSnapshot(gameState, 102));
      expect(delta.type).toBe("full");
    });

    it("debe generar delta snapshot con solo cambios", () => {
      // Primer snapshot (full)
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      // Segundo snapshot con cambios
      const modifiedState = {
        ...gameState,
        agents: [
          {
            id: "agent-1",
            name: "Agent 1",
            position: { x: 100, y: 200 },
            traits: {},
          },
        ],
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.type).toBe("delta");
      expect(delta.changes).toBeDefined();
      expect(delta.changedAgentIds).toContain("agent-1");
    });
  });

  describe("detectChanges", () => {
    it("debe detectar cambios en agents", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      const modifiedState = {
        ...gameState,
        agents: [
          {
            id: "agent-1",
            name: "Agent 1",
            position: { x: 100, y: 200 },
            traits: {},
          },
        ],
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.changes?.agents).toBeDefined();
      expect(delta.changes?.agents).toHaveLength(1);
    });

    it("debe detectar cambios en entities", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      const modifiedState = {
        ...gameState,
        entities: [
          {
            id: "entity-1",
            name: "Entity 1",
            x: 100,
            y: 200,
            position: { x: 100, y: 200 },
            isDead: false,
            type: "agent",
            traits: {},
          },
        ],
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.changes?.entities).toBeDefined();
      expect(delta.changedEntityIds).toContain("entity-1");
    });

    it("debe detectar cambios en zones", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      const modifiedState = {
        ...gameState,
        zones: [
          {
            id: "zone-1",
            name: "Zone 1",
            type: "residential",
            bounds: { x: 0, y: 0, width: 100, height: 100 },
          },
        ],
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.changes?.zones).toBeDefined();
    });

    it("debe detectar cambios en worldResources", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      const modifiedState = {
        ...gameState,
        worldResources: {
          "resource-1": {
            id: "resource-1",
            type: "wood",
            position: { x: 100, y: 200 },
            amount: 50,
          },
        },
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.changes?.worldResources).toBeDefined();
    });

    it("debe detectar cambios en animals", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      const modifiedState = {
        ...gameState,
        animals: {
          animals: [
            {
              id: "animal-1",
              type: "rabbit",
              position: { x: 100, y: 200 },
              state: "idle",
              needs: {
                hunger: 100,
                thirst: 100,
                fear: 0,
                reproductiveUrge: 0,
              },
              genes: {
                color: 0xffffff,
                size: 1.0,
                speed: 1.0,
                health: 1.0,
                fertility: 1.0,
              },
              health: 100,
              age: 0,
              lastReproduction: Date.now(),
              spawnedAt: Date.now(),
              generation: 0,
              parentIds: [null, null],
              targetPosition: null,
              currentTarget: null,
              fleeTarget: null,
              biome: "grassland",
              isDead: false,
            },
          ],
        },
      };
      const snapshot2 = createSnapshot(modifiedState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.changes?.animals).toBeDefined();
    });
  });

  describe("reset", () => {
    it("debe limpiar estado", () => {
      const snapshot1 = createSnapshot(gameState, 1);
      deltaEncoder.encodeDelta(snapshot1);

      deltaEncoder.reset();

      // Después de reset, el próximo debe ser full
      const snapshot2 = createSnapshot(gameState, 2);
      const delta = deltaEncoder.encodeDelta(snapshot2);

      expect(delta.type).toBe("full");
    });
  });

  describe("forceFullSnapshot", () => {
    it("debe forzar próximo snapshot completo", () => {
      // Enviar algunos snapshots
      for (let i = 1; i < 50; i++) {
        deltaEncoder.encodeDelta(createSnapshot(gameState, i));
      }

      deltaEncoder.forceFullSnapshot();

      // El próximo debe ser full
      const snapshot = createSnapshot(gameState, 50);
      const delta = deltaEncoder.encodeDelta(snapshot);

      expect(delta.type).toBe("full");
    });
  });
});

