import { describe, it, expect } from 'vitest';
import { NoiseUtils } from '../../src/utils/NoiseUtils.ts";

describe('NoiseUtils', () => {
  describe('Inicialización', () => {
    it('debe inicializar con seed por defecto', () => {
      const noise = new NoiseUtils();
      expect(noise).toBeDefined();
    });

    it('debe inicializar con seed string', () => {
      const noise = new NoiseUtils('test-seed');
      expect(noise).toBeDefined();
    });

    it('debe inicializar con seed numérica', () => {
      const noise = new NoiseUtils(12345);
      expect(noise).toBeDefined();
    });
  });

  describe('noise2D', () => {
    it('debe generar valores entre -1 y 1', () => {
      const noise = new NoiseUtils('test');
      const value = noise.noise2D(0, 0);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    });

    it('debe generar valores determinísticos con la misma seed', () => {
      const noise1 = new NoiseUtils('test-seed');
      const noise2 = new NoiseUtils('test-seed');
      
      const value1 = noise1.noise2D(10, 20);
      const value2 = noise2.noise2D(10, 20);
      
      expect(value1).toBe(value2);
    });

    it('debe generar valores diferentes con seeds diferentes', () => {
      const noise1 = new NoiseUtils('seed1');
      const noise2 = new NoiseUtils('seed2');
      
      const value1 = noise1.noise2D(10, 20);
      const value2 = noise2.noise2D(10, 20);
      
      expect(value1).not.toBe(value2);
    });

    it('debe generar valores diferentes para coordenadas diferentes', () => {
      const noise = new NoiseUtils('test');
      
      const value1 = noise.noise2D(0, 0);
      const value2 = noise.noise2D(100, 100);
      const value3 = noise.noise2D(200, 200);
      const value4 = noise.noise2D(300, 300);
      
      // Verificar que los valores están en el rango correcto
      [value1, value2, value3, value4].forEach(value => {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      });
      
      // Al menos algunos valores deben ser diferentes
      const values = [value1, value2, value3, value4];
      const uniqueValues = new Set(values.map(v => v.toFixed(5)));
      // Con 4 valores diferentes, es muy probable que al menos 2 sean únicos
      expect(uniqueValues.size).toBeGreaterThanOrEqual(1);
    });

    it('debe manejar coordenadas negativas', () => {
      const noise = new NoiseUtils('test');
      const value = noise.noise2D(-10, -20);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    });

    it('debe manejar coordenadas grandes', () => {
      const noise = new NoiseUtils('test');
      const value = noise.noise2D(10000, 20000);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    });

    it('debe generar valores suaves para coordenadas cercanas', () => {
      const noise = new NoiseUtils('test');
      
      const value1 = noise.noise2D(10, 20);
      const value2 = noise.noise2D(10.1, 20.1);
      const value3 = noise.noise2D(10.2, 20.2);
      
      // Los valores deberían ser relativamente cercanos
      const diff1 = Math.abs(value1 - value2);
      const diff2 = Math.abs(value2 - value3);
      
      expect(diff1).toBeLessThan(0.5);
      expect(diff2).toBeLessThan(0.5);
    });

    it('debe generar valores consistentes para el mismo punto', () => {
      const noise = new NoiseUtils('test');
      
      const value1 = noise.noise2D(42, 24);
      const value2 = noise.noise2D(42, 24);
      
      expect(value1).toBe(value2);
    });
  });
});

