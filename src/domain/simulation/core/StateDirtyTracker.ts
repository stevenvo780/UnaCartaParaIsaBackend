import { injectable } from "inversify";

/**
 * Service to track which sections of the game state have been modified.
 * Used to optimize snapshot generation by only cloning dirty sections.
 */
@injectable()
export class StateDirtyTracker {
  private dirtyFlags: Set<string> = new Set();

  /**
   * Marks a section as dirty.
   * @param section The name of the section (e.g., "agents", "animals")
   */
  public markDirty(section: string): void {
    this.dirtyFlags.add(section);
  }

  /**
   * Marks multiple sections as dirty.
   * @param sections Array of section names
   */
  public markDirtyMultiple(sections: string[]): void {
    for (const section of sections) {
      this.dirtyFlags.add(section);
    }
  }

  /**
   * Checks if a section is dirty.
   * @param section The name of the section
   */
  public isDirty(section: string): boolean {
    return this.dirtyFlags.has(section);
  }

  /**
   * Gets all dirty sections and clears the flags.
   * Should be called by the snapshot manager once per tick.
   */
  public flush(): string[] {
    const dirty = Array.from(this.dirtyFlags);
    this.dirtyFlags.clear();
    return dirty;
  }
}
