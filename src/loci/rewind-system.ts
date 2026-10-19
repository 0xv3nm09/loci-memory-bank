import { createSystem, type Entity } from '@iwsdk/core';
import { Note, ConnectionLine, ClusterLabel, SnapAnimation } from './components.js';
import { applyNoteBaseLook } from './note-factory.js';
import { getLoci } from './globals.js';
import { loadPalace, type SavedSnapshot } from './palace-store.js';

function agoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * Rewind — scrub the palace through its own history. Each save is a
 * snapshot; sliding plays the diffs back with the same snap animation.
 * Only what was genuinely saved can ever be shown: the distress gate
 * guarantees flagged captures never entered a snapshot.
 */
export class RewindSystem extends createSystem({
  notes: { required: [Note] },
  lines: { required: [ConnectionLine] },
  labels: { required: [ClusterLabel] },
}) {
  private active = false;
  private history: SavedSnapshot[] = [];

  init(): void {
    getLoci(this.globals).requestRewindToggle = () => this.toggle();

    const button = document.getElementById('rewind-btn');
    const nowButton = document.getElementById('rewind-now');
    const slider = document.getElementById('rewind-slider') as HTMLInputElement | null;
    const rewindLabel = document.getElementById('rewind-when');
    button?.addEventListener('click', () => this.toggle());
    nowButton?.addEventListener('click', () => this.exit());
    slider?.addEventListener('input', () => {
      const index = parseInt(slider.value, 10);
      if (Number.isFinite(index)) {
        this.apply(index);
      }
    });
    this.cleanupFuncs.push(() => {
      button?.removeEventListener('click', () => this.toggle());
      nowButton?.removeEventListener('click', () => this.exit());
    });
  }

  private toggle(): void {
    if (this.active) {
      this.exit();
      return;
    }
    const loci = getLoci(this.globals);
    if (loci.recallActive) {
      return;
    }
    const saved = loadPalace();
    const history = saved?.history ?? [];
    if (history.length < 2) {
      this.setStatus('The palace needs a few more saves before it can rewind.');
      return;
    }
    this.history = history;
    this.active = true;
    loci.rewindActive = true;

    for (const line of this.queries.lines.entities) {
      if (line.object3D != null) {
        line.object3D.visible = false;
      }
    }
    for (const label of this.queries.labels.entities) {
      if (label.object3D != null) {
        label.object3D.visible = false;
      }
    }

    const bar = document.getElementById('rewind-bar');
    const slider = document.getElementById('rewind-slider') as HTMLInputElement | null;
    if (bar != null) {
      bar.style.display = 'flex';
    }
    if (slider != null) {
      slider.max = String(history.length - 1);
      slider.value = String(history.length - 1);
    }
    this.setStatus('Rewinding — drag the slider through your palace\'s history.');
    this.apply(history.length - 1);
  }

  private exit(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    getLoci(this.globals).rewindActive = false;
    const bar = document.getElementById('rewind-bar');
    if (bar != null) {
      bar.style.display = 'none';
    }
    // "Now" is the most recent snapshot — cards return to the last save.
    this.apply(this.history.length - 1);
    for (const line of this.queries.lines.entities) {
      if (line.object3D != null) {
        line.object3D.visible = true;
      }
    }
    for (const label of this.queries.labels.entities) {
      if (label.object3D != null) {
        label.object3D.visible = true;
      }
    }
    this.setStatus('Back to now. Your palace kept everything.');
  }

  private apply(index: number): void {
    const snapshot = this.history[index];
    if (snapshot == null) {
      return;
    }
    const loci = getLoci(this.globals);
    const rewindLabel = document.getElementById('rewind-when');
    if (rewindLabel != null) {
      rewindLabel.textContent = agoLabel(snapshot.at);
    }

    for (const [id, entity] of loci.noteById) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      const saved = snapshot.notes.find((note) => note.id === id);
      if (saved == null) {
        // This thought didn't exist yet — it stays out of the past.
        object.visible = false;
        continue;
      }
      object.visible = true;
      entity.setValue(Note, 'cluster', saved.cluster);
      entity.setValue(Note, 'hue', saved.hue);
      entity.setValue(Note, 'userPlaced', saved.userPlaced);
      entity.setValue(Note, 'state', 'settled');
      applyNoteBaseLook(entity);
      if (entity.hasComponent(SnapAnimation)) {
        entity.removeComponent(SnapAnimation);
      }
      entity.addComponent(SnapAnimation, {
        startPos: [object.position.x, object.position.y, object.position.z],
        targetPos: saved.position,
        elapsed: 0,
        duration: 0.35,
        delay: 0,
      });
    }
  }

  private setStatus(message: string): void {
    const status = document.getElementById('hud-status');
    if (status != null) {
      status.textContent = message;
    }
  }
}
