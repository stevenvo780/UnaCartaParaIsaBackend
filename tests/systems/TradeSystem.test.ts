import { describe, it, expect, beforeEach } from "vitest";
import { TradeSystem } from "../../src/domain/simulation/systems/TradeSystem.ts";
import { createMockGameState } from "../setup.ts";
import type { GameState } from "../../src/types/game-types.ts";

describe("TradeSystem", () => {
  let gameState: GameState;
  let tradeSystem: TradeSystem;

  beforeEach(() => {
    gameState = createMockGameState();
    tradeSystem = new TradeSystem(gameState);
  });

  describe("Inicialización", () => {
    it("debe inicializar correctamente", () => {
      expect(tradeSystem).toBeDefined();
    });
  });

  describe("Creación de ofertas", () => {
    it("debe crear oferta de comercio", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      expect(offerId).toBeDefined();
    });

    it("debe retornar ofertas disponibles", () => {
      tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const offers = tradeSystem.getAvailableOffers();
      expect(offers.length).toBeGreaterThan(0);
    });

    it("debe retornar ofertas de un vendedor", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const offers = tradeSystem.getSellerOffers("seller-1");
      expect(offers.length).toBeGreaterThan(0);
    });
  });

  describe("Aceptación de ofertas", () => {
    it("debe aceptar oferta válida", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const accepted = tradeSystem.acceptOffer(offerId, "buyer-1");
      expect(accepted).toBe(true);
    });

    it("no debe aceptar oferta expirada", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }],
        1 // 1ms de duración
      );
      
      // Esperar a que expire
      setTimeout(() => {
        const accepted = tradeSystem.acceptOffer(offerId, "buyer-1");
        expect(accepted).toBe(false);
      }, 10);
    });

    it("no debe aceptar oferta del mismo vendedor", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const accepted = tradeSystem.acceptOffer(offerId, "seller-1");
      expect(accepted).toBe(false);
    });
  });

  describe("Rechazo y cancelación", () => {
    it("debe rechazar oferta", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const rejected = tradeSystem.rejectOffer(offerId, "buyer-1");
      expect(rejected).toBe(true);
    });

    it("debe cancelar oferta", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const cancelled = tradeSystem.cancelOffer(offerId, "seller-1");
      expect(cancelled).toBe(true);
    });
  });
});

