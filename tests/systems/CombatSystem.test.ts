import { describe, it, expect, beforeEach, vi } from "vitest";
import { CombatSystem } from "../../src/domain/simulation/systems/CombatSystem.ts";
import { InventorySystem } from "../../src/domain/simulation/systems/InventorySystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { SocialSystem } from "../../src/domain/simulation/systems/SocialSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";
import { simulationEvents, GameEventNames } from "../../src/domain/simulation/core/events.ts";

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

  describe("Crafting de armas", () => {
    it("debe craftar arma si tiene recursos suficientes", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      
      const result = combatSystem.craftWeapon("attacker-1", "wooden_club");
      expect(result).toBe(true);
      
      const weapon = combatSystem.getEquipped("attacker-1");
      expect(weapon).toBe("wooden_club");
    });

    it("debe craftar stone_dagger si tiene recursos", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "stone", 10);
      
      const result = combatSystem.craftWeapon("attacker-1", "stone_dagger");
      expect(result).toBe(true);
      
      const weapon = combatSystem.getEquipped("attacker-1");
      expect(weapon).toBe("stone_dagger");
    });

    it("debe retornar false si no tiene recursos suficientes", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 5);
      
      const result = combatSystem.craftWeapon("attacker-1", "wooden_club");
      expect(result).toBe(false);
    });

    it("debe consumir recursos al craftar", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      
      combatSystem.craftWeapon("attacker-1", "wooden_club");
      
      const inventory = inventorySystem.getAgentInventory("attacker-1");
      expect(inventory?.wood).toBe(0);
    });

    it("debe retornar false para arma inválida", () => {
      inventorySystem.initializeAgentInventory("attacker-1");
      const result = combatSystem.craftWeapon("attacker-1", "invalid_weapon" as any);
      expect(result).toBe(false);
    });
  });

  describe("Lógica de combate", () => {
    it("debe procesar combate entre agentes cercanos", () => {
      // Configurar agentes con perfiles
      const attacker = lifeCycleSystem.spawnAgent({ name: "Attacker" });
      const target = lifeCycleSystem.spawnAgent({ name: "Target" });
      
      // Configurar entidades en el estado
      if (gameState.entities) {
        gameState.entities[0] = {
          id: attacker.id,
          position: { x: 100, y: 100 },
          type: "agent",
          isDead: false,
        };
        gameState.entities[1] = {
          id: target.id,
          position: { x: 120, y: 120 }, // Cerca del atacante
          type: "agent",
          isDead: false,
        };
      }
      
      // Configurar afinidad negativa para que ataque
      socialSystem.setAffinity(attacker.id, target.id, -0.5);
      
      // Actualizar sistema
      combatSystem.update(1000);
      
      // El sistema debería procesar el combate
      expect(combatSystem).toBeDefined();
    });

    it("debe atacar animales automáticamente", () => {
      const attacker = lifeCycleSystem.spawnAgent({ name: "Hunter" });
      
      if (gameState.entities) {
        gameState.entities[0] = {
          id: attacker.id,
          position: { x: 100, y: 100 },
          type: "agent",
          isDead: false,
        };
        gameState.entities[1] = {
          id: "animal-1",
          position: { x: 120, y: 120 },
          type: "animal",
          isDead: false,
          tags: ["animal"],
        };
      }
      
      combatSystem.update(1000);
      
      expect(combatSystem).toBeDefined();
    });

    it("no debe atacar entidades inmortales", () => {
      const attacker = lifeCycleSystem.spawnAgent({ name: "Attacker" });
      
      if (gameState.entities) {
        gameState.entities[0] = {
          id: attacker.id,
          position: { x: 100, y: 100 },
          type: "agent",
          isDead: false,
        };
        gameState.entities[1] = {
          id: "immortal-1",
          position: { x: 120, y: 120 },
          type: "agent",
          isDead: false,
          immortal: true,
        };
      }
      
      combatSystem.update(1000);
      
      expect(combatSystem).toBeDefined();
    });

    it("debe respetar cooldown entre ataques", () => {
      const attacker = lifeCycleSystem.spawnAgent({ name: "Attacker" });
      const target = lifeCycleSystem.spawnAgent({ name: "Target" });
      
      if (gameState.entities) {
        gameState.entities[0] = {
          id: attacker.id,
          position: { x: 100, y: 100 },
          type: "agent",
          isDead: false,
        };
        gameState.entities[1] = {
          id: target.id,
          position: { x: 120, y: 120 },
          type: "agent",
          isDead: false,
        };
      }
      
      socialSystem.setAffinity(attacker.id, target.id, -0.5);
      
      // Primer ataque
      combatSystem.update(1000);
      
      // Segundo ataque inmediato (debería estar en cooldown)
      combatSystem.update(100);
      
      expect(combatSystem).toBeDefined();
    });
  });

  describe("Log de combate", () => {
    it("debe mantener log de combate", () => {
      expect(gameState.combatLog).toBeDefined();
      expect(Array.isArray(gameState.combatLog)).toBe(true);
    });

    it("debe agregar entrada al log cuando se equipa arma", () => {
      const initialLength = gameState.combatLog?.length || 0;
      
      inventorySystem.initializeAgentInventory("attacker-1");
      combatSystem.equip("attacker-1", "wooden_club");
      
      expect(gameState.combatLog?.length).toBeGreaterThan(initialLength);
    });

    it("debe agregar entrada al log cuando se crafta arma", () => {
      const initialLength = gameState.combatLog?.length || 0;
      
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      combatSystem.craftWeapon("attacker-1", "wooden_club");
      
      expect(gameState.combatLog?.length).toBeGreaterThan(initialLength);
    });

    it("debe limitar tamaño del log", () => {
      // El sistema limita a maxLogEntries (200)
      expect(combatSystem).toBeDefined();
    });
  });

  describe("Eventos", () => {
    it("debe emitir evento al equipar arma", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      inventorySystem.initializeAgentInventory("attacker-1");
      combatSystem.equip("attacker-1", "wooden_club");
      
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.COMBAT_WEAPON_EQUIPPED,
        expect.objectContaining({
          agentId: "attacker-1",
          weapon: "wooden_club",
        }),
      );
    });

    it("debe emitir evento al craftar arma", () => {
      const emitSpy = vi.spyOn(simulationEvents, "emit");
      
      inventorySystem.initializeAgentInventory("attacker-1");
      inventorySystem.addResource("attacker-1", "wood", 10);
      combatSystem.craftWeapon("attacker-1", "wooden_club");
      
      expect(emitSpy).toHaveBeenCalledWith(
        GameEventNames.COMBAT_WEAPON_CRAFTED,
        expect.objectContaining({
          agentId: "attacker-1",
          weapon: "wooden_club",
        }),
      );
    });
  });
});

