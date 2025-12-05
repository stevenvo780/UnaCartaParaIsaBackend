/**
 * Governance type enumerations for the simulation system.
 *
 * Defines all governance-related types including demand types used in governance system.
 *
 * @module shared/constants/GovernanceEnums
 */

/**
 * Enumeration of settlement demand types.
 * Defines all possible types of demands that can be detected by the governance system.
 */
export enum DemandType {
  FOOD_SHORTAGE = "food_shortage",
  WATER_SHORTAGE = "water_shortage",
  HOUSING_FULL = "housing_full",
  DEFENSE_NEEDED = "defense_needed",
  STORAGE_NEEDED = "storage_needed",
  INFRASTRUCTURE = "infrastructure",
}

/**
 * Enumeration of governance event types.
 */
export enum GovernanceEventType {
  DEMAND_CREATED = "demand_created",
  DEMAND_RESOLVED = "demand_resolved",
  POLICY_CHANGED = "policy_changed",
  PROJECT_STARTED = "project_started",
  PROJECT_FAILED = "project_failed",
  PRODUCTION_GENERATED = "production_generated",
  PRODUCTION_WORKER_LOST = "production_worker_lost",
  ROLE_REASSIGNED = "role_reassigned",
}

/**
 * Enumeration of governance policy identifiers.
 * These IDs are used to identify specific policies in the governance system.
 */
export enum GovernancePolicyId {
  FOOD_SECURITY = "food_security",
  WATER_SUPPLY = "water_supply",
  HOUSING_EXPANSION = "housing_expansion",
}

/**
 * Enumeration of governance project types.
 * These types identify the kind of project that can be created to resolve demands.
 */
export enum GovernanceProjectType {
  BUILD_HOUSE = "build_house",
  ASSIGN_HUNTERS = "assign_hunters",
  GATHER_WATER = "gather_water",
}

// Alias/listas/guards eliminados para reducir ruido.
