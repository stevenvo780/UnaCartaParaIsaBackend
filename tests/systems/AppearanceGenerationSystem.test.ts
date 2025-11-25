import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentProfile } from "../../src/shared/types/simulation/agents";
import { AppearanceGenerationSystem } from "../../src/domain/simulation/systems/AppearanceGenerationSystem";
import {
  simulationEvents,
  GameEventNames,
} from "../../src/domain/simulation/core/events";

const baseProfile: AgentProfile = {
  id: "agent-1",
  name: "Agent One",
  sex: "female",
  ageYears: 24,
  lifeStage: "adult",
  birthTimestamp: Date.now() - 24 * 365 * 24 * 60 * 60 * 1000,
  generation: 2,
  traits: {
    cooperation: 0.6,
    aggression: 0.3,
    diligence: 0.7,
    curiosity: 0.5,
  },
};

describe("AppearanceGenerationSystem", () => {
  let system: AppearanceGenerationSystem;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    emitSpy = vi.spyOn(simulationEvents, "emit").mockReturnValue(true);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    system = new AppearanceGenerationSystem({
      inheritanceStrength: 1,
      enableTraitModifiers: true,
      enableSocialMarkers: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("genera y almacena apariencias emitiendo APPEARANCE_GENERATED", () => {
    const appearance = system.generateAppearance("agent-1", baseProfile);
    expect(appearance.agentId).toBe("agent-1");
    expect(system.getAppearance("agent-1")).toEqual(appearance);
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.APPEARANCE_GENERATED,
      expect.objectContaining({
        agentId: "agent-1",
        appearance,
      }),
    );
  });

  it("hereda tonos de piel y cabello cuando se proporcionan padres", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const fatherProfile: AgentProfile = {
      ...baseProfile,
      id: "father",
      sex: "male",
      generation: 1,
      name: "Father",
    };
    const motherProfile: AgentProfile = {
      ...baseProfile,
      id: "mother",
      name: "Mother",
    };

    const fatherAppearance = system.generateAppearance(
      fatherProfile.id,
      fatherProfile,
    );
    const motherAppearance = system.generateAppearance(
      motherProfile.id,
      motherProfile,
    );

    const childProfile: AgentProfile = {
      ...baseProfile,
      id: "child",
      generation: 3,
      parents: { father: fatherProfile.id, mother: motherProfile.id },
    };

    const childAppearance = system.generateAppearance(
      childProfile.id,
      childProfile,
      fatherProfile.id,
      motherProfile.id,
    );

    expect([fatherAppearance.skinTone, motherAppearance.skinTone]).toContain(
      childAppearance.skinTone,
    );
    expect([fatherAppearance.hairColor, motherAppearance.hairColor]).toContain(
      childAppearance.hairColor,
    );
  });

  it("asigna marcadores de grupo social y reusa configuraciones", () => {
    system.generateAppearance("agent-1", baseProfile);

    system.assignSocialGroupMarkers("agent-1", "group-1");

    const appearance = system.getAppearance("agent-1");
    expect(appearance?.groupMarker).toBeDefined();
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.APPEARANCE_UPDATED,
      expect.objectContaining({
        agentId: "agent-1",
        reason: "social_group_assigned",
      }),
    );

    system.generateAppearance("agent-2", {
      ...baseProfile,
      id: "agent-2",
      name: "Agent Two",
    });
    system.assignSocialGroupMarkers("agent-2", "group-1");

    const secondAppearance = system.getAppearance("agent-2");
    expect(secondAppearance?.groupMarker?.symbol).toBe(
      appearance?.groupMarker?.symbol,
    );
  });

  it("actualiza apariencia por envejecimiento y emite evento", () => {
    system.generateAppearance("agent-1", baseProfile);

    system.updateForAging("agent-1", "elder");
    const appearance = system.getAppearance("agent-1");

    expect(appearance?.lifeStage).toBe("elder");
    expect(appearance?.hairColor).toBe("#C0C0C0");
    expect(emitSpy).toHaveBeenCalledWith(
      GameEventNames.APPEARANCE_UPDATED,
      expect.objectContaining({
        agentId: "agent-1",
        reason: "aging",
      }),
    );
  });

  it("calcula métricas de diversidad", () => {
    system.generateAppearance("agent-1", baseProfile);
    system.generateAppearance("agent-2", {
      ...baseProfile,
      id: "agent-2",
      name: "Agent Two",
      generation: 4,
    });

    const stats = system.getDiversityStats();
    expect(stats.totalAppearances).toBe(2);
    expect(stats.generationsRepresented).toBe(2);
    expect(stats.skinToneDistribution).not.toEqual({});
  });

  it("exporta e importa apariencias y grupos", () => {
    system.generateAppearance("agent-1", baseProfile);
    system.assignSocialGroupMarkers("agent-1", "group-1");

    const data = system.exportAppearances();
    const imported = new AppearanceGenerationSystem();
    imported.importAppearances(data);

    expect(imported.getAppearance("agent-1")).toEqual(
      system.getAppearance("agent-1"),
    );
    expect(imported.getSocialGroupAppearance("group-1")).toBeDefined();
  });

  it("retorna tema por generación, usando fallback cuando excede el límite", () => {
    const theme = system.getGenerationTheme(99);
    expect(theme?.generation).toBe(10);
  });
});
