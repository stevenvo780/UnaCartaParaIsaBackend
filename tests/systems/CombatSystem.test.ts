import { describe, it, expect, beforeEach } from "vitest";
import { CombatSystem } from "../../src/simulation/systems/CombatSystem.js";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.js";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.js";
import { SocialSystem } from "../../src/simulation/systems/SocialSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("CombatSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let lifeCycleSystem: LifeCycleSystem;
  let socialSystem: SocialSystem;
  let combatSystem: CombatSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "attacker-1",
          position: { x: 100, y: 100 },
          type: "agent",
          isDead: false,
        },
        {
          id: "target-1",
          position: { x: 150, y: 150 },
          type: "agent",
          isDead: false,
        },
      ],
      worldSize: { width: 2000, height: 2000 },
    });

    inventorySystem = new InventorySystem();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    socialSystem = new SocialSystem(gameState);
    combatSystem = new CombatSystem(
      gameState,
      inventorySystem,
      lifeCycleSystem,
      socialSystem
    );
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(combatSystem).toBeDefined();
    });
  });

  describe("Equipamiento de armas", () => {
    it("debe equipar arma", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      
      expect(() => combatSystem.equip("attacker-1", "wooden_club")).not.toThrow();
    });

    it("debe retornar arma equipada", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      combatSystem.equip("attacker-1", "wooden_club");
      
      const weapon = combatSystem.getEquipped("attacker-1");
      expect(weapon).toBe("wooden_club");
    });

    it("debe retornar unarmed si no hay arma equipada", () => {
      const weapon = combatSystem.getEquipped("agent-without-weapon");
      expect(weapon).toBe("unarmed");
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => combatSystem.update(1000)).not.toThrow();
    });
  });
});

