/**
 * Union-Find (Disjoint Set Union) data structure with path compression and union by rank.
 * Used for efficiently tracking and merging connected components in graphs.
 *
 * Time complexity:
 * - find: O(α(n)) where α is the inverse Ackermann function (practically constant)
 * - union: O(α(n))
 * - getComponents: O(n)
 */
export class UnionFind<T = string> {
  private parent = new Map<T, T>();
  private rank = new Map<T, number>();

  /**
   * Makes a set containing only the given element.
   */
  public makeSet(x: T): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /**
   * Finds the representative (root) of the set containing x.
   * Uses path compression for optimization.
   */
  public find(x: T): T | undefined {
    if (!this.parent.has(x)) {
      return undefined;
    }

    const parentX = this.parent.get(x)!;
    if (parentX !== x) {
      // Path compression: make every node point directly to the root
      this.parent.set(x, this.find(parentX)!);
    }

    return this.parent.get(x)!;
  }

  /**
   * Unites the sets containing x and y.
   * Uses union by rank for optimization.
   * Returns true if the sets were merged, false if they were already in the same set.
   */
  public union(x: T, y: T): boolean {
    this.makeSet(x);
    this.makeSet(y);

    const rootX = this.find(x)!;
    const rootY = this.find(y)!;

    if (rootX === rootY) {
      return false; // Already in the same set
    }

    // Union by rank: attach smaller tree under root of larger tree
    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }

    return true;
  }

  /**
   * Returns true if x and y are in the same set.
   */
  public connected(x: T, y: T): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);
    return rootX !== undefined && rootY !== undefined && rootX === rootY;
  }

  /**
   * Returns all connected components as arrays of elements.
   */
  public getComponents(): T[][] {
    const components = new Map<T, T[]>();

    for (const [element] of this.parent) {
      const root = this.find(element)!;
      if (!components.has(root)) {
        components.set(root, []);
      }
      components.get(root)!.push(element);
    }

    return Array.from(components.values());
  }

  /**
   * Returns the number of distinct sets.
   */
  public getComponentCount(): number {
    const roots = new Set<T>();
    for (const [element] of this.parent) {
      roots.add(this.find(element)!);
    }
    return roots.size;
  }

  /**
   * Clears all data.
   */
  public clear(): void {
    this.parent.clear();
    this.rank.clear();
  }

  /**
   * Returns the size of the data structure.
   */
  public size(): number {
    return this.parent.size;
  }
}
