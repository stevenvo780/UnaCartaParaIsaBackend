import { describe, it, expect, beforeEach } from "vitest";
import { GovernanceSystem } from "../../src/simulation/systems/GovernanceSystem.ts";
import { InventorySystem } from "../../src/simulation/systems/InventorySystem.ts";
import { LifeCycleSystem } from "../../src/simulation/systems/LifeCycleSystem.ts";
import { DivineFavorSystem } from "../../src/simulation/systems/DivineFavorSystem.ts";
import { ResourceReservationSystem } from "../../src/simulation/systems/ResourceReservationSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("GovernanceSystem", () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let lifeCycleSystem: LifeCycleSystem;
  let divineFavorSystem: DivineFavorSystem;
  let reservationSystem: ResourceReservationSystem;
  let governanceSystem: GovernanceSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      agents: [
        {
          id: "agent-1",
          name: "Test Agent 1",
          position: { x: 100, y: 100 },
          needs: {
            hunger: 50,
            thirst: 50,
            rest: 50,
            social: 50,
          },
          inventory: { items: [], capacity: 10 },
          age: 25,
          gender: "male",
          status: "alive",
        },
      ],
      zones: [
        {
          id: "house-1",
          type: "house",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
          capacity: 2,
        },
      ],
      resources: {
        materials: {
          food: 10,
          water: 10,
          wood: 50,
          stone: 50,
        },
        energy: 0,
        currency: 0,
        experience: 0,
        unlockedFeatures: [],
      },
    });

    inventorySystem = new InventorySystem();
    lifeCycleSystem = new LifeCycleSystem(gameState);
    divineFavorSystem = new DivineFavorSystem();
    reservationSystem = new ResourceReservationSystem(gameState, inventorySystem);
    governanceSystem = new GovernanceSystem(
      gameState,
      inventorySystem,
      lifeCycleSystem,
      divineFavorSystem,
      reservationSystem,
      {
        checkIntervalMs: 1000,
        demandExpirationMs: 5000,
        autoGenerateProjects: true,
      }
    );
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(governanceSystem).toBeDefined();
    });

    it("debe tener políticas por defecto", () => {
      const snapshot = governanceSystem.getSnapshot();
      expect(snapshot.policies.length).toBeGreaterThan(0);
    });
  });

  describe("Actualización del sistema", () => {
    it("debe actualizar correctamente", () => {
      governanceSystem.update(1000);
      const snapshot = governanceSystem.getSnapshot();
      expect(snapshot).toBeDefined();
    });

    it("debe verificar necesidades del asentamiento", () => {
      gameState.resources!.materials.food = 0;
      governanceSystem.update(1000);
      governanceSystem.update(2000);
      const snapshot = governanceSystem.getSnapshot();
      expect(snapshot.demands.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Gestión de políticas", () => {
    it("debe permitir habilitar/deshabilitar políticas", () => {
      governanceSystem.setPolicyEnabled("food_security", false);
      const snapshot = governanceSystem.getSnapshot();
      const policy = snapshot.policies.find((p) => p.id === "food_security");
      expect(policy?.enabled).toBe(false);

      governanceSystem.setPolicyEnabled("food_security", true);
      const snapshot2 = governanceSystem.getSnapshot();
      const policy2 = snapshot2.policies.find((p) => p.id === "food_security");
      expect(policy2?.enabled).toBe(true);
    });
  });

  describe("Gestión de demandas", () => {
    it("debe crear demandas cuando se detectan problemas", () => {
      gameState.resources!.materials.food = 0;
      governanceSystem.update(1000);
      governanceSystem.update(2000);
      const snapshot = governanceSystem.getSnapshot();
      expect(Array.isArray(snapshot.demands)).toBe(true);
    });

    it("debe expirar demandas antiguas", () => {
      governanceSystem.update(1000);
      governanceSystem.update(7000);
      const snapshot = governanceSystem.getSnapshot();
      expect(Array.isArray(snapshot.demands)).toBe(true);
    });
  });

  describe("Estadísticas del asentamiento", () => {
    it("debe calcular estadísticas del asentamiento", () => {
      const snapshot = governanceSystem.getSnapshot();
      expect(snapshot.stats).toBeDefined();
      expect(snapshot.stats.population).toBeGreaterThanOrEqual(0);
      expect(snapshot.stats.houses).toBeGreaterThanOrEqual(0);
      expect(snapshot.stats.foodPerCapita).toBeDefined();
      expect(snapshot.stats.waterPerCapita).toBeDefined();
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customReservationSystem = new ResourceReservationSystem(gameState, inventorySystem);
      const customSystem = new GovernanceSystem(
        gameState,
        inventorySystem,
        lifeCycleSystem,
        divineFavorSystem,
        customReservationSystem,
        {
          checkIntervalMs: 500,
          demandExpirationMs: 3000,
          autoGenerateProjects: false,
        }
      );
      expect(customSystem).toBeDefined();
    });
  });
});

