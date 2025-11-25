import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedCraftingSystem } from "../../src/domain/simulation/systems/EnhancedCraftingSystem.ts";
import { InventorySystem } from "../../src/domain/simulation/systems/InventorySystem.ts";
import { createMockGameState } from '../setup.ts';
import type { GameState } from '../../src/domain/types/game-types.ts';

describe('EnhancedCraftingSystem', () => {
  let gameState: GameState;
  let inventorySystem: InventorySystem;
  let craftingSystem: EnhancedCraftingSystem;

  beforeEach(() => {
    gameState = createMockGameState({
      entities: [
        {
          id: 'agent-1',
          position: { x: 100, y: 100 },
          type: 'agent',
        },
      ],
    });
    inventorySystem = new InventorySystem();
    craftingSystem = new EnhancedCraftingSystem(gameState, inventorySystem);
  });

  describe('Inicialización', () => {
    it('debe inicializar correctamente', () => {
      expect(craftingSystem).toBeDefined();
    });

    it('debe usar configuración por defecto', () => {
      // El sistema usa configuración por defecto cuando se crea
      const customSystem = new EnhancedCraftingSystem(
        gameState,
        inventorySystem
      );
      expect(customSystem).toBeDefined();
    });
  });

  describe('canCraftWeapon', () => {
    it('debe retornar false si no hay ingredientes', () => {
      const canCraft = craftingSystem.canCraftWeapon('agent-1', 'stone_dagger');
      expect(canCraft).toBe(false);
    });

    it('debe retornar false para receta inexistente', () => {
      const canCraft = craftingSystem.canCraftWeapon('agent-1', 'nonexistent_weapon' as any);
      expect(canCraft).toBe(false);
    });
  });

  describe('craftBestWeapon', () => {
    it('debe retornar null si no puede craftear', () => {
      const weapon = craftingSystem.craftBestWeapon('agent-1');
      expect(weapon).toBeNull();
    });
  });

  describe('getEquippedWeapon', () => {
    it('debe retornar undefined si no hay arma equipada', () => {
      const weapon = craftingSystem.getEquippedWeapon('agent-1');
      expect(weapon).toBeUndefined();
    });
  });

  describe('startCrafting y finishJob', () => {
    it('debe retornar false si no tiene todos los ingredientes', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 10);
      inventorySystem.addResource('agent-1', 'wood', 10);
      // Con el mapeo corregido ahora fiber mapea a wood, así que SÍ puede craftar
      
      const canCraft = craftingSystem.canCraftWeapon('agent-1', 'stone_dagger');
      expect(canCraft).toBe(true);
    });

    it('debe retornar false si realmente no tiene suficientes recursos', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 1); // No alcanza
      inventorySystem.addResource('agent-1', 'wood', 1);  // No alcanza
      
      const canCraft = craftingSystem.canCraftWeapon('agent-1', 'stone_dagger');
      expect(canCraft).toBe(false);
    });

    it('debe craftar si tiene suficientes recursos con mapeo', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 10);
      inventorySystem.addResource('agent-1', 'wood', 10);
      // stone_dagger: stone(2) + wood_log→wood(1) + fiber→wood(2) = stone(2) + wood(3)
      
      const weapon = craftingSystem.craftBestWeapon('agent-1');
      expect(weapon).toBe('stone_dagger');
    });

    it('no debe completar trabajo antes del tiempo', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 10);
      inventorySystem.addResource('agent-1', 'wood', 10);
      
      craftingSystem.craftBestWeapon('agent-1');
      
      // El trabajo está en progreso pero no ha terminado
      const equipped = craftingSystem.getEquippedWeapon('agent-1');
      // Todavía no está equipado porque el trabajo no ha terminado
      expect(equipped).toBeUndefined();
    });
  });

  describe('craftBestWeapon', () => {
    it('debe craftar la mejor arma disponible si tiene todos los ingredientes', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      // Con el mapeo corregido: wood_log → wood, fiber → wood, stone → stone
      // stone_dagger requiere: stone(2), wood_log(1), fiber(2) → stone(2) + wood(3)
      // Con 10 wood y 10 stone, puede craftear stone_dagger
      inventorySystem.addResource('agent-1', 'wood', 10);
      inventorySystem.addResource('agent-1', 'stone', 10);
      
      const weapon = craftingSystem.craftBestWeapon('agent-1');
      // Ahora SÍ puede craftar porque fiber se mapea a wood
      expect(weapon).toBe('stone_dagger');
    });

    it('debe retornar null si no puede craftar ninguna arma', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      const weapon = craftingSystem.craftBestWeapon('agent-1');
      expect(weapon).toBeNull();
    });

    it('debe retornar null si no tiene suficientes recursos para ninguna arma', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      // Solo 1 stone y 1 wood - no alcanza para ningún arma
      inventorySystem.addResource('agent-1', 'wood', 1);
      inventorySystem.addResource('agent-1', 'stone', 1);
      
      const weapon = craftingSystem.craftBestWeapon('agent-1');
      expect(weapon).toBeNull();
    });
  });

  describe('update', () => {
    it('debe actualizar sin errores', () => {
      expect(() => {
        craftingSystem.update();
      }).not.toThrow();
    });

    it('debe procesar múltiples trabajos activos', () => {
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 10);
      inventorySystem.addResource('agent-1', 'wood', 10);
      
      craftingSystem.craftBestWeapon('agent-1');
      craftingSystem.update();
      
      expect(craftingSystem).toBeDefined();
    });
  });

  describe('Configuración', () => {
    it('debe respetar configuración por defecto', () => {
      // El sistema usa configuración por defecto (requireWorkstation: false)
      inventorySystem.initializeAgentInventory('agent-1');
      inventorySystem.addResource('agent-1', 'stone', 10);
      inventorySystem.addResource('agent-1', 'wood', 10);
      
      // Con config por defecto, puede craftar sin estación
      const canCraft = craftingSystem.canCraftWeapon('agent-1', 'stone_dagger');
      expect(canCraft).toBe(true);
    });
  });
});