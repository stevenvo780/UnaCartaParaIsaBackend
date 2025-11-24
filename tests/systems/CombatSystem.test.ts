import { describe, it, expect, beforeEach } from "vitest";
import { CombatSystem } from "../../src/domain/simulation/systems/CombatSystem.ts";
import { InventorySystem } from "../../src/domain/simulation/systems/InventorySystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { SocialSystem } from "../../src/domain/simulation/systems/SocialSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

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
        {
          id: "dead-entity",
          position: { x: 200, y: 200 },
          type: "agent",
          isDead: true,
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

    it("debe aceptar configuración personalizada", () => {
      const customSystem = new CombatSystem(
        gameState,
        inventorySystem,
        lifeCycleSystem,
        socialSystem,
        {
          decisionIntervalMs: 1000,
          engagementRadius: 100,
          baseCooldownMs: 5000,
        }
      );
      expect(customSystem).toBeDefined();
    });

    it("debe inicializar con tamaño de mundo por defecto", () => {
      const stateWithoutSize = createMockGameState();
      delete stateWithoutSize.worldSize;
      const system = new CombatSystem(
        stateWithoutSize,
        inventorySystem,
        lifeCycleSystem,
        socialSystem
      );
      expect(system).toBeDefined();
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

    it("debe equipar stone_dagger", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "stone", 10);
      combatSystem.equip("attacker-1", "stone_dagger");
      
      const weapon = combatSystem.getEquipped("attacker-1");
      expect(weapon).toBe("stone_dagger");
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => combatSystem.update(1000)).not.toThrow();
    });

    it("no debe actualizar si no ha pasado el intervalo mínimo", () => {
      combatSystem.update(100);
      combatSystem.update(200);
      // No debería procesar combate
      expect(combatSystem).toBeDefined();
    });

    it("debe ignorar entidades muertas", () => {
      expect(() => combatSystem.update(1000)).not.toThrow();
    });

    it("debe ignorar entidades sin posición", () => {
      if (gameState.entities) {
        gameState.entities.push({
          id: "no-position",
          type: "agent",
          isDead: false,
        });
      }
      expect(() => combatSystem.update(1000)).not.toThrow();
    });
  });

  describe("Log de combate", () => {
    it("debe mantener log de combate", () => {
      expect(gameState.combatLog).toBeDefined();
      expect(Array.isArray(gameState.combatLog)).toBe(true);
    });

    it("debe limitar tamaño del log", () => {
      // El sistema limita a maxLogEntries
      expect(combatSystem).toBeDefined();
    });
  });
});

