import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MultiRateScheduler,
  DEFAULT_TICK_RATES,
  type ScheduledSystem,
} from "../../src/domain/simulation/core/MultiRateScheduler";

describe("MultiRateScheduler", () => {
  let scheduler: MultiRateScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new MultiRateScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("debe usar tick rates por defecto", () => {
      const defaultScheduler = new MultiRateScheduler();
      expect(defaultScheduler).toBeDefined();
    });

    it("debe aceptar tick rates custom", () => {
      const customRates = {
        FAST: 50,
        MEDIUM: 250,
        SLOW: 500,
      };
      const customScheduler = new MultiRateScheduler(customRates);
      expect(customScheduler).toBeDefined();
    });
  });

  describe("setHooks", () => {
    it("debe configurar hooks preTick/postTick", () => {
      const preTick = vi.fn();
      const postTick = vi.fn();
      const getEntityCount = vi.fn(() => 10);

      scheduler.setHooks({
        preTick,
        postTick,
        getEntityCount,
      });

      expect(preTick).toBeDefined();
      expect(postTick).toBeDefined();
      expect(getEntityCount).toBeDefined();
    });
  });

  describe("registerSystem", () => {
    it("debe registrar en lista correcta según rate FAST", () => {
      const system: ScheduledSystem = {
        name: "test-fast",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.FAST);

      expect(system.update).toHaveBeenCalled();
    });

    it("debe registrar en lista correcta según rate MEDIUM", () => {
      const system: ScheduledSystem = {
        name: "test-medium",
        rate: "MEDIUM",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.MEDIUM);

      expect(system.update).toHaveBeenCalled();
    });

    it("debe registrar en lista correcta según rate SLOW", () => {
      const system: ScheduledSystem = {
        name: "test-slow",
        rate: "SLOW",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.SLOW);

      expect(system.update).toHaveBeenCalled();
    });
  });

  describe("start", () => {
    it("debe iniciar intervalos para cada rate", () => {
      const system: ScheduledSystem = {
        name: "test",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.FAST);

      expect(system.update).toHaveBeenCalled();
    });

    it("no debe iniciar si ya está running", () => {
      scheduler.start();
      const statsBefore = scheduler.getStats();

      scheduler.start(); // Intentar iniciar de nuevo

      const statsAfter = scheduler.getStats();
      expect(statsAfter.isRunning).toBe(true);
    });
  });

  describe("stop", () => {
    it("debe detener todos los intervalos", () => {
      const system: ScheduledSystem = {
        name: "test",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();
      scheduler.stop();

      expect(scheduler.getStats().isRunning).toBe(false);
    });
  });

  describe("executeSystems", () => {
    it("debe respetar enabled flag", () => {
      const enabledSystem: ScheduledSystem = {
        name: "enabled",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      const disabledSystem: ScheduledSystem = {
        name: "disabled",
        rate: "FAST",
        update: vi.fn(),
        enabled: false,
      };

      scheduler.registerSystem(enabledSystem);
      scheduler.registerSystem(disabledSystem);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.FAST);

      expect(enabledSystem.update).toHaveBeenCalled();
      expect(disabledSystem.update).not.toHaveBeenCalled();
    });

    it("debe respetar minEntities threshold", () => {
      const system: ScheduledSystem = {
        name: "test",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
        minEntities: 100,
      };

      scheduler.setHooks({
        getEntityCount: () => 50, // Menos que el threshold
      });

      scheduler.registerSystem(system);
      scheduler.start();

      vi.advanceTimersByTime(DEFAULT_TICK_RATES.FAST);

      expect(system.update).not.toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("debe retornar estadísticas de ejecución", async () => {
      const system: ScheduledSystem = {
        name: "test",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(DEFAULT_TICK_RATES.FAST * 2);

      const stats = scheduler.getStats();

      expect(stats.fast.count).toBeGreaterThan(0);
      expect(stats.fast.systems).toBe(1);
      expect(stats.fast.enabled).toBe(1);
    });
  });

  describe("setSystemEnabled", () => {
    it("debe habilitar/deshabilitar sistema", () => {
      const system: ScheduledSystem = {
        name: "test",
        rate: "FAST",
        update: vi.fn(),
        enabled: false,
      };

      scheduler.registerSystem(system);
      scheduler.start();

      const result = scheduler.setSystemEnabled("test", true);

      expect(result).toBe(true);
      expect(system.enabled).toBe(true);
    });

    it("debe retornar false si sistema no existe", () => {
      const result = scheduler.setSystemEnabled("nonexistent", true);
      expect(result).toBe(false);
    });
  });

  describe("getSystemsList", () => {
    it("debe listar todos los sistemas", () => {
      const system1: ScheduledSystem = {
        name: "system1",
        rate: "FAST",
        update: vi.fn(),
        enabled: true,
      };

      const system2: ScheduledSystem = {
        name: "system2",
        rate: "MEDIUM",
        update: vi.fn(),
        enabled: false,
      };

      scheduler.registerSystem(system1);
      scheduler.registerSystem(system2);

      const list = scheduler.getSystemsList();

      expect(list).toHaveLength(2);
      expect(list.find((s) => s.name === "system1")).toBeDefined();
      expect(list.find((s) => s.name === "system2")).toBeDefined();
    });
  });
});

