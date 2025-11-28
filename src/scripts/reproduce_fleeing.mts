
import "reflect-metadata";
import { Container } from "inversify";
import { AIActionPlanner } from "../domain/simulation/systems/ai/core/AIActionPlanner.js";
import { CombatEvaluator, evaluateCombatGoals } from "../domain/simulation/systems/ai/evaluators/CombatEvaluator.js";
import { GameState } from "../domain/types/game-types.js";
import { AgentRegistry } from "../domain/simulation/core/AgentRegistry.js";
import { AIGoal, AIState, AgentAction, GoalType } from "../domain/types/simulation/ai.js";
import { ActionType } from "../shared/constants/AIEnums.js";
import { logger } from "../infrastructure/utils/logger.js";

// Mock Logger to avoid clutter
logger.info = () => { };
logger.debug = () => { };
logger.warn = console.warn;
logger.error = console.error;

const mockGameState: GameState = {
  id: "test",
  worldId: "test",
  tick: 0,
  entities: [],
  agents: [],
  zones: [],
  worldResources: {},
  time: { totalTime: 0, day: 0, hour: 0, minute: 0, phase: "day" },
  weather: { type: "clear", intensity: 0, temperature: 20 },
  governance: {
    taxRate: 0,
    laws: [],
    demands: [],
    treasury: 0,
    expenses: [],
    history: []
  },
  economy: {
    market: { orders: [], history: [] },
    prices: {},
    stats: { gdp: 0, inflation: 0, tradeVolume: 0 }
  },
  stats: {
    population: 0,
    happiness: 0,
    wealth: 0,
    resources: {},
    buildings: 0
  }
};

const mockAgentRegistry = {
  getPosition: (id: string) => {
    if (id === "agent1") return { x: 100, y: 100 };
    return null;
  },
  getProfile: (id: string) => ({ id, position: { x: 100, y: 100 } }),
} as unknown as AgentRegistry;

const planner = new AIActionPlanner({
  gameState: mockGameState,
  agentRegistry: mockAgentRegistry,
});

// Simulate Combat Context
const combatContext = {
  getEntityPosition: (id: string) => {
    if (id === "agent1") return { x: 100, y: 100 }; // Agent
    if (id === "enemy1") return { x: 110, y: 110 }; // Enemy very close
    return null;
  },
  getEntityStats: () => ({ morale: 20, mentalHealth: 20, stamina: 50 }), // Low morale -> Panic
  getStrategy: () => "peaceful",
  isWarrior: () => false,
  getEnemiesForAgent: () => ["enemy1"],
  getNearbyPredators: () => [],
};

const aiState: AIState = {
  entityId: "agent1",
  personality: {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.9, // High neuroticism -> Panic
  },
  memory: {},
  goalQueue: [],
  currentGoal: null,
  currentAction: null,
  offDuty: false,
  lastDecisionTime: 0,
};

console.log("--- Starting Reproduction ---");

// 1. Evaluate Combat Goals
const goals = evaluateCombatGoals(combatContext as any, aiState);
console.log("Generated Goals:", goals.map(g => `${g.type} -> ${JSON.stringify(g.targetPosition)}`));

const fleeGoal = goals.find(g => g.type === GoalType.FLEE);

if (!fleeGoal) {
  console.error("FAILED: No FLEE goal generated!");
  process.exit(1);
}

// 2. Plan Action for Flee Goal
console.log("\n--- Planning Action ---");
const action = planner.planAction("agent1", fleeGoal);
console.log("Planned Action:", action ? `${action.actionType} -> ${JSON.stringify(action.targetPosition)}` : "null");

// 3. Simulate "Arrived but not escaped"
// Agent is at 100,100. Enemy is at 110,110.
// Flee target might be close.
// Let's see if planAction returns null (meaning "stop") when it shouldn't.

if (action?.actionType === ActionType.MOVE) {
  const dist = Math.hypot(action.targetPosition!.x - 100, action.targetPosition!.y - 100);
  console.log(`Move Distance: ${dist}`);
  if (dist < 5) {
    console.log("WARNING: Move distance is very small!");
  }
} else {
  console.log("Action is NOT MOVE (or null). Agent might be stuck.");
}

// 4. Simulate being AT the target position but still threatened (Enemy Chased)
if (fleeGoal.targetPosition) {
  console.log("\n--- Simulating Arrival at Flee Target (Enemy Chased) ---");
  // Update mock position to be AT the flee target
  mockAgentRegistry.getPosition = (id: string) => {
    if (id === "agent1") return fleeGoal.targetPosition!;
    return null;
  };

  // Enemy moved closer!
  // Agent is at ~(-48, -48).
  // Place enemy at (-40, -40) -> very close.
  const enemyPos = { x: fleeGoal.targetPosition.x + 10, y: fleeGoal.targetPosition.y + 10 };

  // Update combat context to reflect new enemy position
  combatContext.getEntityPosition = (id: string) => {
    if (id === "agent1") return fleeGoal.targetPosition!;
    if (id === "enemy1") return enemyPos;
    return null;
  };

  const newDistToEnemy = Math.hypot(fleeGoal.targetPosition.x - enemyPos.x, fleeGoal.targetPosition.y - enemyPos.y);
  console.log(`Distance to enemy after move: ${newDistToEnemy}`);

  // Plan action again
  const action2 = planner.planAction("agent1", fleeGoal);
  console.log("Planned Action at Target:", action2 ? `${action2.actionType} -> ${JSON.stringify(action2.targetPosition)}` : "null");

  if (action2?.actionType === ActionType.MOVE) {
    const distToTarget = Math.hypot(action2.targetPosition!.x - fleeGoal.targetPosition.x, action2.targetPosition!.y - fleeGoal.targetPosition.y);
    console.log(`Distance to target in new action: ${distToTarget}`);
    if (distToTarget < 2) {
      console.log("FAILURE CONFIRMED: Agent is moving to current position (Freezing)!");
    } else {
      console.log("Agent is moving to a NEW target? Dist:", distToTarget);
    }
  } else if (action2 === null) {
    console.log("Agent stopped while in danger! (Also bad)");
  }
}
