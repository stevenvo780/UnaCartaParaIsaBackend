/**
 * Knowledge type enumerations for the simulation system.
 *
 * Defines types for knowledge nodes and categories.
 *
 * @module shared/constants/KnowledgeEnums
 */

/**
 * Enumeration of knowledge node types.
 */
export enum KnowledgeNodeType {
  FACT = "fact",
  RECIPE = "recipe",
  LOCATION = "location",
  PERSON = "person",
}

// Alias/lista/guard eliminados; sólo se expone el enum.
