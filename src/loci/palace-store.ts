import type { LociGlobals } from './globals.js';
import { Note } from './components.js';
import { currentMode, palaceKey } from './modes.js';

const KEY = palaceKey(currentMode());

export interface SavedNote {
  id: string;
  text: string;
  cluster: number;
  hue: number;
  userPlaced: boolean;
  position: [number, number, number];
}

export interface SavedEdge {
  a: string;
  b: string;
}

export interface SavedLabel {
  index: number;
  label: string;
  hue: number;
}

export interface RecallRecord {
  strength: number;
  seen: number;
}

export type RecallState = Record<string, RecallRecord>;

/** Strength at/above which a note counts as remembered (tunable). */
export const RECALL_DUE_THRESHOLD = 1;

/** Notes with no recall history, or strength below the threshold, are due. */
export function countDue(
  recall: RecallState,
  noteIds: string[],
  threshold = RECALL_DUE_THRESHOLD,
): number {
  return noteIds.filter((id) => (recall[id]?.strength ?? 0) < threshold).length;
}

export interface SavedSnapshot {
  at: string;
  notes: SavedNote[];
  edges: SavedEdge[];
  clusterLabels?: SavedLabel[];
}

export interface SavedPalace {
  version: 1;
  savedAt: string;
  nextCounter: number;
  notes: SavedNote[];
  edges: SavedEdge[];
  clusterLabels?: SavedLabel[];
  recall?: RecallState;
  history?: SavedSnapshot[];
}

// Session cache — loadPalace() is called by several systems (health
// indicator every 30s, organize, recall, rewind) and parsing the full
// document each time is wasteful. Invalidated on any write, on Clear,
// and when another tab writes (the `storage` event).
let cachedDoc: SavedPalace | null | undefined; // undefined = not loaded yet

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key == null) {
      cachedDoc = undefined;
    }
  });
}

export function loadPalace(): SavedPalace | null {
  if (cachedDoc !== undefined) {
    return cachedDoc;
  }
  const raw = localStorage.getItem(KEY);
  try {
    if (raw == null) {
      cachedDoc = null;
      return null;
    }
    const data = JSON.parse(raw) as SavedPalace;
    if (data.version !== 1 || !Array.isArray(data.notes)) {
      cachedDoc = null;
      return null;
    }
    // Sanitize: clamp positions, default missing arrays, drop bad entries
    data.notes = data.notes.filter(n => n && typeof n.id === 'string' && typeof n.text === 'string');
    for (const n of data.notes) {
      if (!Array.isArray(n.position) || n.position.length !== 3 ||
          n.position.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
        n.position = [0, 1.3, -0.8];
      }
    }
    if (!Array.isArray(data.edges)) data.edges = [];
    if (!Array.isArray(data.history)) data.history = [];
    if (typeof data.recall !== 'object' || data.recall == null) data.recall = {};
    cachedDoc = data;
    return data;
  } catch (err) {
    // Corrupt blob — move aside and start fresh
    try {
      localStorage.setItem('loci.palace.corrupt', raw ?? '');
      localStorage.removeItem(KEY);
    } catch {}
    cachedDoc = null;
    return null;
  }
}

export function clearPalace(): void {
  try {
    localStorage.removeItem(KEY);
    cachedHistory = null;
    cachedDoc = null;
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
  } catch (err) {
    // nothing to clear
  }
}

export function exportPalace(): void {
  const data = loadPalace();
  if (data == null) {
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `loci-${currentMode()}-palace-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// In-memory history cache — avoids re-parsing the entire palace from
// localStorage on every save just to append one snapshot. Seeded from
// the first loadPalace() that finds existing data, then maintained here.
let cachedHistory: SavedSnapshot[] | null = null;

/** Synchronous write of the whole palace — used by the debounced save and
 * the beforeunload flush (timers don't run during unload). */
export function writePalaceSave(loci: LociGlobals): void {
  try {
    const notes: SavedNote[] = [];
    for (const [id, entity] of loci.noteById) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      notes.push({
        id,
        text: entity.getValue(Note, 'text') ?? '',
        cluster: entity.getValue(Note, 'cluster') ?? -1,
        hue: entity.getValue(Note, 'hue') ?? 0.13,
        userPlaced: entity.getValue(Note, 'userPlaced') ?? false,
        position: [object.position.x, object.position.y, object.position.z],
      });
    }
    const nextCounter = notes.reduce((max, note) => {
      const num = Number(note.id.slice(1));
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 0) + 1;
    const payload: SavedPalace = {
      version: 1,
      savedAt: new Date().toISOString(),
      nextCounter,
      notes,
      edges: loci.lastEdges,
      clusterLabels: loci.lastLabels,
      recall: loci.recallState,
    };
    // Rewind's raw material: every save appends a capped snapshot.
    // Use the in-memory cache instead of re-parsing localStorage each time.
    if (cachedHistory == null) {
      cachedHistory = loadPalace()?.history ?? [];
    }
    cachedHistory = [
      ...cachedHistory,
      {
        at: payload.savedAt,
        notes: payload.notes,
        edges: payload.edges,
        clusterLabels: payload.clusterLabels,
      },
    ].slice(-30);
    payload.history = cachedHistory;
    cachedDoc = payload;
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('[Loci] Palace save failed — browser storage full. Export your palace to avoid data loss.');
    }
    // Storage blocked or full — the palace still works in memory, it just won't persist.
  }
}

/**
 * Debounced autosave of the whole palace: notes, structure, cluster labels
 * and spaced-repetition state. `minDelayMs` lets the caller wait out the
 * snap animation so saved positions are where cards land, not where they
 * took off.
 */
export function schedulePalaceSave(loci: LociGlobals, minDelayMs = 0): void {
  // Rewind moves notes constantly — never record a scrub as history.
  if (loci.rewindActive) {
    return;
  }
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writePalaceSave(loci);
  }, Math.max(600, minDelayMs));
}
