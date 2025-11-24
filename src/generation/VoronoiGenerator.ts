import Delaunator from "delaunator";
import { BiomeType } from "./types.js";
import seedrandom from "seedrandom";

export interface Point {
  x: number;
  y: number;
}

export interface VoronoiCell {
  site: Point;
  vertices: Point[];
  neighbors: number[];
}

export interface VoronoiRegion {
  id: number;
  center: Point;
  bounds: Point[];
  area: number;
  biomeType?: string;
  biome?: BiomeType;
}

export class VoronoiGenerator {
  private width: number;
  private height: number;
  private rng: seedrandom.PRNG;

  constructor(
    width: number,
    height: number,
    seed?: string,
  ) {
    this.width = width;
    this.height = height;
    this.rng = seedrandom(seed || `voronoi-${Date.now()}`);
  }

  generateRegions(numRegions: number, minDistance = 100): VoronoiRegion[] {
    const sites = this.poissonDiskSampling(numRegions, minDistance);
    const voronoi = this.computeVoronoi(sites);
    const regions = this.convertToRegions(voronoi);

    return regions;
  }

  private poissonDiskSampling(
    targetCount: number,
    minDistance: number,
  ): Point[] {
    const points: Point[] = [];
    const active: Point[] = [];
    const cellSize = minDistance / Math.sqrt(2);
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);
    const grid: (Point | null)[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null) as (Point | null)[]);
    const initialPoint: Point = {
      x: this.rng() * this.width,
      y: this.rng() * this.height,
    };

    points.push(initialPoint);
    active.push(initialPoint);

    const col = Math.floor(initialPoint.x / cellSize);
    const row = Math.floor(initialPoint.y / cellSize);
    grid[row][col] = initialPoint;

    const k = 30;

    while (active.length > 0 && points.length < targetCount) {
      const randomIndex = Math.floor(this.rng() * active.length);
      const point = active[randomIndex];
      let found = false;

      for (let tries = 0; tries < k; tries++) {
        const angle = this.rng() * 2 * Math.PI;
        const radius = minDistance * (1 + this.rng());
        const candidate: Point = {
          x: point.x + radius * Math.cos(angle),
          y: point.y + radius * Math.sin(angle),
        };

        if (
          candidate.x < 0 ||
          candidate.x >= this.width ||
          candidate.y < 0 ||
          candidate.y >= this.height
        ) {
          continue;
        }

        const candidateCol = Math.floor(candidate.x / cellSize);
        const candidateRow = Math.floor(candidate.y / cellSize);

        let valid = true;

        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            const neighborRow = candidateRow + i;
            const neighborCol = candidateCol + j;

            if (
              neighborRow >= 0 &&
              neighborRow < rows &&
              neighborCol >= 0 &&
              neighborCol < cols &&
              grid[neighborRow][neighborCol]
            ) {
              const neighbor = grid[neighborRow][neighborCol]!;
              const distance = Math.sqrt(
                (candidate.x - neighbor.x) ** 2 +
                  (candidate.y - neighbor.y) ** 2,
              );

              if (distance < minDistance) {
                valid = false;
                break;
              }
            }
          }
          if (!valid) break;
        }

        if (valid) {
          points.push(candidate);
          active.push(candidate);
          grid[candidateRow][candidateCol] = candidate;
          found = true;
          break;
        }
      }

      if (!found) {
        active.splice(randomIndex, 1);
      }
    }

    return points;
  }

  private computeVoronoi(sites: Point[]): VoronoiCell[] {
    // Delaunator works with flat arrays of coordinates
    const delaunay = Delaunator.from(
      sites.map((site) => [site.x, site.y])
    );

    const cells: VoronoiCell[] = [];

    for (let i = 0; i < sites.length; i++) {
      const cell: VoronoiCell = {
        site: sites[i],
        vertices: [],
        neighbors: [],
      };

      const vertices = this.getVoronoiCellVertices(delaunay, i);
      cell.vertices = vertices;

      cells.push(cell);
    }

    return cells;
  }

  private getVoronoiCellVertices(
    delaunay: Delaunator<Float64Array>,
    siteIndex: number,
  ): Point[] {
    const vertices: Point[] = [];
    const { triangles, halfedges: _halfedges } = delaunay;

    const triangleIndices: number[] = [];
    for (let t = 0; t < triangles.length; t += 3) {
      if (
        triangles[t] === siteIndex ||
        triangles[t + 1] === siteIndex ||
        triangles[t + 2] === siteIndex
      ) {
        triangleIndices.push(t / 3);
      }
    }
    for (const triangleIndex of triangleIndices) {
      const t = triangleIndex * 3;
      const i = triangles[t];
      const j = triangles[t + 1];
      const k = triangles[t + 2];

      const circumcenter = this.circumcenter(
        delaunay.coords[2 * i],
        delaunay.coords[2 * i + 1],
        delaunay.coords[2 * j],
        delaunay.coords[2 * j + 1],
        delaunay.coords[2 * k],
        delaunay.coords[2 * k + 1],
      );

      vertices.push(circumcenter);
    }

    return vertices;
  }

  private circumcenter(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ): Point {
    const dx = bx - ax;
    const dy = by - ay;
    const ex = cx - ax;
    const ey = cy - ay;
    const bl = dx * dx + dy * dy;
    const cl = ex * ex + ey * ey;

    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-10) {
      return {
        x: (ax + bx + cx) / 3,
        y: (ay + by + cy) / 3,
      };
    }

    const d = 0.5 / denominator;

    return {
      x: ax + (ey * bl - dy * cl) * d,
      y: ay + (dx * cl - ex * bl) * d,
    };
  }

  private convertToRegions(cells: VoronoiCell[]): VoronoiRegion[] {
    return cells.map((cell, index) => {
      const area = this.calculatePolygonArea(cell.vertices);

      return {
        id: index,
        center: cell.site,
        bounds: cell.vertices,
        area: Math.abs(area),
      };
    });
  }

  private calculatePolygonArea(vertices: Point[]): number {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }

    return area / 2;
  }

  assignBiomes(regions: VoronoiRegion[]): VoronoiRegion[] {
    return regions.map((region) => {
      let selected: BiomeType;

      if (region.center.y < this.height * 0.15) {
        selected = BiomeType.MOUNTAIN;
      } else if (region.center.y > this.height * 0.85) {
        selected = BiomeType.SWAMP;
      } else if (region.center.x < this.width * 0.15) {
        selected = BiomeType.FOREST;
      } else if (region.center.x > this.height * 0.85) {
        selected = BiomeType.DESERT;
      } else if (region.area < 2000) {
        selected = BiomeType.LAKE;
      } else if (region.area > 15000) {
        selected = BiomeType.OCEAN;
      } else {
        selected = BiomeType.GRASSLAND;
      }

      return {
        ...region,
        biome: selected,
        biomeType: selected,
      } as VoronoiRegion;
    });
  }
}
