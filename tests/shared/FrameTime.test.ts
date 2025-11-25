import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getFrameTime, updateFrameTime, now } from "../../src/shared/FrameTime";

describe("FrameTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debe actualizar timestamp con updateFrameTime", () => {
    const updated = updateFrameTime();
    expect(updated).toBe(Date.now());
    expect(getFrameTime()).toBe(updated);
  });

  it("debe refrescar timestamp cuando está desactualizado", () => {
    const first = getFrameTime();
    expect(first).toBe(Date.now());

    vi.advanceTimersByTime(50);
    expect(getFrameTime()).toBe(first); // Dentro del umbral

    vi.advanceTimersByTime(200);
    const refreshed = getFrameTime();
    expect(refreshed).toBe(Date.now());
    expect(refreshed).not.toBe(first);
  });

  it("debe exponer alias now", () => {
    const frameTime = now();
    expect(frameTime).toBe(getFrameTime());
  });
});

