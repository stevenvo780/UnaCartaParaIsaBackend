/**
 * Knowledge type enumerations for the simulation system.
 *
 * Defines types for knowledge nodes, edges, and categories.
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

/**
 * Enumeration of knowledge edge types.
 */
export enum KnowledgeEdgeType {
  RELATED = "related",
  PREREQUISITE = "prerequisite",
  DERIVED = "derived",
}

/**
 * Type representing all possible knowledge node type values.
 */
export type KnowledgeNodeTypeValue = `${KnowledgeNodeType}`;

/**
 * Type representing all possible knowledge edge type values.
 */
export type KnowledgeEdgeTypeValue = `${KnowledgeEdgeType}`;

/**
 * Array of all knowledge node types for iteration.
 */
export const ALL_KNOWLEDGE_NODE_TYPES: readonly KnowledgeNodeType[] =
  Object.values(KnowledgeNodeType) as KnowledgeNodeType[];

/**
 * Array of all knowledge edge types for iteration.
 */
export const ALL_KNOWLEDGE_EDGE_TYPES: readonly KnowledgeEdgeType[] =
  Object.values(KnowledgeEdgeType) as KnowledgeEdgeType[];

/**
 * Type guard to check if a string is a valid KnowledgeNodeType.
 */
export function isKnowledgeNodeType(value: string): value is KnowledgeNodeType {
  return Object.values(KnowledgeNodeType).includes(value as KnowledgeNodeType);
}

/**
 * Type guard to check if a string is a valid KnowledgeEdgeType.
 */
export function isKnowledgeEdgeType(value: string): value is KnowledgeEdgeType {
  return Object.values(KnowledgeEdgeType).includes(value as KnowledgeEdgeType);
}
