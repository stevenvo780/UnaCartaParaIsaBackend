/**
 * Enumeration of loading states during game engine initialization.
 */
export enum LoadingState {
  INITIALIZING = "initializing",
  LOADING_DATA = "loading-data",
  READY = "ready",
}

/**
 * Type for loading state values.
 */
export type LoadingStateValue = LoadingState;
