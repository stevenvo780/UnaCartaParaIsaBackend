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

/**
 * Type representing all possible knowledge node type values.
 */
export type KnowledgeNodeTypeValue = `${KnowledgeNodeType}`;

/**
 * Array of all knowledge node types for iteration.
 */
export const ALL_KNOWLEDGE_NODE_TYPES: readonly KnowledgeNodeType[] =
  Object.values(KnowledgeNodeType) as KnowledgeNodeType[];

/**
 * Type guard to check if a string is a valid KnowledgeNodeType.
 */
export function isKnowledgeNodeType(value: string): value is KnowledgeNodeType {
  return Object.values(KnowledgeNodeType).includes(value as KnowledgeNodeType);
}
