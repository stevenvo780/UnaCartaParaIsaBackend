import { Difficulty } from "../../../../shared/constants/MovementEnums";

// Re-export Difficulty enum for backward compatibility
export { Difficulty };

export function estimateTravelTime(
  distancePx: number,
  fatigue: number,
  baseSpeedPxPerSec: number,
  fatiguePenaltyMultiplier: number,
): number {
  const fatigueMultiplier = 1 + (fatigue / 100) * fatiguePenaltyMultiplier;
  const adjustedSpeed = baseSpeedPxPerSec / fatigueMultiplier;
  return (distancePx / adjustedSpeed) * 1000;
}

export function assessRouteDifficultyByDistance(
  distancePx: number,
): Difficulty {
  if (distancePx < 200) return Difficulty.EASY;
  if (distancePx < 500) return Difficulty.MEDIUM;
  return Difficulty.HARD;
}

export function findAccessibleDestination(
  grid: number[][],
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight: number,
  maxRadius: number = 3,
): { x: number; y: number } {
  if (grid[targetY] && grid[targetY][targetX] === 0) {
    return { x: targetX, y: targetY };
  }

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const newX = targetX + dx;
        const newY = targetY + dy;
        if (
          newX >= 0 &&
          newY >= 0 &&
          newX < gridWidth &&
          newY < gridHeight &&
          grid[newY] &&
          grid[newY][newX] === 0
        ) {
          return { x: newX, y: newY };
        }
      }
    }
  }

  return { x: targetX, y: targetY };
}

export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoneWithBounds {
  bounds: ZoneBounds;
}

export function calculateZoneDistance(
  zoneA: ZoneWithBounds,
  zoneB: ZoneWithBounds,
): number {
  const centerA = {
    x: zoneA.bounds.x + zoneA.bounds.width / 2,
    y: zoneA.bounds.y + zoneA.bounds.height / 2,
  };
  const centerB = {
    x: zoneB.bounds.x + zoneB.bounds.width / 2,
    y: zoneB.bounds.y + zoneB.bounds.height / 2,
  };
  return Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y);
}

export function worldToGrid(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: Math.floor(x / gridSize),
    y: Math.floor(y / gridSize),
  };
}
