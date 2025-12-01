/**
 * Character sprite type enumerations for the frontend.
 *
 * Defines all character sprite types used in the rendering system.
 *
 * @module constants/CharacterSpriteEnums
 */

/**
 * Enumeration of character sprite types.
 * These represent the base sprite keys for character rendering.
 */
export enum CharacterSpriteType {
  MAN1 = "man1",
  MAN2 = "man2",
  MAN3 = "man3",
  MAN4 = "man4",
  WHOMEN1 = "whomen1",
  WHOMEN2 = "whomen2",
  WHOMEN3 = "whomen3",
  WHOMEN4 = "whomen4",
  ISA_SPRITESHEET = "isa_spritesheet",
  STEV_SPRITESHEET = "stev_spritesheet",
  ISA_HAPPY = "isa_happy",
  STEV_HAPPY = "stev_happy",
}

/**
 * Type representing all possible character sprite type values.
 */
export type CharacterSpriteTypeValue = `${CharacterSpriteType}`;

/**
 * Array of all character sprite types for iteration.
 */
export const ALL_CHARACTER_SPRITE_TYPES: readonly CharacterSpriteType[] =
  Object.values(CharacterSpriteType) as CharacterSpriteType[];

/**
 * Type guard to check if a string is a valid CharacterSpriteType.
 */
export function isCharacterSpriteType(
  value: string,
): value is CharacterSpriteType {
  return Object.values(CharacterSpriteType).includes(
    value as CharacterSpriteType,
  );
}
