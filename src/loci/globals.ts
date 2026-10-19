import type { Entity } from '@iwsdk/core';
import type { RecallState, SavedEdge, SavedLabel } from './palace-store.js';

/** Shared palace state on world.globals — the sanctioned cross-system bus. */
export interface LociGlobals {
  noteById: Map<string, Entity>;
  requestOrganize: () => void;
  requestRecall: () => void;
  requestRewindToggle: () => void;
  recallActive: boolean;
  rewindActive: boolean;
  recallState: RecallState;
  lastEdges: SavedEdge[];
  lastLabels: SavedLabel[];
}

export function createLociGlobals(): LociGlobals {
  return {
    noteById: new Map(),
    requestOrganize: () => {},
    requestRecall: () => {},
    requestRewindToggle: () => {},
    recallActive: false,
    rewindActive: false,
    recallState: {},
    lastEdges: [],
    lastLabels: [],
  };
}

export function getLoci(globals: Record<string, unknown>): LociGlobals {
  return globals['loci'] as LociGlobals;
}
