import { describe, it, expect } from "vitest";
import {
  mapGoalToActivity,
  getActivityDuration,
  activityRequiresZone,
  type ActivityType,
} from "../../../src/domain/simulation/systems/ai/ActivityMapper.ts";
import type { AIGoal } from "../../../src/domain/types/simulation/ai.ts";

describe("ActivityMapper", () => {
  describe("mapGoalToActivity", () => {
    it("debe mapear goal de satisfacer necesidad de hambre a eating", () => {
      const goal: AIGoal = {
        id: "test-1",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "hunger" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("eating");
    });

    it("debe mapear goal de satisfacer necesidad de sed a drinking", () => {
      const goal: AIGoal = {
        id: "test-2",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "thirst" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("drinking");
    });

    it("debe mapear goal de satisfacer necesidad de energía a resting", () => {
      const goal: AIGoal = {
        id: "test-3",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "energy" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("resting");
    });

    it("debe mapear goal de satisfacer necesidad de higiene a cleaning", () => {
      const goal: AIGoal = {
        id: "test-4",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "hygiene" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("cleaning");
    });

    it("debe mapear goal de satisfacer necesidad social a socializing", () => {
      const goal: AIGoal = {
        id: "test-5",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "social" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("socializing");
    });

    it("debe mapear goal de satisfacer necesidad de diversión a playing", () => {
      const goal: AIGoal = {
        id: "test-6",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "fun" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("playing");
    });

    it("debe mapear goal de satisfacer necesidad de salud mental a meditating", () => {
      const goal: AIGoal = {
        id: "test-7",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "mentalHealth" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("meditating");
    });

    it("debe retornar idle para necesidad desconocida", () => {
      const goal: AIGoal = {
        id: "test-8",
        type: "satisfy_need",
        priority: 0.8,
        data: { need: "unknown_need" },
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("idle");
    });

    it("debe retornar idle si no hay data.need", () => {
      const goal: AIGoal = {
        id: "test-9",
        type: "satisfy_need",
        priority: 0.8,
        data: {},
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("idle");
    });

    it("debe mapear goal de explorar a moving", () => {
      const goal: AIGoal = {
        id: "test-10",
        type: "explore",
        priority: 0.5,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("moving");
    });

    it("debe mapear goal de trabajo a working", () => {
      const goal: AIGoal = {
        id: "test-11",
        type: "work",
        priority: 0.7,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("working");
    });

    it("debe mapear goal social a socializing", () => {
      const goal: AIGoal = {
        id: "test-12",
        type: "social",
        priority: 0.6,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("socializing");
    });

    it("debe mapear goal de descanso a resting", () => {
      const goal: AIGoal = {
        id: "test-13",
        type: "rest",
        priority: 0.8,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("resting");
    });

    it("debe mapear goal de inspeccionar a inspecting", () => {
      const goal: AIGoal = {
        id: "test-14",
        type: "inspect",
        priority: 0.5,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("inspecting");
    });

    it("debe mapear goal de huir a fleeing", () => {
      const goal: AIGoal = {
        id: "test-15",
        type: "flee",
        priority: 0.9,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("fleeing");
    });

    it("debe mapear goal de atacar a attacking", () => {
      const goal: AIGoal = {
        id: "test-16",
        type: "attack",
        priority: 0.9,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("attacking");
    });

    it("debe retornar idle para tipo de goal desconocido", () => {
      const goal: AIGoal = {
        id: "test-17",
        type: "unknown" as any,
        priority: 0.5,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5000,
      };
      const activity = mapGoalToActivity(goal);
      expect(activity).toBe("idle");
    });
  });

  describe("getActivityDuration", () => {
    const activities: ActivityType[] = [
      "idle",
      "moving",
      "eating",
      "drinking",
      "cleaning",
      "playing",
      "meditating",
      "working",
      "resting",
      "socializing",
      "inspecting",
      "fleeing",
      "attacking",
    ];

    it("debe retornar duración correcta para cada actividad", () => {
      expect(getActivityDuration("idle")).toBe(0);
      expect(getActivityDuration("moving")).toBe(0);
      expect(getActivityDuration("eating")).toBe(5000);
      expect(getActivityDuration("drinking")).toBe(3000);
      expect(getActivityDuration("cleaning")).toBe(6000);
      expect(getActivityDuration("playing")).toBe(12000);
      expect(getActivityDuration("meditating")).toBe(10000);
      expect(getActivityDuration("working")).toBe(15000);
      expect(getActivityDuration("resting")).toBe(8000);
      expect(getActivityDuration("socializing")).toBe(8000);
      expect(getActivityDuration("inspecting")).toBe(5000);
      expect(getActivityDuration("fleeing")).toBe(0);
      expect(getActivityDuration("attacking")).toBe(2000);
    });

    it("debe retornar número para todas las actividades", () => {
      activities.forEach((activity) => {
        const duration = getActivityDuration(activity);
        expect(typeof duration).toBe("number");
        expect(duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("activityRequiresZone", () => {
    it("debe retornar true para actividades que requieren zona", () => {
      expect(activityRequiresZone("eating")).toBe(true);
      expect(activityRequiresZone("drinking")).toBe(true);
      expect(activityRequiresZone("cleaning")).toBe(true);
      expect(activityRequiresZone("playing")).toBe(true);
      expect(activityRequiresZone("meditating")).toBe(true);
      expect(activityRequiresZone("working")).toBe(true);
      expect(activityRequiresZone("resting")).toBe(true);
      expect(activityRequiresZone("socializing")).toBe(true);
    });

    it("debe retornar false para actividades que no requieren zona", () => {
      expect(activityRequiresZone("idle")).toBe(false);
      expect(activityRequiresZone("moving")).toBe(false);
      expect(activityRequiresZone("inspecting")).toBe(false);
      expect(activityRequiresZone("fleeing")).toBe(false);
      expect(activityRequiresZone("attacking")).toBe(false);
    });
  });
});

