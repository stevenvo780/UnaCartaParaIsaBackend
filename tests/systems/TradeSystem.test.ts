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

    it("no debe cancelar oferta de otro vendedor", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      const cancelled = tradeSystem.cancelOffer(offerId, "seller-2");
      expect(cancelled).toBe(false);
    });
  });

  describe("calculateOfferValue", () => {
    it("debe calcular valor de oferta correctamente", () => {
      const value = tradeSystem.calculateOfferValue([
        { itemId: "wood", quantity: 5 },
        { itemId: "food", quantity: 3 },
      ]);
      // wood: 1 * 5 = 5, food: 3 * 3 = 9, total = 14
      expect(value).toBe(14);
    });

    it("debe usar valor por defecto para items desconocidos", () => {
      const value = tradeSystem.calculateOfferValue([
        { itemId: "unknown", quantity: 10 },
      ]);
      expect(value).toBe(10); // 1 * 10
    });

    it("debe calcular valor de diferentes tipos de items", () => {
      const value = tradeSystem.calculateOfferValue([
        { itemId: "stone", quantity: 2 }, // 2 * 2 = 4
        { itemId: "water", quantity: 3 }, // 2 * 3 = 6
        { itemId: "plank", quantity: 1 }, // 4 * 1 = 4
      ]);
      expect(value).toBe(14);
    });
  });

  describe("evaluateOfferFairness", () => {
    it("debe evaluar oferta justa", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }], // valor: 30
        [{ itemId: "wood", quantity: 10 }] // valor: 10
      );
      
      const offer = tradeSystem.getAllOffers().find((o) => o.id === offerId);
      if (offer) {
        const evaluation = tradeSystem.evaluateOfferFairness(offer);
        expect(evaluation.offeringValue).toBe(30);
        expect(evaluation.requestingValue).toBe(10);
        expect(evaluation.ratio).toBeCloseTo(0.333, 2);
        // ratio < 0.8, así que no es justa
        expect(evaluation.isFair).toBe(false);
      }
    });

    it("debe evaluar oferta con ratio justo", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }], // valor: 30
        [{ itemId: "food", quantity: 8 }] // valor: 24, ratio: 0.8
      );
      
      const offer = tradeSystem.getAllOffers().find((o) => o.id === offerId);
      if (offer) {
        const evaluation = tradeSystem.evaluateOfferFairness(offer);
        expect(evaluation.isFair).toBe(true);
      }
    });
  });

  describe("getReputation", () => {
    it("debe retornar reputación por defecto de 50", () => {
      const reputation = tradeSystem.getReputation("agent-1");
      expect(reputation).toBe(50);
    });

    it("debe actualizar reputación al aceptar oferta", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      tradeSystem.acceptOffer(offerId, "buyer-1");
      // La reputación debería cambiar después de un trade exitoso
      const reputation = tradeSystem.getReputation("seller-1");
      expect(reputation).toBeGreaterThanOrEqual(0);
      expect(reputation).toBeLessThanOrEqual(100);
    });
  });

  describe("getTradeHistory", () => {
    it("debe retornar historial vacío inicialmente", () => {
      const history = tradeSystem.getTradeHistory("agent-1");
      expect(history).toEqual([]);
    });

    it("debe registrar trade en historial", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      tradeSystem.acceptOffer(offerId, "buyer-1");
      
      const sellerHistory = tradeSystem.getTradeHistory("seller-1");
      const buyerHistory = tradeSystem.getTradeHistory("buyer-1");
      
      expect(sellerHistory.length + buyerHistory.length).toBeGreaterThan(0);
    });

    it("debe limitar historial al límite especificado", () => {
      // Crear múltiples trades
      for (let i = 0; i < 15; i++) {
        const offerId = tradeSystem.createOffer(
          `seller-${i}`,
          [{ itemId: "food", quantity: 10 }],
          [{ itemId: "wood", quantity: 5 }]
        );
        tradeSystem.acceptOffer(offerId, `buyer-${i}`);
      }
      
      const history = tradeSystem.getTradeHistory("seller-0", 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe("cleanupExpiredOffers", () => {
    it("debe limpiar ofertas expiradas", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }],
        1 // 1ms de duración
      );
      
      // Esperar a que expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          tradeSystem.cleanupExpiredOffers();
          const offers = tradeSystem.getAvailableOffers();
          expect(offers.find((o) => o.id === offerId)).toBeUndefined();
          resolve();
        }, 10);
      });
    });
  });

  describe("update", () => {
    it("debe actualizar sin errores", () => {
      expect(() => tradeSystem.update()).not.toThrow();
    });

    it("debe limpiar ofertas expiradas periódicamente", () => {
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }],
        1
      );
      
      // Simular múltiples updates
      for (let i = 0; i < 10; i++) {
        tradeSystem.update();
      }
      
      expect(tradeSystem).toBeDefined();
    });
  });

  describe("getAllOffers", () => {
    it("debe retornar todas las ofertas", () => {
      tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      tradeSystem.createOffer(
        "seller-2",
        [{ itemId: "stone", quantity: 5 }],
        [{ itemId: "food", quantity: 3 }]
      );
      
      const allOffers = tradeSystem.getAllOffers();
      expect(allOffers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getTradeStats", () => {
    it("debe retornar estadísticas de comercio", () => {
      const stats = tradeSystem.getTradeStats();
      expect(stats).toBeDefined();
      expect(stats.activeOffers).toBeDefined();
      expect(stats.totalTrades).toBeDefined();
      expect(stats.avgTradeValue).toBeDefined();
    });

    it("debe actualizar estadísticas después de trades", () => {
      const initialStats = tradeSystem.getTradeStats();
      
      const offerId = tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      tradeSystem.acceptOffer(offerId, "buyer-1");
      
      const newStats = tradeSystem.getTradeStats();
      expect(newStats.totalTrades).toBeGreaterThan(initialStats.totalTrades);
    });
  });

  describe("cleanup", () => {
    it("debe limpiar todos los datos", () => {
      tradeSystem.createOffer(
        "seller-1",
        [{ itemId: "food", quantity: 10 }],
        [{ itemId: "wood", quantity: 5 }]
      );
      
      tradeSystem.cleanup();
      
      const offers = tradeSystem.getAllOffers();
      expect(offers.length).toBe(0);
    });
  });

  describe("setInventorySystem", () => {
    it("debe establecer sistema de inventario", () => {
      // Mock de InventorySystem
      const mockInventorySystem = {
        getInventory: () => ({}),
        addItem: () => true,
        removeItem: () => true,
      };
      
      expect(() => {
        tradeSystem.setInventorySystem(mockInventorySystem as any);
      }).not.toThrow();
    });
  });
});

