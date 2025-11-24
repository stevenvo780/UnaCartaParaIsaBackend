import { GameState } from "../../types/game-types";
import { simulationEvents, GameEventNames } from "../core/events";
import { NeedsSystem } from "./NeedsSystem";
import type { SocialSystem } from "./SocialSystem";
import type { QuestSystem } from "./QuestSystem";
import type { EntityNeedsData } from "../../types/simulation/needs";
import type {
  DialogueCard,
  DialogueChoice,
  DialogueStateSnapshot,
  DialogueTone,
  DialoguePriority,
} from "../../types/simulation/ambient";

interface CardTemplate {
  id: string;
  title: string;
  contentVariations: string[];
  triggers: {
    needsBased?: Array<{
      need: keyof EntityNeedsData;
      threshold: number;
      operator: "below" | "above";
    }>;
    timeBased?: Array<{
      time: "dawn" | "day" | "dusk" | "night";
      frequency: "daily" | "hourly";
    }>;
    relationshipBased?: Array<{
      minLevel: number;
      withRole?: string;
    }>;
    eventBased?: Array<{
      event: string;
    }>;
  };
  choices?: DialogueChoice[];
  emotionalTone: DialogueTone;
  type?: DialogueCard["type"];
}

interface ActiveCardEntry {
  card: DialogueCard;
  expiresAt: number;
}

export class CardDialogueSystem {
  private readonly cardTemplates: CardTemplate[] = this.createTemplates();
  private activeCards = new Map<string, ActiveCardEntry>();
  private history: DialogueCard[] = [];
  private queue: DialogueCard[] = [];
  private lastGeneration = 0;
  private readonly GENERATION_INTERVAL = 30000;
  private readonly MAX_ACTIVE = 3;
  private readonly MAX_HISTORY = 40;
  private readonly snapshot: DialogueStateSnapshot = {
    active: [],
    history: [],
    queueSize: 0,
    lastGeneratedAt: 0,
  };

  constructor(
    private readonly gameState: GameState,
    private readonly needsSystem: NeedsSystem,
    private readonly socialSystem?: SocialSystem,
    private readonly questSystem?: QuestSystem,
  ) {}

  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastGeneration > this.GENERATION_INTERVAL) {
      this.generateCards(now);
      this.lastGeneration = now;
    }

    this.flushQueue(now);
    this.cleanupExpired(now);

    this.snapshot.active = Array.from(this.activeCards.values()).map(
      (entry) => entry.card,
    );
    this.snapshot.history = this.history.slice(-this.MAX_HISTORY);
    this.snapshot.queueSize = this.queue.length;
    this.snapshot.lastGeneratedAt = this.lastGeneration;

    this.gameState.dialogueState = this.snapshot;
  }

  public getSnapshot(): DialogueStateSnapshot {
    return this.snapshot;
  }

  private generateCards(now: number): void {
    const needs = this.needsSystem.getAllNeeds();
    for (const [entityId, data] of needs.entries()) {
      const matchingTemplates = this.cardTemplates.filter((template) =>
        this.matchesTemplate(template, data, now, entityId),
      );

      if (matchingTemplates.length === 0) continue;

      const scoredTemplates = matchingTemplates.map((template) => ({
        template,
        score: this.computeTemplateScore(template, data),
      }));

      scoredTemplates.sort((a, b) => b.score - a.score);

      const topCandidates = scoredTemplates.slice(0, 3);
      if (topCandidates.length === 0) continue;

      const selected =
        topCandidates[Math.floor(Math.random() * topCandidates.length)]
          .template;

      const card = this.createCard(selected, entityId, data, now);
      this.queue.push(card);
    }
  }

  private flushQueue(now: number): void {
    while (this.queue.length > 0 && this.activeCards.size < this.MAX_ACTIVE) {
      const card = this.queue.shift();
      if (!card) break;
      this.activeCards.set(card.id, { card, expiresAt: now + card.duration });

      simulationEvents.emit(GameEventNames.DIALOGUE_SHOW_CARD, {
        card,
      });

      this.history.push(card);
      if (this.history.length > this.MAX_HISTORY) {
        this.history.shift();
      }
    }
  }

  private cleanupExpired(now: number): void {
    for (const [cardId, entry] of Array.from(this.activeCards.entries())) {
      if (now >= entry.expiresAt) {
        this.activeCards.delete(cardId);
        simulationEvents.emit(GameEventNames.DIALOGUE_CARD_EXPIRED, {
          cardId,
        });
      }
    }
  }

  private matchesTemplate(
    template: CardTemplate,
    needs: EntityNeedsData,
    now: number,
    entityId?: string,
  ): boolean {
    if (template.triggers.needsBased) {
      const satisfied = template.triggers.needsBased.every((trigger) => {
        const value = needs[trigger.need];
        if (value === undefined) return false;
        return trigger.operator === "below"
          ? value <= trigger.threshold
          : value >= trigger.threshold;
      });
      if (!satisfied) return false;
    }

    if (template.triggers.timeBased) {
      const hour = new Date(now).getUTCHours();
      const timeOfDay = this.resolveTimeOfDay(hour);
      const satisfied = template.triggers.timeBased.some(
        (trigger) => trigger.time === timeOfDay,
      );
      if (!satisfied) return false;
    }

    if (template.triggers.relationshipBased && entityId && this.socialSystem) {
      const satisfied = template.triggers.relationshipBased.some((trigger) => {
        const agents = this.gameState.agents || [];
        for (const agent of agents) {
          if (agent.id === entityId) continue;

          if (trigger.withRole) {
            const roleSystem = this.gameState.roles?.assignments?.get(agent.id);
            if (!roleSystem || roleSystem.roleType !== trigger.withRole) {
              continue;
            }
          }

          const affinity =
            this.socialSystem?.getAffinityBetween(entityId, agent.id) ?? 0;
          const relationshipLevel = ((affinity + 1) / 2) * 100;

          if (relationshipLevel >= trigger.minLevel) {
            return true;
          }
        }
        return false;
      });
      if (!satisfied) return false;
    }

    return true;
  }

  private computeTemplateScore(
    template: CardTemplate,
    needs: EntityNeedsData,
  ): number {
    let score = 0.5;

    if (template.triggers.needsBased) {
      for (const trigger of template.triggers.needsBased) {
        const val = needs[trigger.need] as number;
        if (trigger.operator === "below" && val < trigger.threshold) {
          score += (trigger.threshold - val) / 100; // Higher score if far below threshold
        } else if (trigger.operator === "above" && val > trigger.threshold) {
          score += (val - trigger.threshold) / 100;
        }
      }
    }

    if (template.emotionalTone === "worried") score += 0.2;

    return score;
  }

  private resolveTimeOfDay(hour: number): "dawn" | "day" | "dusk" | "night" {
    if (hour >= 6 && hour < 10) return "dawn";
    if (hour >= 10 && hour < 18) return "day";
    if (hour >= 18 && hour < 21) return "dusk";
    return "night";
  }

  private createCard(
    template: CardTemplate,
    entityId: string,
    needs: EntityNeedsData,
    now: number,
  ): DialogueCard {
    const contentVariation =
      template.contentVariations[
        Math.floor(Math.random() * template.contentVariations.length)
      ];
    const priority = this.resolvePriority(template, needs);
    const duration = this.calculateDuration(priority);

    return {
      id: `${template.id}_${entityId}_${now}`,
      title: template.title,
      content: contentVariation.replace(/{agent}/g, entityId),
      type: template.type ?? "event",
      priority,
      participants: [entityId],
      triggerCondition: template.id,
      choices: template.choices,
      emotionalTone: template.emotionalTone,
      duration,
      timestamp: now,
    };
  }

  private calculateDuration(priority: DialoguePriority): number {
    const durations = {
      urgent: 30000,
      high: 45000,
      medium: 60000,
      low: 90000,
    } as const;
    return durations[priority];
  }

  private resolvePriority(
    template: CardTemplate,
    needs: EntityNeedsData,
  ): DialoguePriority {
    if (needs.hunger < 15 || needs.thirst < 15) return "urgent";
    if (needs.hunger < 30 || needs.thirst < 25 || needs.energy < 20)
      return "high";
    if (needs.mentalHealth < 40) return "medium";

    if (!template.triggers.needsBased) return "low";
    const maxThreshold = Math.max(
      ...template.triggers.needsBased.map((t) => t.threshold),
    );
    if (maxThreshold >= 80) return "urgent";
    if (maxThreshold >= 60) return "high";
    if (maxThreshold >= 40) return "medium";
    return "low";
  }

  private createTemplates(): CardTemplate[] {
    return [
      {
        id: "agent_exploring",
        title: "🗺️ Exploración en progreso",
        contentVariations: [
          "{agent} está explorando nuevas zonas del mundo.",
          "{agent} ha descubierto un área inexplorada.",
          "{agent} se aventura hacia territorios desconocidos.",
        ],
        triggers: {
          needsBased: [{ need: "energy", threshold: 50, operator: "above" }],
        },
        emotionalTone: "excited",
      },
      {
        id: "resource_gathering",
        title: "🌾 Recolección de recursos",
        contentVariations: [
          "{agent} está recolectando recursos para la comunidad.",
          "{agent} ha encontrado materiales útiles.",
          "{agent} trabaja en las zonas de recolección.",
        ],
        triggers: {
          needsBased: [
            { need: "hunger", threshold: 60, operator: "above" },
            { need: "energy", threshold: 40, operator: "above" },
          ],
        },
        emotionalTone: "happy",
      },
      {
        id: "low_needs_warning",
        title: "⚠️ Necesidades críticas",
        contentVariations: [
          "{agent} necesita atender urgentemente sus necesidades básicas.",
          "{agent} muestra signos de fatiga o hambre extrema.",
          "{agent} requiere descanso o alimentación pronto.",
        ],
        triggers: {
          needsBased: [{ need: "hunger", threshold: 25, operator: "below" }],
        },
        emotionalTone: "worried",
      },
      {
        id: "rest_recovery",
        title: "😴 Descanso necesario",
        contentVariations: [
          "{agent} ha decidido tomar un descanso.",
          "{agent} se dirige a una zona de descanso.",
          "{agent} recupera energías en un lugar tranquilo.",
        ],
        triggers: {
          needsBased: [{ need: "energy", threshold: 30, operator: "below" }],
        },
        emotionalTone: "contemplative",
      },
      {
        id: "day_night_change",
        title: "🌅 Cambio de ciclo",
        contentVariations: [
          "Un nuevo ciclo comienza en el mundo.",
          "El tiempo avanza y los agentes se adaptan.",
          "La comunidad continúa su desarrollo natural.",
        ],
        triggers: {
          timeBased: [{ time: "dawn", frequency: "daily" }],
        },
        emotionalTone: "contemplative",
      },
    ];
  }

  public respondToCard(cardId: string, choiceId: string): boolean {
    const entry = this.activeCards.get(cardId);
    if (!entry) return false;

    const card = entry.card;
    const choice = card.choices?.find((c) => c.id === choiceId);
    if (!choice) return false;

    this.activeCards.delete(cardId);

    simulationEvents.emit(GameEventNames.DIALOGUE_CARD_RESPONDED, {
      cardId,
      choiceId,
    });

    if (choice.effects) {
      const entityId = card.participants[0];
      if (choice.effects.needs) {
        for (const [need, value] of Object.entries(choice.effects.needs)) {
          if (typeof value === "number") {
            this.needsSystem.modifyNeed(entityId, need, value);
          }
        }
      }

      if (
        typeof choice.effects.relationship === "number" &&
        this.socialSystem
      ) {
        const relationshipDelta = choice.effects.relationship;
        for (const participantId of card.participants) {
          if (participantId === entityId) continue;
          this.socialSystem.modifyAffinity(
            entityId,
            participantId,
            relationshipDelta,
          );
        }
      }

      if (choice.effects?.unlocksMission && this.questSystem) {
        const questId = choice.effects.unlocksMission;
        if (typeof questId === "string") {
          const existingQuest = this.questSystem.getQuest(questId);
          if (!existingQuest) {
            this.questSystem.makeQuestAvailable(questId);
          } else if (
            existingQuest.status === "available" &&
            card.participants.length > 0
          ) {
          }
        }
      }
    }

    return true;
  }
}
