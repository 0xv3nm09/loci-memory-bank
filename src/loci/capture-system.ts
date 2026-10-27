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
import { MicOrb, TextScaleOrb, TypeOrb } from './components.js';
import { createMicOrb, createTextScaleOrb, createTypeOrb } from './note-factory.js';
import { getTextScale, setTextScale } from './text-label.js';
import { setAppStatus } from './status3d.js';
import { checkDistress } from './distress-gate.js';
import { countDue } from './palace-store.js';
import { agoLabel } from './time.js';
import { CrisisPanelSystem } from './crisis-panel.js';
import { GUIDE_STEPS } from './guide.js';
import {
  createRecognizer,
  isSpeechSupported,
  type SpeechRecognitionLike,
} from './speech.js';
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
  typePressed: { required: [TypeOrb, Pressed] },
  micPressed: { required: [MicOrb, Pressed] },
  textScalePressed: { required: [TextScaleOrb, Pressed] },
}) {
  private noteCounter = 0;
  private autoOrganizeTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressExitFlush = false;
  private toggleVoice: () => void = () => {};

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

    // Affordances sit in the suggested seated band (y 1.0-1.3); confirm on
    // a real headset before submission (TASKS.md §5 — needs a device).
    createTypeOrb(this.world, new Vector3(-0.02, 1.0, -0.72));
    createMicOrb(this.world, new Vector3(0.28, 1.0, -0.72));
    createTextScaleOrb(this.world, new Vector3(-0.32, 1.0, -0.72));
    createSeed(this.world, 'exam', SEED_TITLES.exam, new Vector3(-0.52, 1.22, -0.62));
    createSeed(this.world, 'thesis', SEED_TITLES.thesis, new Vector3(-0.52, 1.06, -0.72));
    createSeed(this.world, 'kingdom', SEED_TITLES.kingdom, new Vector3(-0.52, 0.9, -0.62));
    createOrganizeOrb(this.world, new Vector3(0.58, 1.0, -0.72));

    this.queries.seedsPressed.subscribe('qualify', (entity) => {
      this.dumpSeed(entity.getValue(SeedCard, 'setKey') ?? 'exam');
    });
    this.queries.typePressed.subscribe('qualify', () => {
      getLoci(this.globals).requestKeyboard('', (text) => {
        this.spawnRaw(text);
        this.scheduleAutoOrganize();
      });
    });
    this.queries.micPressed.subscribe('qualify', () => {
      this.toggleVoice();
    });
    this.queries.textScalePressed.subscribe('qualify', () => {
      // Cycle 100% -> 125% -> 150% -> 100%. Applies to every live label
      // immediately (scene traversal); new labels pick it up at creation.
      const steps = [1, 1.25, 1.5];
      const current = getTextScale();
      const next = steps[(steps.indexOf(current) + 1) % steps.length] ?? 1;
      setTextScale(next);
      this.world.scene.traverse((object) => {
        if (object.userData.isLociLabel === true) {
          object.scale.setScalar(next);
        }
      });
      setAppStatus(`Text size: ${Math.round(next * 100)}%.`);
    });

    getLoci(this.globals).cancelAutoOrganize = () => {
      if (this.autoOrganizeTimer !== null) {
        clearTimeout(this.autoOrganizeTimer);
        this.autoOrganizeTimer = null;
      }
    };

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

    // Best Reason to Come Back: surface retention state at re-entry — the
    // moment it matters. Nothing overwrites this until the next capture.
    const latest = saved.history?.[saved.history.length - 1];
    if (latest != null) {
      const due = countDue(
        loci.recallState,
        saved.notes.map((note) => note.id),
      );
      setAppStatus(
        `Welcome back — last here ${agoLabel(latest.at)}. ${due} thought${due === 1 ? '' : 's'} due for Recall.`,
      );
    }
  }

  private dumpSeed(key: string): void {
    const loci = getLoci(this.globals);
    if (loci.recallActive || loci.rewindActive || loci.crisActive) {
      return;
    }
    const thoughts = SEED_SETS[key];
    if (thoughts == null) {
      return;
    }
    for (const thought of thoughts) {
      this.spawnRaw(thought);
    }
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
      const crisis = this.world.getSystem(CrisisPanelSystem);
      crisis?.show();
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
    const count = getLoci(this.globals).noteById.size;
    setAppStatus(
      count === 0 ? 'The space is calm. Dump a thought.' : `${count} thought${count === 1 ? '' : 's'} in the void.`,
    );
  }

  private setupBrowserHud(): void {
    const hud = document.getElementById('loci-hud');
    const input = document.getElementById('note-input') as HTMLInputElement | null;
    const addBtn = document.getElementById('add-btn');
    const organizeBtn = document.getElementById('organize-btn');
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
    const recall = (): void => {
      getLoci(this.globals).requestRecall();
    };
    const rewind = (): void => {
      getLoci(this.globals).requestRewindToggle();
    };
    // One voice controller shared by the desktop mic button and the mic orb.
    let recognizing = false;
    let recognition: SpeechRecognitionLike | null = null;
    const stopVoice = (): void => {
      recognizing = false;
      voiceBtn?.classList.remove('active');
      input.placeholder = "What's on your mind?";
      setAppStatus('Voice paused.');
    };
    const toggleVoice = (): void => {
      if (recognizing) {
        recognition?.stop();
        return;
      }
      const rec = createRecognizer();
      if (rec == null) {
        setAppStatus('Voice capture needs a desktop browser — type instead.');
        return;
      }
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
      rec.onend = () => {
        stopVoice();
      };
      rec.onerror = () => {
        stopVoice();
      };
      try {
        rec.start();
        recognition = rec;
        recognizing = true;
        voiceBtn?.classList.add('active');
        input.placeholder = 'Listening… speak your thought';
        setAppStatus('Listening… speak your thought.');
      } catch {
        stopVoice();
      }
    };
    this.toggleVoice = toggleVoice;

    if (voiceBtn != null) {
      if (!isSpeechSupported()) {
        voiceBtn.style.display = 'none';
      } else {
        voiceBtn.addEventListener('click', toggleVoice);
        this.cleanupFuncs.push(() => {
          voiceBtn?.removeEventListener('click', toggleVoice);
        });
      }
    }
    this.cleanupFuncs.push(() => {
      try {
        recognition?.stop();
      } catch {
        // already stopped
      }
    });
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

    const helpList = document.getElementById('help-list');
    if (helpList != null) {
      helpList.innerHTML = GUIDE_STEPS.map(
        (step) => `<li><b>${step.title}</b> — ${step.body}</li>`,
      ).join('');
    }
    const helpData = document.getElementById('help-data');
    if (helpData != null) {
      const exportClick = (): void => exportPalace();
      const clearClick = (): void => {
        this.suppressExitFlush = true;
        clearPalace();
        location.reload();
      };
      const exportDataBtn = document.getElementById('data-export-btn');
      const clearDataBtn = document.getElementById('data-clear-btn');
      exportDataBtn?.addEventListener('click', exportClick);
      clearDataBtn?.addEventListener('click', clearClick);
      this.cleanupFuncs.push(
        () => exportDataBtn?.removeEventListener('click', exportClick),
        () => clearDataBtn?.removeEventListener('click', clearClick),
      );
    }

    this.updateStatus();
  }
}
