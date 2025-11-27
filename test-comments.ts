/**
 * JSDoc principal - DEBE PRESERVARSE
 * @param x numero
 * @returns resultado
 */
export function testFunction(x: number): number {
  const y = 20; // comentario inline DEBE ELIMINARSE
  const z = x + y; // otro comentario DEBE ELIMINARSE

  const url = "https://example.com"; // url comment DEBE ELIMINARSE
  const comment = "// esto NO es un comentario real";
  const regex = /test\//g; // regex DEBE ELIMINARSE
  const regex2 = /https:\/\/example\.com/; // otro DEBE ELIMINARSE

  return z; // return DEBE ELIMINARSE
}

/**
 * Otra función con JSDoc - DEBE PRESERVARSE
 */
export function otra() {
  const a = 1;
  const b = 2;
  return a + b;
}

// eslint-disable-next-line no-console
console.log("test");

// @ts-ignore
const ignored = 123;

// @ts-expect-error
const errorIgnored = 456;

// prettier-ignore
const formatted = "test";

const resultado = 42;

export interface TestInterface {
  id: number;
  name: string;
}

/**
 * Clase de prueba - DEBE PRESERVARSE
 */
export class TestClass {
  private value: number;

  /**
   * Constructor - DEBE PRESERVARSE
   * @param val valor inicial
   */
  constructor(val: number) {
    this.value = val;
  }

  /**
   * Método de prueba - DEBE PRESERVARSE
   * @returns el valor
   */
  getValue(): number {
    return this.value;
  }

  setValue(val: number): void {
    this.value = val;
  }
}

const obj = {
  prop1: "value",
  prop2: 123,
  url: "http://example.com",
  regex: /test\//g,
};

const arr = [1, 2, 3];
const str = "test // not a comment";
const template = `template // also not a comment`;

export const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
};
