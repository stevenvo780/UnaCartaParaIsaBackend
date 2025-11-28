import "reflect-metadata";
import { Container } from "inversify";
import { LifeCycleSystem } from "../src/domain/simulation/systems/LifeCycleSystem";
import { GameState } from "../src/domain/types/game-types";
import { TYPES } from "../src/config/Types";
import { Sex, LifeStage } from "../src/domain/types/simulation/agents";
import { logger } from "../src/infrastructure/utils/logger";

// Mock logger to avoid clutter
logger.info = console.log;
logger.debug = () => { };
logger.warn = console.warn;
logger.error = console.error;

async function verifyDNA() {
  const container = new Container();
  const mockGameState: GameState = {
    agents: [],
    entities: [],
    worldSize: { width: 1000, height: 1000 },
    time: { tick: 0, timeScale: 1, day: 1, year: 1, season: "spring" },
  };

  container.bind<GameState>(TYPES.GameState).toConstantValue(mockGameState);
  container.bind<LifeCycleSystem>(LifeCycleSystem).toSelf();

  const lifeCycleSystem = container.get(LifeCycleSystem);

  console.log("--- Spawning Adam ---");
  const adam = lifeCycleSystem.spawnAgent({
    name: "Adam",
    sex: Sex.MALE,
    lifeStage: LifeStage.ADULT,
  });
  console.log("Adam Appearance:", adam.appearance);

  console.log("\n--- Spawning Eve ---");
  const eve = lifeCycleSystem.spawnAgent({
    name: "Eve",
    sex: Sex.FEMALE,
    lifeStage: LifeStage.ADULT,
  });
  console.log("Eve Appearance:", eve.appearance);

  console.log("\n--- Spawning Cain (Child of Adam & Eve) ---");
  const cain = lifeCycleSystem.spawnAgent({
    name: "Cain",
    sex: Sex.MALE,
    parents: { father: adam.id, mother: eve.id },
  });
  console.log("Cain Appearance:", cain.appearance);

  // Simple verification
  if (!adam.appearance || !eve.appearance || !cain.appearance) {
    console.error("❌ FAILED: Missing appearance data");
    process.exit(1);
  }

  const cainSkin = cain.appearance.skinColor;
  const parentSkins = [adam.appearance.skinColor, eve.appearance.skinColor];

  if (parentSkins.includes(cainSkin)) {
    console.log("✅ SUCCESS: Cain inherited skin color from one parent");
  } else {
    console.warn("⚠️ WARNING: Cain has a different skin color (mutation or random fallback?)", cainSkin, parentSkins);
  }
}

verifyDNA().catch(console.error);
