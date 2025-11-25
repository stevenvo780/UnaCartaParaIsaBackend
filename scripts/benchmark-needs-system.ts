/**
 * Benchmark: NeedsSystem applySocialMoraleBoost
 * Compara el rendimiento O(N²) vs O(log N) con SharedSpatialIndex
 * 
 * Ejecución: npx tsx scripts/benchmark-needs-system.ts
 */

import { SharedSpatialIndex } from "../src/domain/simulation/core/SharedSpatialIndex";
import type { SimulationEntity } from "../src/domain/simulation/core/schema";

interface BenchmarkResult {
  entityCount: number;
  legacyMs: number;
  optimizedMs: number;
  speedup: string;
}

// Simula la búsqueda O(N²) legacy
function legacySearch(
  entities: SimulationEntity[],
  targetId: string,
  radius: number
): string[] {
  const target = entities.find(e => e.id === targetId);
  if (!target?.position) return [];

  const radiusSq = radius * radius;
  return entities
    .filter(e => {
      if (e.id === targetId || !e.position) return false;
      const dx = e.position.x - target.position!.x;
      const dy = e.position.y - target.position!.y;
      return dx * dx + dy * dy <= radiusSq;
    })
    .map(e => e.id);
}

// Simula la búsqueda optimizada con SharedSpatialIndex
function optimizedSearch(
  spatialIndex: SharedSpatialIndex,
  targetPosition: { x: number; y: number },
  targetId: string,
  radius: number
): string[] {
  const results = spatialIndex.queryRadius(targetPosition, radius, "agent");
  return results.filter(r => r.entity !== targetId).map(r => r.entity);
}

function generateEntities(count: number): SimulationEntity[] {
  const entities: SimulationEntity[] = [];
  const worldSize = Math.sqrt(count) * 50; // Escala el mundo según entidades

  for (let i = 0; i < count; i++) {
    entities.push({
      id: `entity-${i}`,
      position: {
        x: Math.random() * worldSize,
        y: Math.random() * worldSize,
      },
      isDead: false,
    } as SimulationEntity);
  }
  return entities;
}

function runBenchmark(entityCount: number, iterations: number = 100): BenchmarkResult {
  const entities = generateEntities(entityCount);
  const worldSize = Math.sqrt(entityCount) * 50;
  const radius = 100;

  // Configurar SharedSpatialIndex
  const spatialIndex = new SharedSpatialIndex(worldSize, worldSize, 70);
  spatialIndex.rebuildIfNeeded(entities, new Map());

  // Benchmark legacy O(N²)
  const legacyStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const targetIdx = i % entityCount;
    legacySearch(entities, `entity-${targetIdx}`, radius);
  }
  const legacyMs = performance.now() - legacyStart;

  // Benchmark optimizado O(log N)
  const optimizedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const targetIdx = i % entityCount;
    const target = entities[targetIdx];
    if (target.position) {
      optimizedSearch(spatialIndex, target.position, `entity-${targetIdx}`, radius);
    }
  }
  const optimizedMs = performance.now() - optimizedStart;

  const speedup = legacyMs / optimizedMs;

  return {
    entityCount,
    legacyMs: Math.round(legacyMs * 100) / 100,
    optimizedMs: Math.round(optimizedMs * 100) / 100,
    speedup: speedup.toFixed(2) + "x",
  };
}

// Ejecutar benchmarks
console.log("🧪 NeedsSystem applySocialMoraleBoost Benchmark");
console.log("=".repeat(60));
console.log("Comparando: O(N²) filter vs O(log N) SharedSpatialIndex\n");

const testCases = [100, 500, 1000, 2000, 3000, 5000];
const results: BenchmarkResult[] = [];

for (const count of testCases) {
  process.stdout.write(`Testing ${count} entities... `);
  const result = runBenchmark(count);
  results.push(result);
  console.log(`✅ ${result.speedup} faster`);
}

console.log("\n📊 Resultados:");
console.log("-".repeat(60));
console.log("| Entidades | Legacy (ms) | Optimized (ms) | Speedup |");
console.log("-".repeat(60));

for (const r of results) {
  console.log(
    `| ${r.entityCount.toString().padStart(9)} | ${r.legacyMs.toString().padStart(11)} | ${r.optimizedMs.toString().padStart(14)} | ${r.speedup.padStart(7)} |`
  );
}

console.log("-".repeat(60));
console.log("\n✅ Benchmark completado");
console.log("💡 El speedup aumenta con más entidades debido a O(N²) vs O(log N)");
