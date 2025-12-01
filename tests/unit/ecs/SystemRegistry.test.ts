/**
 * @fileoverview Tests para SystemRegistry ECS
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SystemRegistry,
  type IMovementSystem,
  type ICombatSystem,
  type INeedsSystem,
  type HandlerResult,
} from "../../../src/domain/simulation/ecs";

describe("SystemRegistry", () => {
  let registry: SystemRegistry;

  beforeEach(() => {
    registry = new SystemRegistry();
  });

  describe("register", () => {
    it("should register movement system", () => {
      const movementSystem: IMovementSystem = {
        requestMove: vi.fn().mockReturnValue({
          status: "delegated",
          system: "movement",
        }),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn().mockReturnValue(false),
        getPath: vi.fn(),
      };

      registry.register("movement", movementSystem);

      expect(registry.movement).toBe(movementSystem);
    });

    it("should register combat system", () => {
      const combatSystem: ICombatSystem = {
        requestAttack: vi.fn().mockReturnValue({
          status: "delegated",
          system: "combat",
        }),
        requestFlee: vi.fn(),
        isInCombat: vi.fn().mockReturnValue(false),
        getTarget: vi.fn(),
        stopCombat: vi.fn(),
      };

      registry.register("combat", combatSystem);

      expect(registry.combat).toBe(combatSystem);
    });

    it("should register needs system", () => {
      const needsSystem: INeedsSystem = {
        requestConsume: vi.fn().mockReturnValue({
          status: "delegated",
          system: "needs",
        }),
        requestRest: vi.fn(),
        getNeeds: vi.fn(),
        getNeed: vi.fn(),
        satisfyNeed: vi.fn(),
      };

      registry.register("needs", needsSystem);

      expect(registry.needs).toBe(needsSystem);
    });
  });

  describe("unregister", () => {
    it("should unregister system", () => {
      const movementSystem: IMovementSystem = {
        requestMove: vi.fn(),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
        getPath: vi.fn(),
      };

      registry.register("movement", movementSystem);
      registry.unregister("movement");

      expect(registry.movement).toBeUndefined();
    });
  });

  describe("getRegisteredSystems", () => {
    it("should return list of registered systems", () => {
      registry.register("movement", {
        requestMove: vi.fn(),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
        getPath: vi.fn(),
      });
      registry.register("combat", {
        requestAttack: vi.fn(),
        requestFlee: vi.fn(),
        isInCombat: vi.fn(),
        getTarget: vi.fn(),
        stopCombat: vi.fn(),
      });

      const systems = registry.getRegisteredSystems();

      expect(systems).toContain("movement");
      expect(systems).toContain("combat");
      expect(systems).toHaveLength(2);
    });
  });

  describe("integration", () => {
    it("should allow handlers to delegate to systems", () => {
      // Create mock movement system
      const mockResult: HandlerResult = {
        status: "delegated",
        system: "movement",
        message: "Movement started",
      };
      const movementSystem: IMovementSystem = {
        requestMove: vi.fn().mockReturnValue(mockResult),
        requestMoveToZone: vi.fn(),
        requestMoveToEntity: vi.fn(),
        stopMovement: vi.fn(),
        isMoving: vi.fn(),
        getPath: vi.fn(),
      };

      registry.register("movement", movementSystem);

      // Simulate handler delegation
      const result = registry.movement?.requestMove("agent-1", 10, 20);

      expect(movementSystem.requestMove).toHaveBeenCalledWith("agent-1", 10, 20);
      expect(result?.status).toBe("delegated");
      expect(result?.system).toBe("movement");
    });
  });
});
