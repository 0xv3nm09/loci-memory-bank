import type { Entity } from '@iwsdk/core';
import type { RecallState, SavedEdge, SavedLabel } from './palace-store.js';

/** Shared palace state on world.globals — the sanctioned cross-system bus. */
export interface LociGlobals {
  noteById: Map<string, Entity>;
  requestOrganize: () => void;
  requestRecall: () => void;
  requestRewindToggle: () => void;
  requestKeyboard: (text: string, commit: (text: string) => void) => void;
  cancelAutoOrganize: () => void;
  recallActive: boolean;
  rewindActive: boolean;
  crisActive: boolean;
  recallState: RecallState;
  lastEdges: SavedEdge[];
  lastLabels: SavedLabel[];
  /** True on first launch (empty palace) — triggers discovery pulse on orbs. */
  firstLaunch: boolean;
  /** Timestamp of world creation — discovery pulse fades after ~6s. */
  birthTime: number;
}

export function createLociGlobals(): LociGlobals {
  return {
    noteById: new Map(),
    requestOrganize: () => {},
    requestRecall: () => {},
    requestRewindToggle: () => {},
    requestKeyboard: () => {},
    cancelAutoOrganize: () => {},
    recallActive: false,
    rewindActive: false,
    crisActive: false,
    recallState: {},
    lastEdges: [],
    lastLabels: [],
    firstLaunch: true,
    birthTime: performance.now() / 1000,
  };
}

export function getLoci(globals: Record<string, unknown>): LociGlobals {
  return globals['loci'] as LociGlobals;
}
