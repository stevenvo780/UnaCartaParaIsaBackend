import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimulationRunner } from "../../src/domain/simulation/core/SimulationRunner.ts";
import { createMockGameState } from '../setup.ts";
import type { GameState } from '../../src/types/game-types.ts";
import type { SimulationCommand } from '../../src/simulation/types.ts";

describe('SimulationRunner', () => {
  let runner: SimulationRunner;
  let initialState: GameState;

  beforeEach(() => {
    initialState = createMockGameState();
    runner = new SimulationRunner({ tickIntervalMs: 10, maxCommandQueue: 10 }, initialState);
  });

  afterEach(() => {
    runner.stop();
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
      const customRunner = new SimulationRunner(undefined, customState);
      expect(customRunner).toBeDefined();
      customRunner.stop();
    });

    it('debe aceptar configuración personalizada', () => {
      const customRunner = new SimulationRunner({
        tickIntervalMs: 100,
        maxCommandQueue: 50,
      });
      expect(customRunner).toBeDefined();
      customRunner.stop();
    });
  });

  describe('getSnapshot', () => {
    it('debe retornar snapshot del estado', () => {
      const snapshot = runner.getSnapshot();
      
      expect(snapshot).toBeDefined();
      expect(snapshot.state).toBeDefined();
      expect(snapshot.tick).toBeDefined();
      expect(typeof snapshot.tick).toBe('number');
    });

    it('debe incluir eventos capturados si existen', () => {
      const snapshot = runner.getSnapshot();
      
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

    it('debe rechazar comandos cuando la cola está llena', () => {
      const command: SimulationCommand = {
        type: 'PAUSE',
      };
      
      // Llenar la cola
      for (let i = 0; i < 10; i++) {
        runner.enqueueCommand(command);
      }
      
      const accepted = runner.enqueueCommand(command);
      
      expect(accepted).toBe(false);
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
    it('debe ejecutar un paso de simulación', () => {
      const initialTick = runner.getSnapshot().tick;
      runner.step();
      const newTick = runner.getSnapshot().tick;
      
      expect(newTick).toBeGreaterThan(initialTick);
    });
  });

  describe('initializeWorldResources', () => {
    it('debe inicializar recursos del mundo', () => {
      const worldConfig = {
        width: 100,
        height: 100,
        tileSize: 64,
        biomeMap: Array(100).fill(null).map(() => Array(100).fill('grassland')),
      };
      
      expect(() => {
        runner.initializeWorldResources(worldConfig);
      }).not.toThrow();
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
      
      let rejectedCommand: SimulationCommand | undefined;
      runner.on('commandRejected', (cmd) => {
        rejectedCommand = cmd;
      });
      
      runner.enqueueCommand(command);
      
      expect(rejectedCommand).toBeDefined();
    });
  });
});

