import { createSystem, Grabbed, Hovered } from '@iwsdk/core';
import { Mesh, MeshStandardMaterial, Points } from 'three';
import { Note, OrganizeOrb, RecallOrb, SeedCard, SnapAnimation } from './components.js';
import { createStarfield } from './note-factory.js';
import { GLASS } from './palette.js';
import { getLoci } from './globals.js';

const HOVER_SCALE = 1.04;
const GRAB_SCALE = 1.07;

/** Base glow for a note from its own state — hover/grab add on top. */
function baseGlow(entity: import('@iwsdk/core').Entity): number {
  return (entity.getValue(Note, 'cluster') ?? -1) >= 0
    ? GLASS.clusteredRimIntensity
    : GLASS.rawRimIntensity;
}

/**
 * Calm life between moments: starfield drift, raw-note sway, floating seeds
 * and orbs, and micro-feedback — notes brighten and lift on hover, rise a
 * touch more while grabbed. Skipped during Recall (which owns the glow).
 */
export class AmbientSystem extends createSystem({
  notes: { required: [Note] },
  seeds: { required: [SeedCard] },
  organizeOrbs: { required: [OrganizeOrb] },
  recallOrbs: { required: [RecallOrb] },
}) {
  private starfield: Points | null = null;
  private restY = new Map<import('@iwsdk/core').Entity, number>();

  init(): void {
    this.starfield = createStarfield(this.world);
  }

  update(delta: number, time: number): void {
    this.starfield?.rotateY(delta * 0.006);
    const loci = getLoci(this.globals);
    const feedbackAllowed = !loci.recallActive && !loci.rewindActive;
    const lerp = Math.min(1, delta * 12);

    for (const entity of this.queries.notes.entities) {
      const object = entity.object3D;
      if (object == null || entity.hasComponent(SnapAnimation)) {
        continue;
      }
      if (feedbackAllowed) {
        const hovered = entity.hasComponent(Hovered);
        const grabbed = entity.hasComponent(Grabbed);
        const targetScale = grabbed ? GRAB_SCALE : hovered ? HOVER_SCALE : 1;
        const next = object.scale.x + (targetScale - object.scale.x) * lerp;
        object.scale.setScalar(next);

        const card = object.getObjectByName('card') as Mesh | undefined;
        if (card != null) {
          const material = card.material as MeshStandardMaterial;
          const target =
            baseGlow(entity) + (grabbed ? 0.45 : hovered ? 0.25 : 0);
          material.emissiveIntensity +=
            (target - material.emissiveIntensity) * lerp;
        }
      }

      if ((entity.getValue(Note, 'state') ?? 'raw') !== 'raw') {
        continue;
      }
      const seed = Number((entity.getValue(Note, 'id') ?? '').slice(1)) || 0;
      object.rotation.z = Math.sin(time * 0.6 + seed * 1.7) * 0.02;
    }

    this.float(this.queries.seeds.entities, time, 0.007, 1.1);
    this.float(this.queries.organizeOrbs.entities, time, 0.01, 1.3);
    this.float(this.queries.recallOrbs.entities, time, 0.01, 0.9);

    for (const entity of this.queries.seeds.entities) {
      const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
      if (card != null) {
        const material = card.material as MeshStandardMaterial;
        material.emissiveIntensity = 0.3 + Math.sin(time * 1.4) * 0.12;
      }
    }
  }

  /** Gentle breathing float for static affordances. */
  private float(
    entities: Iterable<import('@iwsdk/core').Entity>,
    time: number,
    amplitude: number,
    speed: number,
  ): void {
    for (const entity of entities) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      let rest = this.restY.get(entity);
      if (rest == null) {
        rest = object.position.y;
        this.restY.set(entity, rest);
      }
      object.position.y = rest + Math.sin(time * speed + rest * 10) * amplitude;
    }
  }
}
