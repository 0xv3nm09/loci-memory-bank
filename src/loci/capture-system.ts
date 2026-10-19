import { createSystem, Pressed, VisibilityState } from '@iwsdk/core';
import { Vector3 } from 'three';
import { Note, SeedCard } from './components.js';
import {
  applyNoteBaseLook,
  createClusterLabel,
  createLine,
  createNote,
  createOrganizeOrb,
  createSeed,
} from './note-factory.js';
import { clusterCenter, gridHalfHeight } from './layout.js';
import { getLoci } from './globals.js';
import { primeAudioOnFirstGesture } from './audio.js';
import { checkDistress, showCrisisCard } from './distress-gate.js';
import {
  clearPalace,
  exportPalace,
  loadPalace,
  writePalaceSave,
} from './palace-store.js';

export const SEED_SETS: Record<string, string[]> = {
  exam: [
    'Review the photosynthesis equations for biology',
    'The Krebs cycle biology steps still confuse me',
    'Biology exam is at 9am in hall B',
    'Bring the calculator for the physics exam',
    'The physics formula sheet needs rewriting',
  ],
  thesis: [
    'Chapter 2 needs a stronger argument about memory',
    'The spatial memory literature review is still messy',
    'My advisor meeting about the memory chapter is Friday',
    'Rewrite the same intro paragraph again',
    'Send the draft to my advisor before the deadline',
  ],
  kingdom: [
    'The rebel queen wears a silver mask in the floating city',
    'The queen pays her magic with memories',
    'The floating city sinks a little lower every year',
    'The old king was betrayed by his cartographer',
    'The cartographer sold the eastern maps for gold',
  ],
};

const SEED_TITLES: Record<string, string> = {
  exam: 'Exam tomorrow',
  thesis: 'Thesis chaos',
  kingdom: 'A kingdom',
};

export class CaptureSystem extends createSystem({
  notes: { required: [Note] },
  seedsPressed: { required: [SeedCard, Pressed] },
}) {
  private noteCounter = 0;
  private autoOrganizeTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressExitFlush = false;

  init(): void {
    const loci = getLoci(this.globals);

    this.queries.notes.subscribe('qualify', (entity) => {
      const id = entity.getValue(Note, 'id') ?? '';
      if (id !== '') {
        loci.noteById.set(id, entity);
      }
      this.updateStatus();
    });
    this.queries.notes.subscribe('disqualify', (entity) => {
      const id = entity.getValue(Note, 'id') ?? '';
      if (id !== '' && loci.noteById.get(id) === entity) {
        loci.noteById.delete(id);
      }
      this.updateStatus();
    });

    // TODO(polish, XR framing): in the Quest view these affordances sit at
    // the bottom edge of a seated frame — consider y 1.0-1.3 and a touch
    // closer after the first real-headset check.
    createSeed(this.world, 'exam', SEED_TITLES.exam, new Vector3(-0.52, 1.22, -0.62));
    createSeed(this.world, 'thesis', SEED_TITLES.thesis, new Vector3(-0.52, 1.06, -0.72));
    createSeed(this.world, 'kingdom', SEED_TITLES.kingdom, new Vector3(-0.52, 0.9, -0.62));
    createOrganizeOrb(this.world, new Vector3(0.58, 1.0, -0.72));

    this.queries.seedsPressed.subscribe('qualify', (entity) => {
      this.dumpSeed(entity.getValue(SeedCard, 'setKey') ?? 'exam');
    });

    this.restorePalace();
    this.setupBrowserHud();
    primeAudioOnFirstGesture();

    // A thought captured but not yet organized must survive a tab close —
    // except when Clear deliberately wiped the palace.
    const flushOnExit = (): void => {
      if (!this.suppressExitFlush) {
        writePalaceSave(getLoci(this.globals));
      }
    };
    window.addEventListener('beforeunload', flushOnExit);
    this.cleanupFuncs.push(() => {
      window.removeEventListener('beforeunload', flushOnExit);
    });
  }

  /** Notes belonging to one restored cluster — for label placement. */
  private clusterNoteCounts(clusterIndex: number, saved: ReturnType<typeof loadPalace>): number {
    if (saved == null) {
      return 1;
    }
    return saved.notes.filter((note) => note.cluster === clusterIndex).length || 1;
  }

  /** Welcome back: rebuild the palace exactly as it was last saved. */
  private restorePalace(): void {
    const saved = loadPalace();
    if (saved == null || saved.notes.length === 0) {
      return;
    }
    this.noteCounter = Math.max(0, saved.nextCounter - 1);
    for (const note of saved.notes) {
      const entity = createNote(
        this.world,
        note.id,
        note.text,
        new Vector3(...note.position),
      );
      entity.setValue(Note, 'cluster', note.cluster);
      entity.setValue(Note, 'hue', note.hue);
      entity.setValue(Note, 'userPlaced', note.userPlaced);
      entity.setValue(Note, 'state', 'settled');
      applyNoteBaseLook(entity);
    }
    const loci = getLoci(this.globals);
    loci.recallState = saved.recall ?? {};
    loci.lastEdges = saved.edges;
    if (saved.clusterLabels != null && saved.clusterLabels.length > 0) {
      loci.lastLabels = saved.clusterLabels;
      for (const label of saved.clusterLabels) {
        const center = clusterCenter(label.index, saved.clusterLabels.length);
        const memberCount = this.clusterNoteCounts(label.index, saved);
        createClusterLabel(
          this.world,
          label.label,
          label.hue,
          new Vector3(
            center.x,
            center.y + gridHalfHeight(memberCount) + 0.1,
            center.z + 0.02,
          ),
          label.index,
        );
      }
    }
    saved.edges.forEach((edge, index) => {
      createLine(this.world, edge.a, edge.b, 0.4 + index * 0.12);
    });
  }

  private dumpSeed(key: string): void {
    const loci = getLoci(this.globals);
    if (loci.recallActive || loci.rewindActive) {
      return;
    }
    const thoughts = SEED_SETS[key];
    if (thoughts == null) {
      return;
    }
    for (const thought of thoughts) {
      this.spawnRaw(thought);
    }
    // TODO(polish): a manual Organize before this timer fires causes a
    // second organize 2.2s later — harmless (same layout recomputed) but
    // the timer should be cleared once a manual organize has run.
    this.scheduleAutoOrganize();
  }

  private scheduleAutoOrganize(): void {
    if (this.autoOrganizeTimer !== null) {
      clearTimeout(this.autoOrganizeTimer);
    }
    this.autoOrganizeTimer = setTimeout(() => {
      this.autoOrganizeTimer = null;
      getLoci(this.globals).requestOrganize();
    }, 2200);
  }

  private spawnRaw(text: string): void {
    const trimmed = text.trim();
    if (trimmed === '') {
      return;
    }
    // The universal gate runs before anything else sees the thought.
    if (checkDistress(trimmed).flagged) {
      showCrisisCard();
      return;
    }
    this.noteCounter += 1;
    const id = `n${this.noteCounter}`;
    const azimuth = (Math.random() - 0.5) * 1.7;
    const radius = 0.75 + Math.random() * 0.45;
    const position = new Vector3(
      Math.sin(azimuth) * radius,
      0.95 + Math.random() * 0.55,
      -Math.cos(azimuth) * radius,
    );
    createNote(this.world, id, trimmed, position);
  }

  private updateStatus(): void {
    const status = document.getElementById('hud-status');
    if (status != null) {
      const count = getLoci(this.globals).noteById.size;
      status.textContent =
        count === 0 ? 'The space is calm. Dump a thought.' : `${count} thought${count === 1 ? '' : 's'} in the void.`;
    }
  }

  private setupBrowserHud(): void {
    const hud = document.getElementById('loci-hud');
    const input = document.getElementById('note-input') as HTMLInputElement | null;
    const addBtn = document.getElementById('add-btn');
    const organizeBtn = document.getElementById('organize-btn');
    const demoBtn = document.getElementById('demo-btn');
    const recallBtn = document.getElementById('recall-btn');
    const rewindBtn = document.getElementById('rewind-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const clearBtn = document.getElementById('clear-btn');
    const exportBtn = document.getElementById('export-btn');
    const helpBtn = document.getElementById('help-btn');
    const helpOverlay = document.getElementById('loci-help');
    const helpClose = document.getElementById('help-close');
    if (hud == null || input == null) {
      return;
    }

    const add = (): void => {
      this.spawnRaw(input.value);
      input.value = '';
      input.focus();
      this.scheduleAutoOrganize();
    };
    const organize = (): void => {
      getLoci(this.globals).requestOrganize();
    };
    const demo = (): void => {
      this.dumpSeed('exam');
    };
    const recall = (): void => {
      getLoci(this.globals).requestRecall();
    };
    const rewind = (): void => {
      getLoci(this.globals).requestRewindToggle();
    };
    const setupVoice = (): void => {
      if (voiceBtn == null) {
        return;
      }
      const SR =
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      if (SR == null) {
        voiceBtn.style.display = 'none';
        return;
      }
      type Recognition = {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        start: () => void;
        stop: () => void;
        onresult:
          | ((event: {
              results: ArrayLike<{
                isFinal: boolean;
                length: number;
                [index: number]: { transcript: string };
              }>;
            }) => void)
          | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
      };
      let recognizing = false;
      let recognition: Recognition | null = null;
      const stop = (): void => {
        recognizing = false;
        voiceBtn?.classList.remove('active');
        input.placeholder = "What's on your mind?";
      };
      voiceBtn.addEventListener('click', () => {
        if (recognizing) {
          recognition?.stop();
          return;
        }
        const rec = new (SR as new () => Recognition)();
        rec.lang = 'en-US';
        rec.interimResults = true;
        rec.continuous = false;
        rec.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          const transcript = result[0]?.transcript?.trim() ?? '';
          if (result.isFinal && transcript !== '') {
            input.value = '';
            this.spawnRaw(transcript);
            this.scheduleAutoOrganize();
          } else {
            input.value = transcript;
          }
        };
        rec.onend = stop;
        rec.onerror = stop;
        try {
          rec.start();
          recognition = rec;
          recognizing = true;
          voiceBtn?.classList.add('active');
          input.placeholder = 'Listening… speak your thought';
        } catch {
          stop();
        }
      });
      this.cleanupFuncs.push(() => {
        try {
          recognition?.stop();
        } catch {
          // already stopped
        }
      });
    };
    setupVoice();
    const clear = (): void => {
      this.suppressExitFlush = true;
      clearPalace();
      location.reload();
    };
    const exportJson = (): void => {
      exportPalace();
    };
    const helpToggle = (): void => {
      if (helpOverlay != null) {
        const shown = helpOverlay.style.display === 'flex';
        helpOverlay.style.display = shown ? 'none' : 'flex';
      }
    };

    const addClick = (): void => add();
    const organizeClick = (): void => organize();
    const demoClick = (): void => demo();
    const recallClick = (): void => recall();
    const rewindClick = (): void => rewind();
    const clearClick = (): void => clear();
    const exportClick = (): void => exportJson();
    const helpClick = (): void => helpToggle();
    const helpCloseClick = (): void => helpToggle();
    const keyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        add();
      }
    };
    addBtn?.addEventListener('click', addClick);
    organizeBtn?.addEventListener('click', organizeClick);
    demoBtn?.addEventListener('click', demoClick);
    recallBtn?.addEventListener('click', recallClick);
    rewindBtn?.addEventListener('click', rewindClick);
    clearBtn?.addEventListener('click', clearClick);
    exportBtn?.addEventListener('click', exportClick);
    helpBtn?.addEventListener('click', helpClick);
    helpClose?.addEventListener('click', helpCloseClick);
    input.addEventListener('keydown', keyDown);

    this.cleanupFuncs.push(
      () => addBtn?.removeEventListener('click', addClick),
      () => organizeBtn?.removeEventListener('click', organizeClick),
      () => demoBtn?.removeEventListener('click', demoClick),
      () => recallBtn?.removeEventListener('click', recallClick),
      () => rewindBtn?.removeEventListener('click', rewindClick),
      () => clearBtn?.removeEventListener('click', clearClick),
      () => exportBtn?.removeEventListener('click', exportClick),
      () => helpBtn?.removeEventListener('click', helpClick),
      () => helpClose?.removeEventListener('click', helpCloseClick),
      () => input.removeEventListener('keydown', keyDown),
      this.world.visibilityState.subscribe((state) => {
        const immersive = state !== VisibilityState.NonImmersive;
        hud.style.display = immersive ? 'none' : 'flex';
      }),
    );

    this.updateStatus();
  }
}
