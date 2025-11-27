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
} from "../../types/simulation/ambient";
import {
  DialogueCardType,
  DialoguePriority,
  DialogueTone,
} from "../../../shared/constants/AmbientEnums";
import { TimeOfDayPhase } from "../../../shared/constants/TimeEnums";
import { NeedType } from "../../../shared/constants/AIEnums";
import { ComparisonOperator } from "../../../shared/constants/ComparisonEnums";

interface EmotionalContext {
  overallMood: number;
  recentEvents: string[];
  relationshipLevel: number;
}

interface CardTemplate {
  id: string;
  title: string;
  contentVariations: string[];
  triggers: {
    needsBased?: Array<{
      need: keyof EntityNeedsData;
      threshold: number;
      operator: ComparisonOperator;
    }>;
    timeBased?: Array<{
      time: TimeOfDayPhase;
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

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { AgentRegistry } from "../core/AgentRegistry";

@injectable()
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

  private recentEvents: string[] = [];

  constructor(
    @inject(TYPES.GameState) private readonly gameState: GameState,
    @inject(TYPES.NeedsSystem) private readonly needsSystem: NeedsSystem,
    @inject(TYPES.SocialSystem)
    @optional()
    private readonly socialSystem?: SocialSystem,
    @inject(TYPES.QuestSystem)
    @optional()
    private readonly questSystem?: QuestSystem,
    @inject(TYPES.AgentRegistry)
    @optional()
    private readonly agentRegistry?: AgentRegistry,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const significantEvents = [
      GameEventNames.SOCIAL_RALLY,
      GameEventNames.COMBAT_ENGAGED,
      GameEventNames.NEED_CRITICAL,
      GameEventNames.AGENT_DEATH,
      GameEventNames.REPRODUCTION_SUCCESS,
    ];

    significantEvents.forEach((eventName) => {
      simulationEvents.on(eventName, () => {
        this.addRecentEvent(eventName);
      });
    });
  }

  private addRecentEvent(event: string): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 20) {
      this.recentEvents.shift();
    }
  }

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
      const ctx: EmotionalContext = {
        overallMood: 0.5,
        recentEvents: [...this.recentEvents],
        relationshipLevel: 0,
      };

      const matchingTemplates = this.cardTemplates.filter((template) =>
        this.matchesTemplate(template, data, now, entityId, ctx),
      );

      if (matchingTemplates.length === 0) continue;

      const scoredTemplates = matchingTemplates.map((template) => ({
        template,
        score: this.computeTemplateScore(template, data, ctx),
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
    ctx?: EmotionalContext,
  ): boolean {
    if (template.triggers.needsBased) {
      const satisfied = template.triggers.needsBased.every((trigger) => {
        const value = needs[trigger.need];
        if (value === undefined) return false;
        return trigger.operator === ComparisonOperator.BELOW
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
        const agents = this.agentRegistry
          ? Array.from(this.agentRegistry.getAllProfiles())
          : this.gameState.agents || [];
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

    if (template.triggers.eventBased && ctx) {
      const satisfied = template.triggers.eventBased.some((trigger) =>
        ctx.recentEvents.includes(trigger.event),
      );
      if (!satisfied) return false;
    }

    return true;
  }

  private computeTemplateScore(
    template: CardTemplate,
    needs: EntityNeedsData,
    ctx?: EmotionalContext,
  ): number {
    let score = 0.5;

    if (template.triggers.needsBased) {
      for (const trigger of template.triggers.needsBased) {
        const val = needs[trigger.need] as number;
        if (
          trigger.operator === ComparisonOperator.BELOW &&
          val < trigger.threshold
        ) {
          score += (trigger.threshold - val) / 100;
        } else if (
          trigger.operator === ComparisonOperator.ABOVE &&
          val > trigger.threshold
        ) {
          score += (val - trigger.threshold) / 100;
        }
      }
    }

    if (template.emotionalTone === "worried") score += 0.2;

    if (ctx && template.emotionalTone === "worried" && ctx.overallMood < 0.3) {
      score += 0.3;
    }

    return score;
  }

  private resolveTimeOfDay(hour: number): TimeOfDayPhase {
    if (hour >= 5 && hour < 7) return TimeOfDayPhase.DAWN;
    if (hour >= 7 && hour < 11) return TimeOfDayPhase.MORNING;
    if (hour >= 11 && hour < 15) return TimeOfDayPhase.MIDDAY;
    if (hour >= 15 && hour < 18) return TimeOfDayPhase.AFTERNOON;
    if (hour >= 18 && hour < 21) return TimeOfDayPhase.DUSK;
    if (hour >= 21 && hour < 23) return TimeOfDayPhase.NIGHT;
    return TimeOfDayPhase.DEEP_NIGHT;
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
      type: template.type ?? DialogueCardType.EVENT,
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
    const durations: Record<DialoguePriority, number> = {
      [DialoguePriority.URGENT]: 30000,
      [DialoguePriority.HIGH]: 45000,
      [DialoguePriority.MEDIUM]: 60000,
      [DialoguePriority.LOW]: 90000,
    };
    return durations[priority];
  }

  private resolvePriority(
    template: CardTemplate,
    needs: EntityNeedsData,
  ): DialoguePriority {
    if (needs.hunger < 15 || needs.thirst < 15) return DialoguePriority.URGENT;
    if (needs.hunger < 30 || needs.thirst < 25 || needs.energy < 20)
      return DialoguePriority.HIGH;
    if (needs.mentalHealth < 40) return DialoguePriority.MEDIUM;

    if (!template.triggers.needsBased) return DialoguePriority.LOW;
    const maxThreshold = Math.max(
      ...template.triggers.needsBased.map((t) => t.threshold),
    );
    if (maxThreshold >= 80) return DialoguePriority.URGENT;
    if (maxThreshold >= 60) return DialoguePriority.HIGH;
    if (maxThreshold >= 40) return DialoguePriority.MEDIUM;
    return DialoguePriority.LOW;
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
          needsBased: [
            {
              need: NeedType.ENERGY,
              threshold: 50,
              operator: ComparisonOperator.ABOVE,
            },
          ],
        },
        emotionalTone: DialogueTone.EXCITED,
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
            {
              need: NeedType.HUNGER,
              threshold: 60,
              operator: ComparisonOperator.ABOVE,
            },
            {
              need: NeedType.ENERGY,
              threshold: 40,
              operator: ComparisonOperator.ABOVE,
            },
          ],
        },
        emotionalTone: DialogueTone.HAPPY,
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
          needsBased: [
            {
              need: NeedType.HUNGER,
              threshold: 25,
              operator: ComparisonOperator.BELOW,
            },
          ],
        },
        emotionalTone: DialogueTone.WORRIED,
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
          needsBased: [
            {
              need: NeedType.ENERGY,
              threshold: 30,
              operator: ComparisonOperator.BELOW,
            },
          ],
        },
        emotionalTone: DialogueTone.CONTEMPLATIVE,
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
          timeBased: [{ time: TimeOfDayPhase.DAWN, frequency: "daily" }],
        },
        emotionalTone: DialogueTone.CONTEMPLATIVE,
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
          }
        }
      }
    }

    return true;
  }
}
