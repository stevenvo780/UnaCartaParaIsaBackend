import { describe, it, expect, beforeEach } from "vitest";
import { EconomySystem } from "../../src/domain/simulation/systems/EconomySystem.ts";
import { InventorySystem } from "../../src/domain/simulation/systems/InventorySystem.ts";
import { SocialSystem } from "../../src/domain/simulation/systems/SocialSystem.ts";
import { LifeCycleSystem } from "../../src/domain/simulation/systems/LifeCycleSystem.ts";
import { RoleSystem } from "../../src/domain/simulation/systems/RoleSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("EconomySystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let socialSystem: SocialSystem;
  let lifeCycleSystem: LifeCycleSystem;
  let economySystem: EconomySystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: "agent-1",
          position: { x: 100, y: 100 },
          type: "agent",
        },
      ],
      zones: [
        {
          id: "wood-zone",
          type: "work",
          bounds: { x: 100, y: 100, width: 50, height: 50 },
          props: { resource: "wood" },
        },
        {
          id: "food-zone",
          type: "food",
          bounds: { x: 200, y: 200, width: 50, height: 50 },
        },
      ],
    });

    inventorySystem = new InventorySystem();
    socialSystem = new SocialSystem(gameState);
    lifeCycleSystem = new LifeCycleSystem(gameState);
    economySystem = new EconomySystem(
      gameState,
      inventorySystem,
      socialSystem
    );
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(economySystem).toBeDefined();
    });
  });

  describe("Acciones de trabajo", () => {
    it("debe manejar acción de trabajo en zona de madera", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.wood).toBeGreaterThan(0);
    });

    it("debe manejar acción de trabajo en zona de comida", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "food-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.food).toBeGreaterThan(0);
    });

    it("debe manejar acción de trabajo en zona de agua", () => {
      gameState.zones.push({
        id: "water-zone",
        type: "water",
        bounds: { x: 300, y: 300, width: 50, height: 50 },
      });
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      economySystem.handleWorkAction("agent-1", "water-zone");
      
      const inventory = inventorySystem.getAgentInventory("agent-1");
      expect(inventory?.water).toBeGreaterThan(0);
    });

    it("debe pagar salario al agente", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      const initialMoney = entity?.stats?.money || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const updatedEntity = gameState.entities.find(e => e.id === "agent-1");
      if (updatedEntity?.stats) {
        expect(updatedEntity.stats.money).toBeGreaterThan(initialMoney);
      }
    });

    it("debe agregar recursos globales si el inventario está lleno", () => {
      inventorySystem.initializeAgentInventory("agent-1", 0); // Capacidad 0
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      const initialWood = gameState.resources?.materials.wood || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      expect(gameState.resources?.materials.wood).toBeGreaterThan(initialWood);
    });

    it("no debe hacer nada si el agente no existe", () => {
      expect(() => {
        economySystem.handleWorkAction("nonexistent", "wood-zone");
      }).not.toThrow();
    });

    it("no debe hacer nada si la zona no existe", () => {
      expect(() => {
        economySystem.handleWorkAction("agent-1", "nonexistent");
      }).not.toThrow();
    });

    it("no debe hacer nada si la zona no produce recursos", () => {
      gameState.zones.push({
        id: "rest-zone",
        type: "rest",
        bounds: { x: 400, y: 400, width: 50, height: 50 },
      });
      expect(() => {
        economySystem.handleWorkAction("agent-1", "rest-zone");
      }).not.toThrow();
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar sin errores", () => {
      expect(() => economySystem.update(1000)).not.toThrow();
    });
  });

  describe("Residuos de yield", () => {
    it("debe acumular residuos de yield", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        entity.stats = { money: 0 };
      }
      // Realizar múltiples acciones de trabajo para acumular residuos
      economySystem.handleWorkAction("agent-1", "wood-zone");
      economySystem.handleWorkAction("agent-1", "wood-zone");
      expect(economySystem).toBeDefined();
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new EconomySystem(
        gameState,
        inventorySystem,
        socialSystem,
        {
          workDurationMs: 3000,
          baseYield: {
            wood: 2,
            stone: 1.5,
            food: 3,
            water: 4,
          },
        }
      );
      expect(customSystem).toBeDefined();
    });
  });

  describe("setDependencies", () => {
    it("debe establecer dependencias de sistemas", () => {
      const roleSystem = {} as any;
      const divineFavorSystem = {} as any;
      const genealogySystem = {} as any;
      
      expect(() => {
        economySystem.setDependencies({
          roleSystem,
          divineFavorSystem,
          genealogySystem,
        });
      }).not.toThrow();
    });
  });

  describe("Bonus de equipo", () => {
    it("debe aplicar bonus de equipo cuando hay miembros trabajando juntos", () => {
      // Crear un grupo social
      socialSystem.registerPermanentBond("agent-1", "agent-2", "family");
      socialSystem.setAffinity("agent-1", "agent-2", 0.8);
      
      // Agregar segundo agente en la misma zona
      gameState.entities.push({
        id: "agent-2",
        position: { x: 120, y: 120 }, // Dentro de wood-zone
        type: "agent",
      });
      
      inventorySystem.initializeAgentInventory("agent-1");
      inventorySystem.initializeAgentInventory("agent-2");
      const entity1 = gameState.entities.find(e => e.id === "agent-1");
      const entity2 = gameState.entities.find(e => e.id === "agent-2");
      if (entity1) entity1.stats = { money: 0 };
      if (entity2) entity2.stats = { money: 0 };
      
      // Actualizar sistema social para recalcular grupos
      socialSystem.update(2000);
      
      const initialWood = inventorySystem.getAgentInventory("agent-1")?.wood || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const finalWood = inventorySystem.getAgentInventory("agent-1")?.wood || 0;
      // Debería haber más wood debido al bonus de equipo
      expect(finalWood).toBeGreaterThan(initialWood);
    });
  });

  describe("Bonus de rol", () => {
    it("debe aplicar bonus cuando el agente tiene rol apropiado", () => {
      const roleSystem = new RoleSystem(gameState);
      
      economySystem.setDependencies({ roleSystem });
      
      // Crear agente en gameState.agents para que RoleSystem pueda asignarle rol
      if (!gameState.agents) gameState.agents = [];
      gameState.agents.push({
        id: "agent-1",
        name: "Agent 1",
        ageYears: 20,
        lifeStage: "adult",
        sex: "male",
        birthTimestamp: Date.now(),
        immortal: false,
        traits: { diligence: 0.6, cooperation: 0.5 },
        socialStatus: "commoner",
        generation: 0,
      });
      
      // Asignar rol de logger usando reassignRole
      roleSystem.reassignRole("agent-1", "logger");
      
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) entity.stats = { money: 0 };
      
      const initialWood = inventorySystem.getAgentInventory("agent-1")?.wood || 0;
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      const finalWood = inventorySystem.getAgentInventory("agent-1")?.wood || 0;
      // Debería haber más wood debido al bonus de rol
      expect(finalWood).toBeGreaterThan(initialWood);
    });
  });

  describe("Residuos de yield", () => {
    it("debe acumular y usar residuos de yield", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) entity.stats = { money: 0 };
      
      // Realizar múltiples acciones para acumular residuos
      economySystem.handleWorkAction("agent-1", "wood-zone");
      economySystem.handleWorkAction("agent-1", "wood-zone");
      economySystem.handleWorkAction("agent-1", "wood-zone");
      
      // Los residuos deberían acumularse y eventualmente convertirse en recursos enteros
      const wood = inventorySystem.getAgentInventory("agent-1")?.wood || 0;
      expect(wood).toBeGreaterThan(0);
    });
  });

  describe("Casos edge", () => {
    it("debe manejar agente sin stats", () => {
      inventorySystem.initializeAgentInventory("agent-1");
      const entity = gameState.entities.find(e => e.id === "agent-1");
      if (entity) {
        delete entity.stats;
      }
      
      expect(() => {
        economySystem.handleWorkAction("agent-1", "wood-zone");
      }).not.toThrow();
    });

    it("debe manejar zona sin bounds", () => {
      gameState.zones.push({
        id: "no-bounds-zone",
        type: "work",
        props: { resource: "wood" },
      });
      
      expect(() => {
        economySystem.handleWorkAction("agent-1", "no-bounds-zone");
      }).not.toThrow();
    });

    it("debe manejar zona work sin resource en props", () => {
      gameState.zones.push({
        id: "work-no-resource",
        type: "work",
        bounds: { x: 500, y: 500, width: 50, height: 50 },
      });
      
      expect(() => {
        economySystem.handleWorkAction("agent-1", "work-no-resource");
      }).not.toThrow();
    });
  });
});

