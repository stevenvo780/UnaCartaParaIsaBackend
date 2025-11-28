import { GameState } from "../../types/game-types";
import { TradeOffer, TradeRecord } from "../../types/simulation/trade";
import type { InventorySystem } from "./InventorySystem";
import type { NeedsSystem } from "./NeedsSystem";
import { simulationEvents, GameEventType } from "../core/events";
import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { TradeOfferStatus } from "../../../shared/constants/EconomyEnums";
import { LifeStage } from "../../../shared/constants/AgentEnums";

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { AgentRegistry } from "../core/AgentRegistry";

@injectable()
export class TradeSystem {
  private gameState: GameState;
  private activeOffers = new Map<string, TradeOffer>();
  private tradeHistory: TradeRecord[] = [];
  private merchantReputation = new Map<string, number>();
  private inventorySystem?: InventorySystem;
  private needsSystem?: NeedsSystem;
  private agentRegistry?: AgentRegistry;

  private readonly BACKGROUND_TRADE_INTERVAL = 15000;
  private readonly BACKGROUND_TRADE_PROBABILITY = 0.3;
  private _lastBackgroundTrade = 0;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.InventorySystem)
    @optional()
    inventorySystem?: InventorySystem,
    @inject(TYPES.AgentRegistry)
    @optional()
    agentRegistry?: AgentRegistry,
  ) {
    this.gameState = gameState;
    this.inventorySystem = inventorySystem;
    this.agentRegistry = agentRegistry;
    this.setupDeathListener();
  }

  /**
   * Sets the NeedsSystem dependency for need-based trading.
   */
  public setNeedsSystem(needsSystem: NeedsSystem): void {
    this.needsSystem = needsSystem;
  }

  /**
   * Sets up listener for agent death to remove offers from dead agents.
   */
  private setupDeathListener(): void {
    simulationEvents.on(
      GameEventType.AGENT_DEATH,
      (data: { agentId?: string; entityId?: string }) => {
        const agentId = data.agentId || data.entityId;
        if (!agentId) return;
        this.removeAgentOffers(agentId);
      },
    );
  }

  /**
   * Removes all trade offers associated with a dead agent.
   */
  public removeAgentOffers(agentId: string): void {
    for (const [offerId, offer] of this.activeOffers) {
      if (offer.sellerId === agentId) {
        this.activeOffers.delete(offerId);
      }
    }
    this.merchantReputation.delete(agentId);
  }

  public setInventorySystem(inventorySystem: InventorySystem): void {
    this.inventorySystem = inventorySystem;
  }

  public createOffer(
    sellerId: string,
    offering: Array<{ itemId: string; quantity: number }>,
    requesting: Array<{ itemId: string; quantity: number }> | { value: number },
    duration = 300000,
  ): string {
    const offerId = `trade_${sellerId}_${Date.now()}`;

    const offer: TradeOffer = {
      id: offerId,
      sellerId,
      offering,
      requesting,
      status: TradeOfferStatus.PENDING,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };

    this.activeOffers.set(offerId, offer);

    simulationEvents.emit(GameEventType.TRADE_OFFER_CREATED, {
      offerId,
      sellerId,
      offering,
      requesting,
      createdAt: offer.createdAt,
      expiresAt: offer.expiresAt,
    });

    return offerId;
  }

  public acceptOffer(offerId: string, buyerId: string): boolean {
    const offer = this.activeOffers.get(offerId);

    if (!offer || offer.status !== TradeOfferStatus.PENDING) return false;
    if (Date.now() > offer.expiresAt) {
      offer.status = TradeOfferStatus.EXPIRED;
      return false;
    }
    if (offer.sellerId === buyerId) return false;

    offer.buyerId = buyerId;
    offer.status = TradeOfferStatus.ACCEPTED;

    this.updateReputation(offer.sellerId, 2);
    this.updateReputation(buyerId, 1);

    const value = this.calculateOfferValue(offer.offering);
    const tradeRecord: TradeRecord = {
      sellerId: offer.sellerId,
      buyerId,
      timestamp: Date.now(),
      items: offer.offering.map((o) => o.itemId),
      value,
    };
    this.tradeHistory.push(tradeRecord);

    simulationEvents.emit(GameEventType.TRADE_COMPLETED, {
      offerId: offer.id,
      sellerId: offer.sellerId,
      buyerId,
      offering: offer.offering,
      requesting: offer.requesting,
      value,
      timestamp: tradeRecord.timestamp,
    });

    return true;
  }

  public rejectOffer(offerId: string, buyerId: string): boolean {
    const offer = this.activeOffers.get(offerId);
    if (!offer || offer.status !== TradeOfferStatus.PENDING) return false;

    offer.status = TradeOfferStatus.REJECTED;
    offer.buyerId = buyerId;

    simulationEvents.emit(GameEventType.TRADE_REJECTED, {
      offerId,
      sellerId: offer.sellerId,
      buyerId,
      timestamp: Date.now(),
    });

    return true;
  }

  public cancelOffer(offerId: string, sellerId: string): boolean {
    const offer = this.activeOffers.get(offerId);
    if (
      !offer ||
      offer.sellerId !== sellerId ||
      offer.status !== TradeOfferStatus.PENDING
    ) {
      return false;
    }

    this.activeOffers.delete(offerId);
    return true;
  }

  public getAvailableOffers(buyerId?: string): TradeOffer[] {
    const now = Date.now();

    return Array.from(this.activeOffers.values()).filter((offer) => {
      if (offer.status !== TradeOfferStatus.PENDING) return false;
      if (offer.expiresAt < now) {
        offer.status = TradeOfferStatus.EXPIRED;
        return false;
      }
      if (buyerId && offer.sellerId === buyerId) return false;
      return true;
    });
  }

  public getSellerOffers(sellerId: string): TradeOffer[] {
    return Array.from(this.activeOffers.values()).filter(
      (offer) => offer.sellerId === sellerId,
    );
  }

  public calculateOfferValue(
    items: Array<{ itemId: string; quantity: number }>,
  ): number {
    const itemValues: Record<string, number> = {
      wood: 1,
      stone: 2,
      food: 3,
      water: 2,
      plank: 4,
      rope: 5,
    };

    let totalValue = 0;
    for (const { itemId, quantity } of items) {
      const value = itemValues[itemId] || 1;
      totalValue += value * quantity;
    }

    return totalValue;
  }

  public evaluateOfferFairness(offer: TradeOffer): {
    isFair: boolean;
    offeringValue: number;
    requestingValue: number;
    ratio: number;
  } {
    const offeringValue = this.calculateOfferValue(offer.offering);

    let requestingValue = 0;
    if (Array.isArray(offer.requesting)) {
      requestingValue = this.calculateOfferValue(offer.requesting);
    } else {
      requestingValue = offer.requesting.value;
    }

    const ratio = requestingValue / offeringValue;
    const isFair = ratio >= 0.8 && ratio <= 1.5;

    return { isFair, offeringValue, requestingValue, ratio };
  }

  public getReputation(agentId: string): number {
    return this.merchantReputation.get(agentId) || 50;
  }

  private updateReputation(agentId: string, change: number): void {
    const current = this.getReputation(agentId);
    const newReputation = Math.max(0, Math.min(100, current + change));
    this.merchantReputation.set(agentId, newReputation);
  }

  public getTradeHistory(agentId: string, limit = 10): TradeRecord[] {
    return this.tradeHistory
      .filter(
        (trade) => trade.sellerId === agentId || trade.buyerId === agentId,
      )
      .slice(-limit);
  }

  public cleanupExpiredOffers(): void {
    const now = Date.now();

    for (const [offerId, offer] of Array.from(this.activeOffers.entries())) {
      if (offer.expiresAt < now && offer.status === TradeOfferStatus.PENDING) {
        offer.status = TradeOfferStatus.EXPIRED;
        this.activeOffers.delete(offerId);
      }
    }
  }

  public update(): void {
    const now = Date.now();

    if (now % 60000 < 100) {
      this.cleanupExpiredOffers();
    }

    if (
      this.inventorySystem &&
      now - this._lastBackgroundTrade >= this.BACKGROUND_TRADE_INTERVAL
    ) {
      if (Math.random() < this.BACKGROUND_TRADE_PROBABILITY) {
        this.processBackgroundTrade();
      }
      this._lastBackgroundTrade = now;
    }

    if (!this.gameState.trade) {
      this.gameState.trade = {
        offers: [],
        history: [],
        stats: {
          activeOffers: 0,
          totalTrades: 0,
          avgTradeValue: 0,
        },
      };
    }

    this.gameState.trade.offers = Array.from(this.activeOffers.values());
    this.gameState.trade.history = this.tradeHistory;
    this.gameState.trade.stats = this.getTradeStats();
  }

  /**
   * Processes background trades based on agent NEEDS.
   * Agents with hunger/thirst will seek to buy food/water from agents with excess.
   * This creates natural economic flow based on survival needs.
   */
  private processBackgroundTrade(): void {
    if (!this.inventorySystem) return;

    if (!this.agentRegistry) return;

    const agents: Array<{ id: string; lifeStage?: string; isDead?: boolean }> =
      [];
    for (const profile of this.agentRegistry.getAllProfiles()) {
      if (profile.lifeStage === LifeStage.ADULT && !profile.isDead) {
        agents.push(profile);
      }
    }
    if (agents.length < 2) return;

    this.processNeedBasedTrades(agents, ResourceType.FOOD, "hunger", 50);
    this.processNeedBasedTrades(agents, ResourceType.WATER, "thirst", 50);

    this.processInventoryBasedTrades(agents, ResourceType.WOOD);
    this.processInventoryBasedTrades(agents, ResourceType.STONE);
  }

  /**
   * Processes trades driven by agent needs (hunger, thirst).
   * Buyers are agents with low needs AND low inventory.
   * Sellers are agents with excess inventory.
   */
  private processNeedBasedTrades(
    agents: Array<{ id: string; isDead?: boolean }>,
    resourceType: ResourceType,
    needType: "hunger" | "thirst",
    needThreshold: number,
  ): void {
    const potentialBuyers = agents.filter((agent) => {
      const inv = this.inventorySystem!.getAgentInventory(agent.id);
      const invAmount = inv ? inv[resourceType] || 0 : 0;

      if (invAmount >= 3) return false;

      if (this.needsSystem) {
        const needs = this.needsSystem.getNeeds(agent.id);
        if (needs) {
          return needs[needType] < needThreshold;
        }
      }

      return invAmount < 2;
    });

    if (potentialBuyers.length === 0) return;

    const potentialSellers = agents.filter((agent) => {
      const inv = this.inventorySystem!.getAgentInventory(agent.id);
      return inv && (inv[resourceType] || 0) > 15;
    });

    if (potentialSellers.length === 0) return;

    for (const buyer of potentialBuyers) {
      const seller = potentialSellers.find((s) => s.id !== buyer.id);
      if (!seller) continue;

      const sellerInv = this.inventorySystem!.getAgentInventory(seller.id);
      const available = sellerInv ? sellerInv[resourceType] || 0 : 0;

      let tradeAmount = 5;
      if (this.needsSystem) {
        const needs = this.needsSystem.getNeeds(buyer.id);
        if (needs && needs[needType] < 30) {
          tradeAmount = 10;
        }
      }

      tradeAmount = Math.min(tradeAmount, available - 10);
      if (tradeAmount <= 0) continue;

      const removed = this.inventorySystem!.removeFromAgent(
        seller.id,
        resourceType,
        tradeAmount,
      );

      if (removed > 0) {
        this.inventorySystem!.addResource(buyer.id, resourceType, removed);

        const value = this.calculateOfferValue([
          { itemId: resourceType, quantity: removed },
        ]);

        this.tradeHistory.push({
          sellerId: seller.id,
          buyerId: buyer.id,
          timestamp: Date.now(),
          items: [resourceType],
          value,
        });

        this.updateReputation(seller.id, 1);
        this.updateReputation(buyer.id, 0.5);

        simulationEvents.emit(GameEventType.TRADE_COMPLETED, {
          offerId: `need_trade_${Date.now()}`,
          sellerId: seller.id,
          buyerId: buyer.id,
          offering: [{ itemId: resourceType, quantity: removed }],
          requesting: { value },
          value,
          timestamp: Date.now(),
          isNeedBasedTrade: true,
          needType,
        });

        return;
      }
    }
  }

  /**
   * Processes trades based on inventory levels (non-survival resources).
   */
  private processInventoryBasedTrades(
    agents: Array<{ id: string }>,
    resourceType: ResourceType,
  ): void {
    const seller = agents.find((agent) => {
      const inv = this.inventorySystem!.getAgentInventory(agent.id);
      return inv && (inv[resourceType] || 0) > 25;
    });

    if (!seller) return;

    const buyer = agents.find((agent) => {
      if (agent.id === seller.id) return false;
      const inv = this.inventorySystem!.getAgentInventory(agent.id);
      return inv && (inv[resourceType] || 0) < 5;
    });

    if (!buyer) return;

    const tradeAmount = Math.min(8, Math.floor(Math.random() * 5) + 4);
    const sellerInv = this.inventorySystem!.getAgentInventory(seller.id);
    const available = sellerInv?.[resourceType] || 0;

    if (available >= tradeAmount + 10) {
      const removed = this.inventorySystem!.removeFromAgent(
        seller.id,
        resourceType,
        tradeAmount,
      );

      if (removed > 0) {
        this.inventorySystem!.addResource(buyer.id, resourceType, removed);

        const value = this.calculateOfferValue([
          { itemId: resourceType, quantity: removed },
        ]);

        this.tradeHistory.push({
          sellerId: seller.id,
          buyerId: buyer.id,
          timestamp: Date.now(),
          items: [resourceType],
          value,
        });

        this.updateReputation(seller.id, 1);
        this.updateReputation(buyer.id, 0.5);

        simulationEvents.emit(GameEventType.TRADE_COMPLETED, {
          offerId: `inventory_trade_${Date.now()}`,
          sellerId: seller.id,
          buyerId: buyer.id,
          offering: [{ itemId: resourceType, quantity: removed }],
          requesting: { value },
          value,
          timestamp: Date.now(),
          isBackgroundTrade: true,
        });
      }
    }
  }

  /**
   * Finds an agent willing to trade a specific resource.
   * Used by NeedsEvaluator to find trade partners.
   */
  public findAgentWithResource(
    buyerId: string,
    resourceType: ResourceType,
    minAmount: number,
  ): { agentId: string; x: number; y: number } | null {
    if (!this.inventorySystem) return null;

    if (!this.agentRegistry) return null;

    const profiles = this.agentRegistry.getAllProfiles();

    for (const agent of profiles) {
      if (agent.id === buyerId || agent.isDead) continue;

      const inv = this.inventorySystem.getAgentInventory(agent.id);
      if (!inv || (inv[resourceType] || 0) < minAmount + 5) continue;

      if (agent.position) {
        return {
          agentId: agent.id,
          x: agent.position.x,
          y: agent.position.y,
        };
      }
    }

    return null;
  }

  public getAllOffers(): TradeOffer[] {
    return Array.from(this.activeOffers.values());
  }

  public getTradeStats(): {
    activeOffers: number;
    totalTrades: number;
    avgTradeValue: number;
  } {
    const avgValue =
      this.tradeHistory.length > 0
        ? this.tradeHistory.reduce((sum, t) => sum + t.value, 0) /
          this.tradeHistory.length
        : 0;

    return {
      activeOffers: this.activeOffers.size,
      totalTrades: this.tradeHistory.length,
      avgTradeValue: avgValue,
    };
  }

  public cleanup(): void {
    this.activeOffers.clear();
    this.tradeHistory = [];
    this.merchantReputation.clear();
  }
}
