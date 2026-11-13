import { createSystem, Pressed, VisibilityState } from '@iwsdk/core';
import { Vector3 } from 'three';
import { canCapture } from './interaction-state.js';
import { currentMode, MODES, parseMode } from './modes.js';
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
import { playOrbClick, playSpawnTone, primeAudioOnFirstGesture, startAmbientDrone } from './audio.js';
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
  grow: ['A short morning walk helps me reset', 'Make room for a daily walk', 'Practice one small act of kindness', 'I can try again with patience', 'Notice one thing I am grateful for'],
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
  grow: 'Small steps',
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

    // Affordances in a tight arc within ±30° of center gaze (Meta comfort
    // guideline). Primary pair centered; secondary pair flanking; seeds left.
    createTypeOrb(this.world, new Vector3(-0.20, 0.90, -0.95));
    if (isSpeechSupported()) createMicOrb(this.world, new Vector3(-0.48, 0.90, -0.95));
    createTextScaleOrb(this.world, new Vector3(0.48, 0.90, -0.95));
    createOrganizeOrb(this.world, new Vector3(0, 0.90, -0.95));
    createSeed(this.world, 'exam', SEED_TITLES.exam, new Vector3(-0.74, 1.08, -1.50));
    createSeed(this.world, 'grow', SEED_TITLES.grow, new Vector3(-0.74, .94, -1.50));
    createSeed(this.world, 'kingdom', SEED_TITLES.kingdom, new Vector3(-0.74, .80, -1.50));

    this.queries.seedsPressed.subscribe('qualify', (entity) => {
      playOrbClick();
      this.dumpSeed(entity.getValue(SeedCard, 'setKey') ?? 'exam');
    });
    this.queries.typePressed.subscribe('qualify', () => {
      if (!canCapture(getLoci(this.globals))) return;
      playOrbClick();
      getLoci(this.globals).requestKeyboard('', (text) => {
        this.spawnRaw(text);
        this.scheduleAutoOrganize();
      });
    });
    this.queries.micPressed.subscribe('qualify', () => {
      playOrbClick();
      this.toggleVoice();
    });
    this.queries.textScalePressed.subscribe('qualify', () => {
      playOrbClick();
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

    this.setupBrowserHud();
    this.restorePalace();
    const mode=currentMode();
    const input=document.getElementById('note-input') as HTMLInputElement | null;
    if (input) input.placeholder=MODES[mode].prompt;
    document.body.dataset.mode=mode;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-palace-mode]')) {
      button.setAttribute('aria-pressed',String(button.dataset.palaceMode===mode));
      const switchMode=()=>{
        const next=parseMode(button.dataset.palaceMode ?? null);
        if (next===mode || !canCapture(loci) || loci.keyboardActive) return;
        loci.cancelAutoOrganize();writePalaceSave(loci);this.suppressExitFlush=true;
        localStorage.setItem('loci.quest.mode',next);location.reload();
      };
      button.addEventListener('click',switchMode);
      this.cleanupFuncs.push(()=>button.removeEventListener('click',switchMode));
    }
    primeAudioOnFirstGesture();

    // Ambient drone fades in after first user gesture (audio context primed).
    const startDrone = (): void => { startAmbientDrone(); };
    window.addEventListener('pointerdown', startDrone, { once: true });

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
      return; // firstLaunch stays true — discovery pulse will run
    }
    getLoci(this.globals).firstLaunch = false;
    this.noteCounter = Math.max(0, saved.nextCounter - 1);
    for (const note of saved.notes) {
      const entity = createNote(
        this.world,
        note.id,
        note.text,
        new Vector3(...note.position),
        true, // skipSpawn — restored notes appear instantly
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
    if (!canCapture(loci)) {
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
    // Don't capture during quiz or timeline scrub.
    const loci = getLoci(this.globals);
    if (!canCapture(loci)) {
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
    const azimuth = (Math.random() - 0.5) * 1.4;
    const radius = 1.20 + Math.random() * 0.22;
    const position = new Vector3(
      Math.sin(azimuth) * radius,
      1.28 + Math.random() * 0.40,
      -Math.cos(azimuth) * radius,
    );
    createNote(this.world, id, trimmed, position);
    playSpawnTone();
  }

  private updateStatus(): void {
    const count = getLoci(this.globals).noteById.size;
    setAppStatus(
      count === 0 ? 'The space is calm. Drop a thought.' : `${count} thought${count === 1 ? '' : 's'} captured.`,
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
    const contrastBtn = document.getElementById('contrast-btn');
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
      if (!canCapture(getLoci(this.globals))) return;
      const rec = createRecognizer();
      if (rec == null) {
        setAppStatus('Voice capture needs a desktop browser — type instead.');
        return;
      }
      rec.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result?.[0]?.transcript?.trim() ?? '';
        if (result?.isFinal && transcript !== '') {
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
      if (!window.confirm('Clear every thought in this palace? Export a backup first if you want to keep it.')) return;
      this.suppressExitFlush = true;
      clearPalace();
      location.reload();
    };
    const exportJson = (): void => {
      exportPalace();
    };
    const toggleContrast = (): void => {
      document.body.classList.toggle('high-contrast');
      contrastBtn?.setAttribute(
        'aria-pressed',
        String(document.body.classList.contains('high-contrast')),
      );
    };
    const helpToggle = (): void => {
      getLoci(this.globals).helpActive = !getLoci(this.globals).helpActive;
      if (getLoci(this.globals).crisActive || getLoci(this.globals).introActive || getLoci(this.globals).recallActive || getLoci(this.globals).keyboardActive || getLoci(this.globals).rewindActive) { getLoci(this.globals).helpActive = false; return; }
      if (helpOverlay != null) {
        helpOverlay.classList.toggle('visible');
        helpOverlay.setAttribute('aria-hidden', String(!getLoci(this.globals).helpActive));
        if (getLoci(this.globals).helpActive) (helpOverlay.querySelector('[role=dialog]') as HTMLElement | null)?.focus({ preventScroll: true });
        else helpBtn?.focus();
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
    contrastBtn?.addEventListener('click', toggleContrast);
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
      () => contrastBtn?.removeEventListener('click', toggleContrast),
      () => helpClose?.removeEventListener('click', helpCloseClick),
      () => input.removeEventListener('keydown', keyDown),
      this.world.visibilityState.subscribe((state) => {
        const immersive = state !== VisibilityState.NonImmersive;
        hud.style.display = immersive ? 'none' : '';
        document.body.classList.toggle('immersive', immersive);
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
        if (!window.confirm('Clear every thought in this palace? Export a backup first if you want to keep it.')) return;
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
