import { TradeOfferStatus } from "../../../shared/constants/EconomyEnums";

export interface TradeOffer {
  id: string;
  sellerId: string;
  offering: Array<{ itemId: string; quantity: number }>;
  requesting: Array<{ itemId: string; quantity: number }> | { value: number };
  status: TradeOfferStatus;
  createdAt: number;
  expiresAt: number;
  buyerId?: string;
}

export interface TradeRecord {
  sellerId: string;
  buyerId: string;
  timestamp: number;
  items: string[];
  value: number;
}

export interface MerchantReputation {
  agentId: string;
  reputation: number;
}
