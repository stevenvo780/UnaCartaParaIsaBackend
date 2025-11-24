import { GameState } from "../../types/game-types";
import { TradeOffer, TradeRecord } from "../../types/simulation/trade";

export class TradeSystem {
  private gameState: GameState;
  private activeOffers = new Map<string, TradeOffer>();
  private tradeHistory: TradeRecord[] = [];
  private merchantReputation = new Map<string, number>();
  private lastBackgroundTrade = 0;
  private readonly BACKGROUND_TRADE_INTERVAL = 15000;
  private readonly BACKGROUND_TRADE_PROBABILITY = 0.05;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public createOffer(
    sellerId: string,
    offering: Array<{ itemId: string; quantity: number }>,
    requesting: Array<{ itemId: string; quantity: number }> | { value: number },
    duration = 300000
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
    this.tradeHistory.push({
      sellerId: offer.sellerId,
      buyerId,
      timestamp: Date.now(),
      items: offer.offering.map((o) => o.itemId),
      value,
    });

    return true;
  }

  public rejectOffer(offerId: string, buyerId: string): boolean {
    const offer = this.activeOffers.get(offerId);
    if (!offer || offer.status !== "pending") return false;

    offer.status = "rejected";
    offer.buyerId = buyerId;
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
      (offer) => offer.sellerId === sellerId
    );
  }

  public calculateOfferValue(
    items: Array<{ itemId: string; quantity: number }>
  ): number {
    // Simplified value calculation
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
        (trade) => trade.sellerId === agentId || trade.buyerId === agentId
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
    if (Date.now() % 60000 < 100) {
      this.cleanupExpiredOffers();
    }

    // Escribir estado en GameState para sincronización con frontend
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
