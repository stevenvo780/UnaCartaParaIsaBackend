export const DIVINE_ENTITIES = {
  ISA: "isa" as const,
  STEV: "stev" as const,
} as const;

export const DIVINE_ENTITY_IDS = [
  DIVINE_ENTITIES.ISA,
  DIVINE_ENTITIES.STEV,
] as const;

export type DivineEntityId = (typeof DIVINE_ENTITY_IDS)[number];
export function isDivineEntity(id: string): id is DivineEntityId {
  return id === DIVINE_ENTITIES.ISA || id === DIVINE_ENTITIES.STEV;
}
export const DIVINE_PAIR = {
  FATHER: DIVINE_ENTITIES.STEV,
  MOTHER: DIVINE_ENTITIES.ISA,
} as const;
