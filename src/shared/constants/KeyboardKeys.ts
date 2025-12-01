/**
 * Enumeration of keyboard keys used throughout the application.
 * Used for input handling and keyboard event management.
 */
export enum KeyboardKey {
  W = "W",
  A = "A",
  S = "S",
  D = "D",
  ARROW_UP = "UP",
  ARROW_DOWN = "DOWN",
  ARROW_LEFT = "LEFT",
  ARROW_RIGHT = "RIGHT",
  TAB = "TAB",
  SPACE = "SPACE",
  SHIFT = "SHIFT",
  CTRL = "CTRL",
  ALT = "ALT",
  ENTER = "ENTER",
  ESC = "ESC",
  ZERO = "ZERO",
  ONE = "ONE",
  TWO = "TWO",
  THREE = "THREE",
  FOUR = "FOUR",
  FIVE = "FIVE",
  SIX = "SIX",
  SEVEN = "SEVEN",
  EIGHT = "EIGHT",
  NINE = "NINE",
  H = "H",
  I = "I",
  C = "C",
  L = "L",
  Z = "Z",
}

/**
 * Keyboard event prefixes for Phaser input system.
 */
export const KEYBOARD_EVENT_PREFIXES = {
  KEYDOWN: "keydown-",
  KEYUP: "keyup-",
} as const;

/**
 * Helper function to create a keydown event name for Phaser.
 */
export function keydownEvent(key: KeyboardKey): string {
  return `${KEYBOARD_EVENT_PREFIXES.KEYDOWN}${key}`;
}

/**
 * Helper function to create a keyup event name for Phaser.
 */
export function keyupEvent(key: KeyboardKey): string {
  return `${KEYBOARD_EVENT_PREFIXES.KEYUP}${key}`;
}
