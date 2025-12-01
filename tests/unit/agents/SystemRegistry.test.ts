/**
 * @fileoverview Tests para SystemRegistry
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SystemRegistry,
  type IMovementSystem,
  type ICombatSystem,
  type INeedsSystem,
  type HandlerResult,
} from "../../../src/domain/simulation/systems/agents/SystemRegistry";

describe("SystemRegistry", () => {
  let registry: SystemRegistry;

  beforeEach(() => {
    registry = new SystemRegistry();
  });

  describe("register", () => {
    it("should register movement system", () => {
      const movementSystem: IMovementSystem = {
        name: "movement",
        requestMove: vi.fn().mockReturnValue({
          status: "delegated",
          system: "movement",
        }),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn().mockReturnValue(false),
      };

      registry.register("movement", movementSystem);

      expect(registry.movement).toBe(movementSystem);
    });

    it("should register combat system", () => {
      const combatSystem: ICombatSystem = {
        name: "combat",
        requestAttack: vi.fn().mockReturnValue({
          status: "delegated",
          system: "combat",
        }),
        requestFlee: vi.fn(),
        isInCombat: vi.fn().mockReturnValue(false),
        endCombat: vi.fn(),
      };

      registry.register("combat", combatSystem);

      expect(registry.combat).toBe(combatSystem);
    });

    it("should register needs system", () => {
      const needsSystem: INeedsSystem = {
        name: "needs",
        requestConsume: vi.fn().mockReturnValue({
          status: "delegated",
          system: "needs",
        }),
        requestRest: vi.fn(),
        applyNeedChange: vi.fn(),
        getNeeds: vi.fn(),
      };

      registry.register("needs", needsSystem);

      expect(registry.needs).toBe(needsSystem);
    });
  });

  describe("unregister", () => {
    it("should unregister system", () => {
      const movementSystem: IMovementSystem = {
        name: "movement",
        requestMove: vi.fn(),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
      };

      registry.register("movement", movementSystem);
      registry.unregister("movement");

      expect(registry.movement).toBeUndefined();
    });
  });

  describe("getRegisteredSystems", () => {
    it("should return list of registered systems", () => {
      const movementSystem: IMovementSystem = {
        name: "movement",
        requestMove: vi.fn(),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
      };
      const combatSystem: ICombatSystem = {
        name: "combat",
        requestAttack: vi.fn(),
        requestFlee: vi.fn(),
        isInCombat: vi.fn(),
        endCombat: vi.fn(),
      };

      registry.register("movement", movementSystem);
      registry.register("combat", combatSystem);

      const systems = registry.getRegisteredSystems();

      expect(systems).toContain("movement");
      expect(systems).toContain("combat");
      expect(systems).toHaveLength(2);
    });
  });

  describe("integration", () => {
    it("should allow handlers to delegate to systems", () => {
      const mockResult: HandlerResult = {
        status: "delegated",
        system: "movement",
        message: "Movement started",
      };
      const movementSystem: IMovementSystem = {
        name: "movement",
        requestMove: vi.fn().mockReturnValue(mockResult),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
      };

      registry.register("movement", movementSystem);

      const result = registry.movement?.requestMove("agent-1", { x: 10, y: 20 });

      expect(movementSystem.requestMove).toHaveBeenCalledWith("agent-1", { x: 10, y: 20 });
      expect(result?.status).toBe("delegated");
      expect(result?.system).toBe("movement");
    });
  });
});
