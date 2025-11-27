import type { Item } from "../../domain/types/simulation/items";
import { ItemTier, ItemCategory } from "../../shared/constants/ItemEnums";

export class BaseMaterialsCatalog {
  private static readonly materials: Item[] = [
    {
      id: "wood_log",
      name: "Tronco de Madera",
      description: "Madera sin procesar, útil para crafteo básico",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      sprite: "assets/materials/wood_log.png",
      properties: {
        weight: 5,
        stackable: true,
        maxStack: 50,
        value: 1,
      },
    },
    {
      id: "fiber",
      name: "Fibra Vegetal",
      description: "Fibras naturales para textiles y cuerdas",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.5,
        stackable: true,
        maxStack: 100,
        value: 0.5,
      },
    },

    {
      id: "stone",
      name: "Piedra",
      description: "Piedra común para construcción",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 8,
        stackable: true,
        maxStack: 50,
        value: 1,
      },
    },
    {
      id: "iron_ore",
      name: "Mineral de Hierro",
      description: "Mineral sin procesar que contiene hierro",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 10,
        stackable: true,
        maxStack: 30,
        value: 5,
      },
    },
    {
      id: "copper_ore",
      name: "Mineral de Cobre",
      description: "Mineral sin procesar que contiene cobre",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 9,
        stackable: true,
        maxStack: 30,
        value: 4,
      },
    },
    {
      id: "clay",
      name: "Arcilla",
      description: "Arcilla húmeda para cerámica",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 3,
        stackable: true,
        maxStack: 50,
        value: 2,
      },
    },

    {
      id: "wheat",
      name: "Trigo",
      description: "Grano de trigo crudo",
      tier: ItemTier.RAW,
      category: ItemCategory.FOOD,
      properties: {
        weight: 1,
        stackable: true,
        maxStack: 100,
        perishable: true,
        spoilTime: 600000,
        value: 1,
      },
    },
    {
      id: "berries",
      name: "Bayas",
      description: "Bayas silvestres comestibles",
      tier: ItemTier.RAW,
      category: ItemCategory.FOOD,
      properties: {
        weight: 0.5,
        stackable: true,
        maxStack: 50,
        perishable: true,
        spoilTime: 180000,
        value: 1.5,
      },
    },
    {
      id: "raw_meat",
      name: "Carne Cruda",
      description: "Carne fresca sin cocinar",
      tier: ItemTier.RAW,
      category: ItemCategory.FOOD,
      properties: {
        weight: 3,
        stackable: true,
        maxStack: 20,
        perishable: true,
        spoilTime: 120000,
        value: 4,
      },
    },
    {
      id: "fish",
      name: "Pescado",
      description: "Pescado fresco sin procesar",
      tier: ItemTier.RAW,
      category: ItemCategory.FOOD,
      properties: {
        weight: 2,
        stackable: true,
        maxStack: 30,
        perishable: true,
        spoilTime: 100000,
        value: 3,
      },
    },
    {
      id: "water",
      name: "Agua",
      description: "Agua potable",
      tier: ItemTier.RAW,
      category: ItemCategory.CONSUMABLE,
      properties: {
        weight: 1,
        stackable: true,
        maxStack: 50,
        value: 0.5,
      },
    },

    {
      id: "leather_hide",
      name: "Cuero Sin Curtir",
      description: "Piel de animal sin procesar",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 4,
        stackable: true,
        maxStack: 20,
        perishable: true,
        spoilTime: 300000,
        value: 6,
      },
    },
    {
      id: "coal",
      name: "Carbón",
      description: "Combustible básico",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 2,
        stackable: true,
        maxStack: 100,
        value: 2,
      },
    },

    {
      id: "mushroom_mystical",
      name: "Champiñón Místico",
      description: "Hongo brillante con propiedades mágicas",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.5,
        stackable: true,
        maxStack: 30,
        value: 15,
      },
      metadata: { biome: "mystical" },
    },
    {
      id: "glowing_crystal",
      name: "Cristal Brillante",
      description: "Cristal que emite luz propia",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 3,
        stackable: true,
        maxStack: 20,
        value: 25,
      },
      metadata: { biome: "mystical" },
    },
    {
      id: "mystical_fiber",
      name: "Fibra Mística",
      description: "Fibra imbuida con energía mágica",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.3,
        stackable: true,
        maxStack: 50,
        value: 8,
      },
      metadata: { biome: "mystical" },
    },

    {
      id: "swamp_herb",
      name: "Hierba del Pantano",
      description: "Planta medicinal del humedal",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.5,
        stackable: true,
        maxStack: 50,
        perishable: true,
        spoilTime: 240000,
        value: 6,
      },
      metadata: { biome: "wetland" },
    },
    {
      id: "reeds",
      name: "Juncos",
      description: "Plantas acuáticas para tejer",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 1,
        stackable: true,
        maxStack: 100,
        value: 2,
      },
      metadata: { biome: "wetland" },
    },

    {
      id: "mountain_wood",
      name: "Madera de Montaña",
      description: "Madera resistente de árboles alpinos",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 6,
        stackable: true,
        maxStack: 40,
        value: 4,
      },
      metadata: { biome: "mountainous" },
    },
    {
      id: "rare_gems",
      name: "Gemas Raras",
      description: "Piedras preciosas encontradas en montañas",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 1,
        stackable: true,
        maxStack: 10,
        value: 50,
      },
      metadata: { biome: "mountainous" },
    },

    {
      id: "medicinal_herbs",
      name: "Hierbas Medicinales",
      description: "Plantas curativas del bosque",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.5,
        stackable: true,
        maxStack: 50,
        perishable: true,
        spoilTime: 300000,
        value: 7,
      },
      metadata: { biome: "forest" },
    },
    {
      id: "honey",
      name: "Miel",
      description: "Miel natural de abejas del bosque",
      tier: ItemTier.RAW,
      category: ItemCategory.FOOD,
      properties: {
        weight: 2,
        stackable: true,
        maxStack: 20,
        value: 10,
      },
      metadata: { biome: "forest" },
    },
    {
      id: "pine_resin",
      name: "Resina de Pino",
      description: "Sustancia pegajosa de los pinos",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 1,
        stackable: true,
        maxStack: 30,
        value: 5,
      },
      metadata: { biome: "forest" },
    },

    {
      id: "cotton",
      name: "Algodón",
      description: "Fibra suave de plantas de algodón",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.3,
        stackable: true,
        maxStack: 100,
        value: 3,
      },
      metadata: { biome: "grassland" },
    },
    {
      id: "wildflowers",
      name: "Flores Silvestres",
      description: "Flores coloridas de la pradera",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.2,
        stackable: true,
        maxStack: 100,
        perishable: true,
        spoilTime: 120000,
        value: 2,
      },
      metadata: { biome: "grassland" },
    },

    {
      id: "scrap_metal",
      name: "Chatarra Metálica",
      description: "Restos de metal para reciclar",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 5,
        stackable: true,
        maxStack: 30,
        value: 3,
      },
      metadata: { biome: "village" },
    },
    {
      id: "old_tools",
      name: "Herramientas Viejas",
      description: "Herramientas desgastadas que pueden repararse",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 4,
        stackable: true,
        maxStack: 10,
        value: 5,
      },
      metadata: { biome: "village" },
    },
    {
      id: "seeds",
      name: "Semillas",
      description: "Semillas para cultivar",
      tier: ItemTier.RAW,
      category: ItemCategory.MATERIAL,
      properties: {
        weight: 0.1,
        stackable: true,
        maxStack: 200,
        value: 1,
      },
      metadata: { biome: "village" },
    },
  ];

  static getAllMaterials(): Item[] {
    return [...this.materials];
  }

  static getMaterialById(id: string): Item | null {
    return this.materials.find((m) => m.id === id) || null;
  }

  static getMaterialsByCategory(category: string): Item[] {
    return this.materials.filter((m) => m.category === category);
  }
}
