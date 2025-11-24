import { EventEmitter } from 'node:events';

export const simulationEvents = new EventEmitter();

export const GameEventNames = {
  RESOURCE_GATHERED: 'RESOURCE_GATHERED',
  CHUNK_RENDERED: 'CHUNK_RENDERED', // Maybe not needed in backend, or used for chunk loading
  RESOURCE_STATE_CHANGE: 'RESOURCE_STATE_CHANGE',
  LEGEND_UPDATE: 'LEGEND_UPDATE',
  // Add others as needed
};
