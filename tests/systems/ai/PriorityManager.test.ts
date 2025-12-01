import { describe, it, expect, beforeEach } from "vitest";
import { PriorityManager } from "../../../src/domain/simulation/systems/agents/ai/core/PriorityManager";
import { createMockGameState } from "../../setup";
import type { GameState } from "../../../src/domain/types/game-types";

describe("PriorityManager", () => {
  let priorityManager: PriorityManager;
  let gameState: GameState;

  beforeEach(() => {
    gameState = createMockGameState();
    priorityManager = new PriorityManager(gameState);
  });

  describe("constructor", () => {
    it("debe inicializar con weights por defecto", () => {
      const weights = priorityManager.getWeights();

      expect(weights.survival).toBe(1.0);
      expect(weights.work).toBe(0.6);
      expect(weights.social).toBe(0.45);
      expect(weights.crafting).toBe(0.65);
      expect(weights.combat).toBe(0.7);
      expect(weights.flee).toBe(1.1);
      expect(weights.explore).toBe(0.3);
      expect(weights.logistics).toBe(0.55);
      expect(weights.rest).toBe(0.8);
      expect(weights.inspect).toBe(0.25);
    });

    it("debe aceptar weights custom", () => {
      const customWeights = {
        survival: 2.0,
        work: 1.5,
      };

      const customManager = new PriorityManager(gameState, {
        weights: customWeights,
      });

      const weights = customManager.getWeights();
      expect(weights.survival).toBe(2.0);
      expect(weights.work).toBe(1.5);
      // Otros deben mantener valores por defecto
      expect(weights.social).toBe(0.45);
    });
  });

  describe("setWeights", () => {
    it("debe actualizar weights", () => {
      priorityManager.setWeights({
        survival: 2.0,
        work: 1.5,
      });

      const weights = priorityManager.getWeights();
      expect(weights.survival).toBe(2.0);
      expect(weights.work).toBe(1.5);
    });
  });

  describe("getWeights", () => {
    it("debe retornar copia de weights", () => {
      const weights1 = priorityManager.getWeights();
      const weights2 = priorityManager.getWeights();

      expect(weights1).not.toBe(weights2); // Diferentes objetos
      expect(weights1).toEqual(weights2); // Mismo contenido
    });
  });

  describe("adjust", () => {
    it("debe aplicar weight a basePriority", () => {
      const basePriority = 0.5;
      const adjusted = priorityManager.adjust("agent-1", "survival", basePriority);

      // survival weight = 1.0, así que debería ser 0.5 * 1.0 = 0.5
      expect(adjusted).toBeCloseTo(0.5, 2);
    });

    it("debe ajustar por recursos bajos", () => {
      gameState.resources = {
        materials: {
          wood: 5, // Bajo
          stone: 5,
          food: 5,
        },
      };

      const basePriority = 0.5;
      const adjusted = priorityManager.adjust("agent-1", "work", basePriority);

      // Con recursos bajos, la prioridad debería ajustarse
      expect(adjusted).toBeDefined();
    });

    it("debe ajustar por rol del agente", () => {
      // Mock roleSystem si está disponible
      const basePriority = 0.5;
      const adjusted = priorityManager.adjust("agent-1", "work", basePriority);

      expect(adjusted).toBeDefined();
      expect(typeof adjusted).toBe("number");
    });

    it("debe retornar prioridad base para dominio desconocido", () => {
      const adjusted = priorityManager.adjust("agent-1", "unknown" as any, 0.5);

      expect(adjusted).toBe(0.5);
    });
  });
});

