import { GameState } from "../../types/game-types";
import { simulationEvents, GameEventNames } from "../core/events";

export interface InteractionConfig {
  interactionCooldownMs: number;
  maxInteractionsPerDay: number;
}

export class InteractionGameSystem {
  private activeInteractions = new Map<string, {
    participants: string[];
    type: string;
    startTime: number;
  }>();

  constructor(_gameState: GameState, _config?: Partial<InteractionConfig>) {
    // Parameters kept for API compatibility but not currently used
    void _gameState;
    void _config;
    console.log('🎲 InteractionGameSystem (Backend) initialized');
  }

  public update(_deltaTimeMs: number): void {}

  public startInteraction(initiatorId: string, targetId: string, type: string): boolean {
    const interactionId = `${initiatorId}-${targetId}-${Date.now()}`;

    this.activeInteractions.set(interactionId, {
      participants: [initiatorId, targetId],
      type,
      startTime: Date.now(),
    });

    simulationEvents.emit(GameEventNames.INTERACTION_GAME_PLAYED, {
      interactionId,
      initiatorId,
      targetId,
      type,
      result: 'started',
      timestamp: Date.now(),
    });

    console.log(`🎲 Interaction started: ${initiatorId} -> ${targetId} (${type})`);
    return true;
  }

  public resolveInteraction(interactionId: string, result: unknown): void {
    const interaction = this.activeInteractions.get(interactionId);
    if (!interaction) return;

    simulationEvents.emit(GameEventNames.INTERACTION_GAME_PLAYED, {
      interactionId,
      ...interaction,
      result,
      timestamp: Date.now(),
      status: 'completed'
    });

    this.activeInteractions.delete(interactionId);
    console.log(`🎲 Interaction resolved: ${interactionId}`);
  }
}
