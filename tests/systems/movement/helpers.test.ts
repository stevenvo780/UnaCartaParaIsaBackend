import { describe, it, expect } from "vitest";
import {
  estimateTravelTime,
  assessRouteDifficultyByDistance,
  findAccessibleDestination,
  calculateZoneDistance,
  worldToGrid,
} from "../../../src/domain/simulation/systems/movement/helpers";

describe("movement helpers", () => {
  it("estimateTravelTime incrementa con la fatiga", () => {
    const base = estimateTravelTime(1000, 0, 100, 0.5);
    const fatigued = estimateTravelTime(1000, 50, 100, 0.5);
    expect(fatigued).toBeGreaterThan(base);
  });

  it("assessRouteDifficultyByDistance clasifica distancias", () => {
    expect(assessRouteDifficultyByDistance(100)).toBe("easy");
    expect(assessRouteDifficultyByDistance(300)).toBe("medium");
    expect(assessRouteDifficultyByDistance(800)).toBe("hard");
  });

  it("findAccessibleDestination retorna alternativa cuando el objetivo está bloqueado", () => {
    const grid = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 0, 1],
    ];
    const dest = findAccessibleDestination(grid, 1, 1, 3, 3, 2);
    expect(dest).toEqual({ x: 1, y: 2 });
  });

  it("calculateZoneDistance usa centros de las zonas", () => {
    const zoneA = { bounds: { x: 0, y: 0, width: 10, height: 10 } };
    const zoneB = { bounds: { x: 30, y: 40, width: 10, height: 10 } };
    const distance = calculateZoneDistance(zoneA, zoneB);
    expect(distance).toBeCloseTo(Math.hypot(35 - 5, 45 - 5));
  });

  it("worldToGrid convierte coordenadas a celdas", () => {
    expect(worldToGrid(63, 65, 32)).toEqual({ x: 1, y: 2 });
  });
});
