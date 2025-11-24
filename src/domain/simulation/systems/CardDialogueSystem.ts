import { GameState } from "../../types/game-types";
import { NeedsSystem } from "./NeedsSystem";
import type { NeedsState } from "../../types/simulation/needs";
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
      need: keyof NeedsState;
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

const DEFAULT_DURATION = 10000;

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
  ) { }

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
    for (const data of needs) {
      const entityId = data.entityId;
      const matchingTemplates = this.cardTemplates.filter((template) =>
        this.matchesTemplate(template, data.needs, now),
      );

      if (matchingTemplates.length === 0) continue;

      // Scoring logic restored
      const scoredTemplates = matchingTemplates.map((template) => ({
        template,
        score: this.computeTemplateScore(template, data.needs),
      }));

      scoredTemplates.sort((a, b) => b.score - a.score);

      // Pick top 1 or random from top 3
      const topCandidates = scoredTemplates.slice(0, 3);
      if (topCandidates.length === 0) continue;

      const selected =
        topCandidates[Math.floor(Math.random() * topCandidates.length)]
          .template;

      const card = this.createCard(selected, entityId, now);
      this.queue.push(card);
    }
  }

  private flushQueue(now: number): void {
    while (this.queue.length > 0 && this.activeCards.size < this.MAX_ACTIVE) {
      const card = this.queue.shift();
      if (!card) break;
      this.activeCards.set(card.id, { card, expiresAt: now + card.duration });
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
      }
    }
  }

  private matchesTemplate(
    template: CardTemplate,
    needs: NeedsState,
    now: number,
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

    // Placeholder for relationship/event triggers (requires more system access)
    if (template.triggers.relationshipBased) {
      // TODO: Check relationships
    }

    return true;
  }

  private computeTemplateScore(
    template: CardTemplate,
    needs: NeedsState,
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
    now: number,
  ): DialogueCard {
    const contentVariation =
      template.contentVariations[
      Math.floor(Math.random() * template.contentVariations.length)
      ];
    const priority = this.resolvePriority(template);

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
      duration: DEFAULT_DURATION,
      timestamp: now,
    };
  }

  private resolvePriority(template: CardTemplate, needs: NeedsState): DialoguePriority {
    // Priority based on needs severity (migrated from Frontend helpers)
    if (needs.hunger < 15 || needs.thirst < 15) return "urgent";
    if (needs.hunger < 30 || needs.thirst < 25 || needs.energy < 20) return "high";
    if (needs.mentalHealth < 40) return "medium";

    // Fallback to template-based priority
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

    // Remove card
    this.activeCards.delete(cardId);

    // Apply effects
    if (choice.effects) {
      const entityId = card.participants[0];
      if (choice.effects.needs) {
        for (const [need, value] of Object.entries(choice.effects.needs)) {
          if (typeof value === "number") {
            this.needsSystem.modifyNeed(entityId, need, value);
          }
        }
      }
      // TODO: Apply relationship effects, mission unlocks, etc.
    }

    return true;
  }
}
