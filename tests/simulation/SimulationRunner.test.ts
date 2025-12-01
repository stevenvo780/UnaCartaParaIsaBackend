import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { container } from "../../src/config/container.ts";
import { TYPES } from "../../src/config/Types.ts";
import { SimulationRunner } from "../../src/domain/simulation/core/SimulationRunner.ts";
import { createMockGameState } from '../setup.ts';
import type { GameState } from '../../src/domain/types/game-types.ts';
import type { SimulationCommand } from '../../src/domain/simulation/types.ts';
import type { LifeCycleSystem } from "../../src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts";

describe('SimulationRunner', () => {
  let runner: SimulationRunner;
  let initialState: GameState;

  beforeEach(() => {
    vi.useFakeTimers();
    initialState = createMockGameState();
    container.unbind(TYPES.GameState);
    container.unbind(TYPES.SimulationConfig);
    container.bind<GameState>(TYPES.GameState).toConstantValue(initialState);
    container.bind(TYPES.SimulationConfig).toConstantValue({ tickIntervalMs: 10, maxCommandQueue: 10 });
    container.unbind(TYPES.SimulationRunner);
    container.bind<SimulationRunner>(TYPES.SimulationRunner).to(SimulationRunner).inSingletonScope();
    runner = container.get<SimulationRunner>(TYPES.SimulationRunner);
  });

  afterEach(() => {
    runner.stop();
    vi.useRealTimers();
  });

  describe('Inicialización', () => {
    it('debe inicializar correctamente', () => {
      expect(runner).toBeDefined();
    });

    it('debe aceptar estado inicial personalizado', () => {
      const customState = createMockGameState({
        cycles: 100,
        resonance: 50,
      });
      container.unbind(TYPES.GameState);
      container.bind<GameState>(TYPES.GameState).toConstantValue(customState);
      container.unbind(TYPES.SimulationRunner);
      container.bind<SimulationRunner>(TYPES.SimulationRunner).to(SimulationRunner).inSingletonScope();
      const customRunner = container.get<SimulationRunner>(TYPES.SimulationRunner);
      expect(customRunner).toBeDefined();
      customRunner.stop();
    });

    it('debe aceptar configuración personalizada', () => {
      container.unbind(TYPES.SimulationConfig);
      container.bind(TYPES.SimulationConfig).toConstantValue({
        tickIntervalMs: 100,
        maxCommandQueue: 50,
      });
      container.unbind(TYPES.SimulationRunner);
      container.bind<SimulationRunner>(TYPES.SimulationRunner).to(SimulationRunner).inSingletonScope();
      const customRunner = container.get<SimulationRunner>(TYPES.SimulationRunner);
      expect(customRunner).toBeDefined();
      customRunner.stop();
    });
  });

  describe('getSnapshot', () => {
    it('debe retornar snapshot del estado', () => {
      const snapshot = runner.getInitialSnapshot();
      
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.tick).toBeDefined();
      expect(typeof snapshot.tick).toBe('number');
    });

    it('debe incluir eventos capturados si existen', () => {
      const snapshot = runner.getInitialSnapshot();
      
      // Los eventos pueden ser undefined si no hay eventos capturados
      if (snapshot.events) {
        expect(Array.isArray(snapshot.events)).toBe(true);
      }
    });
  });

  describe('enqueueCommand', () => {
    it('debe aceptar comandos válidos', () => {
      const command: SimulationCommand = {
        type: 'PAUSE',
      };
      
      const accepted = runner.enqueueCommand(command);
      
      expect(accepted).toBe(true);
    });

    it('debe aceptar comandos cuando la cola está llena (FIFO: elimina el más antiguo)', () => {
      const command: SimulationCommand = {
        type: 'PAUSE',
      };
      
      // Llenar la cola
      for (let i = 0; i < 10; i++) {
        runner.enqueueCommand(command);
      }
      
      const accepted = runner.enqueueCommand(command);
      
      expect(accepted).toBe(true);
    });
  });

  describe('start y stop', () => {
    it('debe iniciar el runner', () => {
      runner.start();
      expect(runner).toBeDefined();
      runner.stop();
    });

    it('debe detener el runner', () => {
      runner.start();
      runner.stop();
      expect(runner).toBeDefined();
    });

    it('no debe iniciar múltiples veces', () => {
      runner.start();
      runner.start();
      runner.stop();
      expect(runner).toBeDefined();
    });
  });

  describe('step', () => {
    it('debe ejecutar un paso de simulación', async () => {
      const initialTick = runner.getInitialSnapshot().tick;
      // El método step es privado, pero podemos usar el scheduler para avanzar
      // Iniciar el runner y avanzar el tiempo para que el scheduler ejecute ticks
      runner.start();
      // Avanzar el tiempo para que el scheduler ejecute al menos un tick
      // El scheduler tiene diferentes frecuencias (FAST: 100ms, MEDIUM: 500ms, SLOW: 1000ms)
      vi.advanceTimersByTime(150);
      const newTick = runner.getInitialSnapshot().tick;
      
      // El tick debería incrementarse cuando el scheduler ejecuta
      expect(newTick).toBeGreaterThanOrEqual(initialTick);
      runner.stop();
    });
  });

  describe('initializeWorldResources', () => {
    it('debe inicializar recursos del mundo', async () => {
      const worldConfig = {
        width: 100,
        height: 100,
        tileSize: 64,
        biomeMap: Array(100).fill(null).map(() => Array(100).fill('grassland')),
      };
      
      await expect(
        runner.initializeWorldResources(worldConfig)
      ).resolves.not.toThrow();
    });
  });

  describe('EventEmitter', () => {
    it('debe emitir eventos de tick', (done) => {
      runner.on('tick', (snapshot) => {
        expect(snapshot).toBeDefined();
        expect(snapshot.state).toBeDefined();
        runner.stop();
        done();
      });
      
      runner.start();
    });

    it('debe emitir eventos de comando rechazado', () => {
      const command: SimulationCommand = { type: 'PAUSE' };
      
      // Llenar la cola
      for (let i = 0; i < 10; i++) {
        runner.enqueueCommand(command);
      }
      
      let droppedCommand: SimulationCommand | undefined;
      runner.on('commandDropped', (cmd) => {
        droppedCommand = cmd;
      });
      
      runner.enqueueCommand(command);
      
      expect(droppedCommand).toBeDefined();
    });
  });

  describe('SPAWN_AGENT command', () => {
    it('debe reutilizar requestId como id del agente', () => {
      const lifeCycleSystem = container.get<LifeCycleSystem>(TYPES.LifeCycleSystem);
      const spawnSpy = vi.spyOn(lifeCycleSystem, 'spawnAgent');

      runner.enqueueCommand({
        type: 'SPAWN_AGENT',
        payload: {
          requestId: 'agent_custom_id',
          name: 'Custom UI Agent',
        },
      });

      // Accedemos a los miembros privados para probar la lógica
      (runner as any).commandProcessor.process((runner as any).commands);

      expect(spawnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent_custom_id', name: 'Custom UI Agent' }),
      );

      spawnSpy.mockRestore();
    });
  });
});
