import { createSystem, OneHandGrabbable, Pressed, RayInteractable, type Entity } from '@iwsdk/core';
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Note, ClusterLabel, ConnectionLine, RewindHandle, RewindNow, SnapAnimation } from './components.js';
import { applyNoteBaseLook, createLabel } from './note-factory.js';
import { getLoci } from './globals.js';
import { loadPalace, type SavedSnapshot } from './palace-store.js';
import { setAppStatus } from './status3d.js';
import { agoLabel } from './time.js';

const DIAL_POS = new Vector3(0.92, 1.12, -0.72);
const TRACK_HALF = 0.14;

/**
 * Rewind — scrub the palace through its own history with a spatial dial at
 * the void's edge: a grabbable knob on a track (drag in VR by hand, on
 * desktop by mouse). Each save is a snapshot; only what was genuinely saved
 * can ever be shown.
 */
export class RewindSystem extends createSystem({
  notes: { required: [Note] },
  lines: { required: [ConnectionLine] },
  labels: { required: [ClusterLabel] },
  handlePressed: { required: [RewindHandle, Pressed] },
  nowPressed: { required: [RewindNow, Pressed] },
}) {
  private active = false;
  private history: SavedSnapshot[] = [];
  private knob: Entity | null = null;
  private knobMesh: Mesh | null = null;
  private lastIndex = -1;

  init(): void {
    getLoci(this.globals).requestRewindToggle = () => this.toggle();
    this.buildDial();
    this.queries.handlePressed.subscribe('qualify', () => {
      if (!this.active) {
        this.toggle();
      }
    });
    this.queries.nowPressed.subscribe('qualify', () => {
      if (this.active) {
        this.exit();
      }
    });
  }

  private buildDial(): void {
    const group = new Group();
    group.name = 'rewind-dial';

    const track = new Mesh(
      new RoundedBoxGeometry(TRACK_HALF * 2 + 0.04, 0.014, 0.012, 1, 0.006),
      new MeshStandardMaterial({
        color: 0x141a2e,
        emissive: new Color(0x3a335f),
        emissiveIntensity: 0.5,
        roughness: 0.6,
      }),
    );
    group.add(track);

    const knobGroup = new Group();
    knobGroup.name = 'rewind-knob';
    const knob = new Mesh(
      new RoundedBoxGeometry(0.036, 0.036, 0.02, 1, 0.01),
      new MeshStandardMaterial({
        color: 0xcfc2ff,
        emissive: new Color(0x7a5fd0),
        emissiveIntensity: 0.8,
        roughness: 0.35,
      }),
    );
    knob.name = 'card';
    knobGroup.add(knob);
    const knobLabel = createLabel('rewind', 0.009, '#e2daff', 0.09);
    knobLabel.position.y = -0.032;
    knobGroup.add(knobLabel);
    knobGroup.position.set(DIAL_POS.x, DIAL_POS.y, DIAL_POS.z + 0.005);
    const knobEntity = this.world.createTransformEntity(knobGroup);
    knobEntity.addComponent(RewindHandle);
    knobEntity.addComponent(RayInteractable);
    knobEntity.addComponent(OneHandGrabbable, {
      translate: true,
      translateMin: [DIAL_POS.x - TRACK_HALF, DIAL_POS.y, DIAL_POS.z + 0.005],
      translateMax: [DIAL_POS.x + TRACK_HALF, DIAL_POS.y, DIAL_POS.z + 0.005],
      rotate: false,
    });
    this.knob = knobEntity;
    this.knobMesh = knob;

    const nowGroup = new Group();
    nowGroup.name = 'rewind-now-orb';
    const nowOrb = new Mesh(
      new RoundedBoxGeometry(0.06, 0.026, 0.012, 1, 0.008),
      new MeshStandardMaterial({
        color: 0x1c2745,
        emissive: new Color(0x56639a),
        emissiveIntensity: 0.5,
        roughness: 0.5,
      }),
    );
    nowOrb.name = 'card';
    nowGroup.add(nowOrb);
    const nowLabel = createLabel('now', 0.009, '#dfe6ff', 0.05);
    nowLabel.position.z = 0.008;
    nowGroup.add(nowLabel);
    nowGroup.position.set(DIAL_POS.x - TRACK_HALF - 0.09, DIAL_POS.y, DIAL_POS.z);
    const nowEntity = this.world.createTransformEntity(nowGroup);
    nowEntity.addComponent(RewindNow);
    nowEntity.addComponent(RayInteractable);
  }

  private toggle(): void {
    if (this.active) {
      this.exit();
      return;
    }
    const loci = getLoci(this.globals);
    if (loci.recallActive || loci.crisActive) {
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
    this.lastIndex = -1;

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
    this.setStatus('Rewinding — drag the knob through your palace\'s history.');
    this.applyFromKnob();
  }

  private exit(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    getLoci(this.globals).rewindActive = false;
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

  update(): void {
    if (!this.active) {
      return;
    }
    this.applyFromKnob();
  }

  /** Knob position (works for XR grab and desktop mouse-drag) → snapshot. */
  private applyFromKnob(): void {
    const x = this.knob?.object3D?.position.x ?? DIAL_POS.x;
    const fraction = Math.min(
      1,
      Math.max(0, (x - (DIAL_POS.x - TRACK_HALF)) / (TRACK_HALF * 2)),
    );
    const index = Math.round(fraction * (this.history.length - 1));
    if (index === this.lastIndex) {
      return;
    }
    this.lastIndex = index;
    this.apply(index);
  }

  private apply(index: number): void {
    const snapshot = this.history[index];
    if (snapshot == null) {
      return;
    }
    const loci = getLoci(this.globals);
    this.setStatus(`Rewinding — ${agoLabel(snapshot.at)}.`);

    for (const [id, entity] of loci.noteById) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      const saved = snapshot.notes.find((note) => note.id === id);
      if (saved == null) {
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
    setAppStatus(message);
  }
}

