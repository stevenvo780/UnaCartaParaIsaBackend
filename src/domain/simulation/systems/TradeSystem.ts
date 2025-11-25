import { GameState } from "../../types/game-types";
import { TradeOffer, TradeRecord } from "../../types/simulation/trade";
import type { InventorySystem } from "./InventorySystem";
import { simulationEvents, GameEventNames } from "../core/events";

import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class TradeSystem {
  private gameState: GameState;
  private activeOffers = new Map<string, TradeOffer>();
  private tradeHistory: TradeRecord[] = [];
  private merchantReputation = new Map<string, number>();
  private inventorySystem?: InventorySystem;

  private readonly BACKGROUND_TRADE_INTERVAL = 30000;
  private readonly BACKGROUND_TRADE_PROBABILITY = 0.1;
  private _lastBackgroundTrade = 0;

  constructor(
    @inject(TYPES.GameState) gameState: GameState,
    @inject(TYPES.InventorySystem)
    @optional()
    inventorySystem?: InventorySystem,
  ) {
    this.gameState = gameState;
    this.inventorySystem = inventorySystem;
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
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };

    this.activeOffers.set(offerId, offer);

    simulationEvents.emit(GameEventNames.TRADE_OFFER_CREATED, {
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

    if (!offer || offer.status !== "pending") return false;
    if (Date.now() > offer.expiresAt) {
      offer.status = "expired";
      return false;
    }
    if (offer.sellerId === buyerId) return false;

    offer.buyerId = buyerId;
    offer.status = "accepted";

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

    simulationEvents.emit(GameEventNames.TRADE_COMPLETED, {
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
    if (!offer || offer.status !== "pending") return false;

    offer.status = "rejected";
    offer.buyerId = buyerId;

    simulationEvents.emit(GameEventNames.TRADE_REJECTED, {
      offerId,
      sellerId: offer.sellerId,
      buyerId,
      timestamp: Date.now(),
    });

    return true;
  }

  public cancelOffer(offerId: string, sellerId: string): boolean {
    const offer = this.activeOffers.get(offerId);
    if (!offer || offer.sellerId !== sellerId || offer.status !== "pending") {
      return false;
    }

    this.activeOffers.delete(offerId);
    return true;
  }

  public getAvailableOffers(buyerId?: string): TradeOffer[] {
    const now = Date.now();

    return Array.from(this.activeOffers.values()).filter((offer) => {
      if (offer.status !== "pending") return false;
      if (offer.expiresAt < now) {
        offer.status = "expired";
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
      if (offer.expiresAt < now && offer.status === "pending") {
        offer.status = "expired";
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

  private processBackgroundTrade(): void {
    if (!this.inventorySystem || !this.gameState.agents) return;

    const agents = this.gameState.agents.filter((a) => a.lifeStage === "adult");
    if (agents.length < 2) return;

    const resourceTypes: Array<"wood" | "stone" | "food" | "water"> = [
      "wood",
      "stone",
      "food",
      "water",
    ];

    for (const resourceType of resourceTypes) {
      const seller = agents.find((agent) => {
        const inv = this.inventorySystem!.getAgentInventory(agent.id);
        return inv && (inv[resourceType] || 0) > 20;
      });

      if (!seller) continue;

      const buyer = agents.find((agent) => {
        if (agent.id === seller.id) return false;
        const inv = this.inventorySystem!.getAgentInventory(agent.id);
        return inv && (inv[resourceType] || 0) < 5;
      });

      if (!buyer) continue;

      const tradeAmount = Math.min(
        10,
        Math.max(5, Math.floor(Math.random() * 6) + 5),
      );
      const sellerInv = this.inventorySystem.getAgentInventory(seller.id);
      const available = sellerInv?.[resourceType] || 0;

      if (available >= tradeAmount) {
        const removed = this.inventorySystem.removeFromAgent(
          seller.id,
          resourceType,
          tradeAmount,
        );

        if (removed > 0) {
          this.inventorySystem.addResource(buyer.id, resourceType, removed);

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

          simulationEvents.emit(GameEventNames.TRADE_COMPLETED, {
            offerId: `background_${Date.now()}`,
            sellerId: seller.id,
            buyerId: buyer.id,
            offering: [{ itemId: resourceType, quantity: removed }],
            requesting: { value },
            value,
            timestamp: Date.now(),
            isBackgroundTrade: true,
          });

          return;
        }
      }
    }
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
