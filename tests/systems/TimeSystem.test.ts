import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimeSystem } from "../../src/simulation/systems/TimeSystem.js";
import { createMockGameState } from "../setup.js";
import type { GameState } from "../../src/types/game-types.js";

describe("TimeSystem", () => {
  let gameState: GameState;
  let timeSystem: TimeSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      weather: {
        current: "clear",
        temperature: 20,
        visibility: 1.0,
        lastChange: Date.now(),
        duration: 300000,
      },
    });
    timeSystem = new TimeSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(timeSystem).toBeDefined();
      expect(timeSystem.getCurrentTime()).toBeDefined();
      expect(timeSystem.getCurrentWeather()).toBeDefined();
    });

    it("debe tener tiempo inicial configurado", () => {
      const time = timeSystem.getCurrentTime();
      expect(time.hour).toBeGreaterThanOrEqual(0);
      expect(time.hour).toBeLessThan(24);
      expect(time.minute).toBeGreaterThanOrEqual(0);
      expect(time.minute).toBeLessThan(60);
      expect(time.phase).toBeDefined();
      expect(time.lightLevel).toBeGreaterThan(0);
      expect(time.temperature).toBeDefined();
    });

    it("debe tener clima inicial configurado", () => {
      const weather = timeSystem.getCurrentWeather();
      expect(weather.type).toBeDefined();
      expect(weather.intensity).toBeGreaterThan(0);
      expect(weather.visibility).toBeGreaterThan(0);
      expect(weather.comfort).toBeDefined();
    });
  });

  describe("Actualización de tiempo", () => {
    it("debe actualizar el tiempo correctamente", () => {
      const initialTime = timeSystem.getCurrentTime();
      timeSystem.update(2000);
      const updatedTime = timeSystem.getCurrentTime();
      expect(updatedTime.timestamp).toBeGreaterThanOrEqual(initialTime.timestamp);
    });

    it("debe cambiar la fase del día según la hora", () => {
      timeSystem.setTime(5, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("dawn");

      timeSystem.setTime(8, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("morning");

      timeSystem.setTime(12, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("midday");

      timeSystem.setTime(16, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("afternoon");

      timeSystem.setTime(19, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("dusk");

      timeSystem.setTime(22, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("night");

      timeSystem.setTime(2, 0);
      expect(timeSystem.getCurrentTime().phase).toBe("deep_night");
    });

    it("debe calcular el nivel de luz correctamente", () => {
      timeSystem.setTime(12, 0);
      const middayLight = timeSystem.getCurrentTime().lightLevel;
      expect(middayLight).toBeGreaterThan(0.5);

      timeSystem.setTime(0, 0);
      const midnightLight = timeSystem.getCurrentTime().lightLevel;
      expect(midnightLight).toBeLessThan(middayLight);
    });

    it("debe calcular la temperatura correctamente", () => {
      timeSystem.setTime(12, 0);
      const middayTemp = timeSystem.getCurrentTime().temperature;
      expect(middayTemp).toBeGreaterThan(0);

      timeSystem.setTime(0, 0);
      const midnightTemp = timeSystem.getCurrentTime().temperature;
      expect(midnightTemp).toBeDefined();
    });
  });

  describe("Gestión de clima", () => {
    it("debe permitir establecer el clima manualmente", () => {
      timeSystem.setWeather("rainy");
      expect(timeSystem.getCurrentWeather().type).toBe("rainy");
      expect(timeSystem.getCurrentWeather().intensity).toBeGreaterThan(0);
    });

    it("debe calcular la visibilidad según el clima", () => {
      timeSystem.setWeather("clear");
      const clearVisibility = timeSystem.getCurrentWeather().visibility;
      expect(clearVisibility).toBeGreaterThan(0.8);

      timeSystem.setWeather("foggy");
      const foggyVisibility = timeSystem.getCurrentWeather().visibility;
      expect(foggyVisibility).toBeLessThan(clearVisibility);
    });

    it("debe calcular el confort según el clima y temperatura", () => {
      timeSystem.setTime(15, 0);
      timeSystem.setWeather("clear");
      const clearComfort = timeSystem.getCurrentWeather().comfort;

      timeSystem.setWeather("stormy");
      const stormyComfort = timeSystem.getCurrentWeather().comfort;
      expect(stormyComfort).toBeLessThan(clearComfort);
    });

    it("debe actualizar el clima automáticamente", () => {
      const initialWeather = timeSystem.getCurrentWeather().type;
      vi.useFakeTimers();
      timeSystem.update(300000);
      vi.advanceTimersByTime(300000);
      vi.useRealTimers();
      const updatedWeather = timeSystem.getCurrentWeather();
      expect(updatedWeather).toBeDefined();
    });
  });

  describe("Métodos de utilidad", () => {
    it("debe retornar string de tiempo formateado", () => {
      timeSystem.setTime(9, 30);
      const timeString = timeSystem.getTimeString();
      expect(timeString).toMatch(/^\d{2}:\d{2}$/);
      expect(timeString).toBe("09:30");
    });

    it("debe retornar el tiempo del día correcto", () => {
      timeSystem.setTime(8, 0);
      expect(timeSystem.getCurrentTimeOfDay()).toBe("morning");

      timeSystem.setTime(14, 0);
      expect(timeSystem.getCurrentTimeOfDay()).toBe("afternoon");

      timeSystem.setTime(19, 0);
      expect(timeSystem.getCurrentTimeOfDay()).toBe("evening");

      timeSystem.setTime(23, 0);
      expect(timeSystem.getCurrentTimeOfDay()).toBe("night");
    });

    it("debe retornar estadísticas del sistema", () => {
      const stats = timeSystem.getStats();
      expect(stats.time).toBeDefined();
      expect(stats.phase).toBeDefined();
      expect(stats.temperature).toBeDefined();
      expect(stats.weather).toBeDefined();
      expect(stats.lightLevel).toBeDefined();
      expect(stats.visibility).toBeDefined();
      expect(stats.comfort).toBeDefined();
    });
  });

  describe("Configuración personalizada", () => {
    it("debe aceptar configuración personalizada", () => {
      const customSystem = new TimeSystem(gameState, {
        minutesPerGameHour: 5,
        startHour: 12,
        startMinute: 30,
      });
      const time = customSystem.getCurrentTime();
      expect(time.hour).toBe(12);
      expect(time.minute).toBe(30);
    });
  });
});

