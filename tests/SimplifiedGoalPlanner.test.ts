import { describe, it, expect, beforeEach } from "vitest";
import { planGoalsSimplified } from "@/domain/simulation/systems/ai/core/SimplifiedGoalPlanner";
import { evaluateRules, needUtility, socialNeedUtility } from "@/domain/simulation/systems/ai/core/GoalRule";
import {
  hungerRule,
  thirstRule,
  energyRule,
  socialRule,
  workDriveRule,
  coreRules,
  extendedRules,
  fullRules,
  reproductionRule,
  gatherExpansionRule,
  fleeFromEnemyRule,
  fleeFromPredatorRule,
  attackPredatorRule,
  constructionRule,
  depositRule,
  craftWeaponRule,
} from "@/domain/simulation/systems/ai/core/GoalRules";
import { GoalType } from "@/shared/constants/AIEnums";
import { WorkEthic, ExplorationType } from "@/shared/constants/AgentEnums";
import type { AIState } from "@/domain/types/simulation/ai";
import type { EntityNeedsData } from "@/domain/types/simulation/needs";
import type { GameState } from "@/domain/types/game-types";

describe("GoalRule System", () => {
  // Helper para crear AIState de prueba
  const createAIState = (overrides?: Partial<AIState>): AIState => ({
    entityId: "test-agent",
    currentGoal: null,
    currentAction: null,
    goalQueue: [],
    personality: {
      curiosity: 0.5,
      sociability: 0.5,
      diligence: 0.5,
      aggression: 0.3,
      explorationType: ExplorationType.BALANCED,
      workEthic: WorkEthic.BALANCED,
      agreeableness: 0.5,
    },
    memory: {
      lastSeenThreats: [],
      visitedZones: new Set<string>(),
      recentInteractions: [],
      knownResourceLocations: new Map(),
      successfulActivities: new Map(),
      failedAttempts: new Map(),
    },
    ...overrides,
  });

  // Helper para crear needs
  const createNeeds = (overrides?: Partial<EntityNeedsData>): EntityNeedsData => ({
    hunger: 80,
    thirst: 80,
    energy: 80,
    social: 80,
    fun: 80,
    mentalHealth: 80,
    comfort: 80,
    safety: 80,
    ...overrides,
  });

  describe("needUtility", () => {
    it("returns 0 when need is above threshold", () => {
      expect(needUtility(50, 40)).toBe(0);
      expect(needUtility(100, 40)).toBe(0);
    });

    it("returns value between 0-1 when need is below threshold", () => {
      expect(needUtility(20, 40)).toBe(0.5);
      expect(needUtility(0, 40)).toBe(1);
    });

    it("handles undefined", () => {
      expect(needUtility(undefined, 40)).toBe(0);
    });
  });

  describe("socialNeedUtility", () => {
    it("returns 0 when need is above 70", () => {
      expect(socialNeedUtility(80)).toBe(0);
      expect(socialNeedUtility(100)).toBe(0);
    });

    it("returns value when need is below 70", () => {
      expect(socialNeedUtility(35)).toBeCloseTo(0.5);
      expect(socialNeedUtility(0)).toBe(1);
    });
  });

  describe("hungerRule", () => {
    it("does not trigger when hunger is satisfied", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 60 }),
      };
      expect(hungerRule.condition(ctx)).toBe(false);
    });

    it("triggers with high priority when hunger is critical", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 10 }),
      };
      expect(hungerRule.condition(ctx)).toBe(true);
      expect(hungerRule.priority(ctx)).toBeGreaterThan(0.9);
    });
  });

  describe("thirstRule", () => {
    it("has higher priority than hunger at same level", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 10, thirst: 10 }),
      };
      expect(thirstRule.priority(ctx)).toBeGreaterThan(hungerRule.priority(ctx));
    });
  });

  describe("workDriveRule", () => {
    it("triggers for diligent agents", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState({
          personality: {
            curiosity: 0.5,
            sociability: 0.5,
            diligence: 0.8,
            aggression: 0.3,
            explorationType: ExplorationType.BALANCED,
            workEthic: WorkEthic.BALANCED,
            agreeableness: 0.5,
          },
        }),
        now: Date.now(),
        needs: createNeeds(),
      };
      expect(workDriveRule.condition(ctx)).toBe(true);
    });

    it("has higher priority for workaholics", () => {
      const normalCtx = {
        entityId: "test",
        aiState: createAIState({
          personality: {
            curiosity: 0.5,
            sociability: 0.5,
            diligence: 0.7,
            aggression: 0.3,
            explorationType: ExplorationType.BALANCED,
            workEthic: WorkEthic.BALANCED,
            agreeableness: 0.5,
          },
        }),
        now: Date.now(),
        roleType: "gatherer",
      };
      const workaholicCtx = {
        ...normalCtx,
        aiState: createAIState({
          personality: {
            curiosity: 0.5,
            sociability: 0.5,
            diligence: 0.7,
            aggression: 0.3,
            explorationType: ExplorationType.BALANCED,
            workEthic: WorkEthic.WORKAHOLIC,
            agreeableness: 0.5,
          },
        }),
      };
      expect(workDriveRule.priority(workaholicCtx)).toBeGreaterThan(
        workDriveRule.priority(normalCtx),
      );
    });
  });

  describe("evaluateRules", () => {
    it("returns goals sorted by priority", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 20, thirst: 30, social: 50 }),
      };
      const goals = evaluateRules(coreRules, ctx, 10);
      expect(goals.length).toBeGreaterThan(0);
      // Verify sorted by priority descending
      for (let i = 1; i < goals.length; i++) {
        expect(goals[i - 1].priority).toBeGreaterThanOrEqual(goals[i].priority);
      }
    });

    it("returns critical goal immediately when very urgent", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ thirst: 5 }), // Critical thirst
      };
      const goals = evaluateRules([thirstRule, hungerRule, socialRule], ctx, 10);
      // Should return only the critical goal
      expect(goals.length).toBe(1);
      expect(goals[0].type).toBe(GoalType.SATISFY_THIRST);
    });

    it("respects maxGoals limit", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 20, thirst: 25, energy: 30, social: 50 }),
      };
      const goals = evaluateRules(coreRules, ctx, 3);
      expect(goals.length).toBeLessThanOrEqual(3);
    });
  });

  describe("planGoalsSimplified", () => {
    it("produces goals from unified context", () => {
      const gameState = { zones: [] } as unknown as GameState;
      const needs = createNeeds({ hunger: 25, thirst: 30 });
      const deps = {
        gameState,
        getEntityNeeds: () => needs,
      };
      const aiState = createAIState();
      const goals = planGoalsSimplified(deps, aiState, Date.now());

      expect(goals.length).toBeGreaterThan(0);
      // Should have hunger/thirst goals since needs are low
      const hasHungerGoal = goals.some((g) => g.type === GoalType.SATISFY_HUNGER);
      const hasThirstGoal = goals.some((g) => g.type === GoalType.SATISFY_THIRST);
      expect(hasHungerGoal || hasThirstGoal).toBe(true);
    });

    it("uses role for work decisions", () => {
      const gameState = { zones: [] } as unknown as GameState;
      const needs = createNeeds(); // All needs satisfied
      const deps = {
        gameState,
        getEntityNeeds: () => needs,
        getAgentRole: () => ({ roleType: "gatherer" }),
      };
      const aiState = createAIState({
        personality: {
          curiosity: 0.5,
          sociability: 0.5,
          diligence: 0.7,
          aggression: 0.3,
          explorationType: ExplorationType.BALANCED,
          workEthic: WorkEthic.BALANCED,
          agreeableness: 0.5,
        },
      });
      const goals = planGoalsSimplified(deps, aiState, Date.now());

      // With all needs satisfied and a role, should have work goal
      const hasWorkGoal = goals.some((g) => g.type === GoalType.WORK);
      expect(hasWorkGoal).toBe(true);
    });
  });

  // ============================================================================
  // FASE 3: Tests para reglas extendidas
  // ============================================================================

  describe("reproductionRule", () => {
    it("does not trigger when needs are low", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 30, thirst: 30, energy: 30 }), // Low needs
        stats: { health: 100 },
      };
      expect(reproductionRule.condition(ctx)).toBe(false);
    });

    it("triggers when agent is healthy and well-fed", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 90, thirst: 90, energy: 90 }), // All satisfied
        stats: { health: 100 },
      };
      expect(reproductionRule.condition(ctx)).toBe(true);
    });
  });

  describe("gatherExpansionRule", () => {
    it("triggers when inventory is not full", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        inventory: { wood: 5, stone: 5, food: 5, water: 0 }, // 15 items, capacity ~50
      };
      expect(gatherExpansionRule.condition(ctx)).toBe(true);
    });

    it("does not trigger when inventory is full", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        inventory: { wood: 20, stone: 20, food: 10, water: 0 }, // 50 items
      };
      expect(gatherExpansionRule.condition(ctx)).toBe(false);
    });
  });

  describe("fleeFromEnemyRule", () => {
    it("does not trigger for warriors", () => {
      const ctx = {
        entityId: "test-warrior",
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        enemies: ["enemy1"],
        isWarrior: true,
      };
      expect(fleeFromEnemyRule.condition(ctx)).toBe(false);
    });

    it("triggers for non-warriors with enemies (fresh entity)", () => {
      const ctx = {
        entityId: "test-flee-" + Date.now(), // Unique ID to avoid cooldown
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        enemies: ["enemy1"],
        isWarrior: false,
      };
      expect(fleeFromEnemyRule.condition(ctx)).toBe(true);
    });

    it("has high priority", () => {
      const ctx = {
        entityId: "test-priority",
        aiState: createAIState({ personality: { ...createAIState().personality, neuroticism: 0.5 } }),
        now: Date.now(),
        position: { x: 100, y: 100 },
        enemies: ["enemy1"],
        isWarrior: false,
        stats: { morale: 30 }, // Low morale = panic
      };
      expect(fleeFromEnemyRule.priority(ctx)).toBeGreaterThan(0.9);
    });
  });

  describe("fleeFromPredatorRule", () => {
    it("triggers when predator is very close (fresh entity)", () => {
      const ctx = {
        entityId: "test-predator-flee-" + Date.now(), // Unique ID
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        nearbyPredators: [{ id: "wolf1", position: { x: 150, y: 100 } }], // 50 units away
        isWarrior: false,
      };
      expect(fleeFromPredatorRule.condition(ctx)).toBe(true);
    });

    it("does not trigger when predator is far", () => {
      const ctx = {
        entityId: "test-far",
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        nearbyPredators: [{ id: "wolf1", position: { x: 200, y: 100 } }], // 100 units away
        isWarrior: false,
      };
      expect(fleeFromPredatorRule.condition(ctx)).toBe(false);
    });
  });

  describe("attackPredatorRule", () => {
    it("triggers for warriors", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        nearbyPredators: [{ id: "wolf1", position: { x: 150, y: 100 } }],
        isWarrior: true,
        stats: { morale: 80, health: 100 },
      };
      expect(attackPredatorRule.condition(ctx)).toBe(true);
    });

    it("triggers for high morale agents", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState({ personality: { ...createAIState().personality, neuroticism: 0.2 } }),
        now: Date.now(),
        position: { x: 100, y: 100 },
        nearbyPredators: [{ id: "wolf1", position: { x: 150, y: 100 } }],
        isWarrior: false,
        stats: { morale: 80, health: 100 },
      };
      expect(attackPredatorRule.condition(ctx)).toBe(true);
    });

    it("does not trigger for low morale agents", () => {
      const ctx = {
        entityId: "test",
        aiState: createAIState({ personality: { ...createAIState().personality, neuroticism: 0.8 } }),
        now: Date.now(),
        position: { x: 100, y: 100 },
        nearbyPredators: [{ id: "wolf1", position: { x: 150, y: 100 } }],
        isWarrior: false,
        stats: { morale: 40, health: 50 }, // Low morale
      };
      expect(attackPredatorRule.condition(ctx)).toBe(false);
    });
  });

  describe("extendedRules", () => {
    it("includes combat rules before core rules", () => {
      // Combat rules should be at the beginning for critical priority
      const combatRuleIds = ["flee_enemy", "flee_predator", "attack_predator"];
      const firstThreeIds = extendedRules.slice(0, 3).map((r) => r.id);
      expect(firstThreeIds).toEqual(combatRuleIds);
    });

    it("evaluates combat rules with priority", () => {
      const uniqueId = "test-combat-" + Date.now();
      const ctx = {
        entityId: uniqueId,
        aiState: createAIState(),
        now: Date.now(),
        needs: createNeeds({ hunger: 30 }), // Hungry
        position: { x: 100, y: 100 },
        enemies: ["enemy1"],
        isWarrior: false,
        stats: { morale: 30 }, // Low morale triggers panic flee
        getEntityPosition: () => ({ x: 150, y: 100 }),
      };

      const goals = evaluateRules(extendedRules, ctx, 5);

      // Flee goal should be first (highest priority)
      const fleeGoal = goals.find((g) => g.type === GoalType.FLEE);
      expect(fleeGoal).toBeDefined();
      expect(fleeGoal!.priority).toBeGreaterThan(0.9);

      // Should be sorted by priority
      expect(goals[0].type).toBe(GoalType.FLEE);
    });
  });

  describe("workRules", () => {
    it("constructionRule generates goal when buildTasks available", () => {
      const ctx = {
        entityId: "builder-1",
        aiState: createAIState({
          personality: {
            ...createAIState().personality,
            conscientiousness: 0.8,
            agreeableness: 0.7,
          },
        }),
        now: Date.now(),
        position: { x: 100, y: 100 },
        buildTasks: [{ id: "task-1", zoneId: "zone-1", score: 10 }],
      };

      expect(constructionRule.condition(ctx)).toBe(true);
      const priority = constructionRule.priority(ctx);
      expect(priority).toBeGreaterThan(0.5); // duty + community factor
      expect(priority).toBeLessThan(0.9);

      const data = constructionRule.getData!(ctx);
      expect(data.targetZoneId).toBe("zone-1");
      expect(data.data?.taskId).toBe("task-1");
    });

    it("constructionRule returns false without buildTasks", () => {
      const ctx = {
        entityId: "idle-1",
        aiState: createAIState(),
        now: Date.now(),
        position: { x: 100, y: 100 },
        buildTasks: [],
      };
      expect(constructionRule.condition(ctx)).toBe(false);
    });

    it("depositRule generates goal when inventory has load", () => {
      const ctx = {
        entityId: "carrier-1",
        aiState: createAIState({
          personality: {
            ...createAIState().personality,
            conscientiousness: 0.6,
          },
        }),
        now: Date.now(),
        inventoryLoad: 30,
        inventoryCapacity: 50,
        depositZoneId: "storage-1",
        hasWater: true,
        hasFood: false,
      };

      expect(depositRule.condition(ctx)).toBe(true);
      const priority = depositRule.priority(ctx);
      expect(priority).toBeGreaterThan(0.85); // critical resource boost
      expect(priority).toBeLessThanOrEqual(0.95);

      const data = depositRule.getData!(ctx);
      expect(data.targetZoneId).toBe("storage-1");
      expect(data.data?.hasWater).toBe(true);
    });

    it("depositRule returns false with empty inventory", () => {
      const ctx = {
        entityId: "empty-1",
        aiState: createAIState(),
        now: Date.now(),
        inventoryLoad: 0,
        inventoryCapacity: 50,
        depositZoneId: "storage-1",
      };
      expect(depositRule.condition(ctx)).toBe(false);
    });

    it("craftWeaponRule generates goal for unarmed hunter", () => {
      const ctx = {
        entityId: "hunter-1",
        aiState: createAIState(),
        now: Date.now(),
        equippedWeapon: "unarmed",
        canCraftClub: true,
        canCraftDagger: false,
        craftZoneId: "craft-zone-1",
        hasAvailableWeapons: false,
        roleType: "hunter",
      };

      expect(craftWeaponRule.condition(ctx)).toBe(true);
      const priority = craftWeaponRule.priority(ctx);
      expect(priority).toBe(0.92); // Hunter needs weapon

      const data = craftWeaponRule.getData!(ctx);
      expect(data.targetZoneId).toBe("craft-zone-1");
      expect(data.data?.itemId).toBe("wooden_club");
      expect(data.data?.roleNeedsWeapon).toBe(true);
    });

    it("craftWeaponRule prefers dagger over club", () => {
      const ctx = {
        entityId: "crafter-1",
        aiState: createAIState(),
        now: Date.now(),
        equippedWeapon: "unarmed",
        canCraftClub: true,
        canCraftDagger: true,
        craftZoneId: "craft-zone-1",
        hasAvailableWeapons: false,
        roleType: "worker",
      };

      expect(craftWeaponRule.condition(ctx)).toBe(true);
      const priority = craftWeaponRule.priority(ctx);
      expect(priority).toBe(0.72); // Non-combat role

      const data = craftWeaponRule.getData!(ctx);
      expect(data.data?.itemId).toBe("stone_dagger"); // Prefers dagger
    });

    it("craftWeaponRule returns false when already armed", () => {
      const ctx = {
        entityId: "armed-1",
        aiState: createAIState(),
        now: Date.now(),
        equippedWeapon: "wooden_club",
        canCraftClub: true,
        canCraftDagger: true,
        craftZoneId: "craft-zone-1",
      };
      expect(craftWeaponRule.condition(ctx)).toBe(false);
    });

    it("craftWeaponRule returns false when weapons in storage", () => {
      const ctx = {
        entityId: "needsweapon-1",
        aiState: createAIState(),
        now: Date.now(),
        equippedWeapon: "unarmed",
        canCraftClub: true,
        canCraftDagger: true,
        craftZoneId: "craft-zone-1",
        hasAvailableWeapons: true, // Storage has weapons
      };
      expect(craftWeaponRule.condition(ctx)).toBe(false);
    });
  });

  describe("fullRules", () => {
    it("includes all rule categories", () => {
      const ruleIds = fullRules.map((r) => r.id);

      // Combat
      expect(ruleIds).toContain("flee_enemy");
      expect(ruleIds).toContain("attack_predator");

      // Crafting
      expect(ruleIds).toContain("craft_weapon");

      // Core biological
      expect(ruleIds).toContain("bio_thirst");
      expect(ruleIds).toContain("bio_hunger");

      // Work
      expect(ruleIds).toContain("construction");
      expect(ruleIds).toContain("deposit");

      // Expansion
      expect(ruleIds).toContain("gather_expansion");
      expect(ruleIds).toContain("territory_expansion");
    });

    it("has combat rules first for critical priority", () => {
      const firstThree = fullRules.slice(0, 3).map((r) => r.id);
      expect(firstThree).toEqual([
        "flee_enemy",
        "flee_predator",
        "attack_predator",
      ]);
    });
  });
});
