import { createSystem, Grabbed, Hovered } from '@iwsdk/core';
import { Mesh, MeshStandardMaterial, Points } from 'three';
import {
  Note,
  MicOrb,
  OrganizeOrb,
  RecallOrb,
  SeedCard,
  SnapAnimation,
  SuggestionBud,
  TextScaleOrb,
  TypeOrb,
} from './components.js';
import { createStarfield } from './note-factory.js';
import { GLASS } from './palette.js';
import { getLoci } from './globals.js';

const HOVER_SCALE = 1.04;
const GRAB_SCALE = 1.07;

/** Orb hover: slightly larger than note hover for discoverability. */
const ORB_HOVER_SCALE = 1.15;
const ORB_HOVER_GLOW_BOOST = 0.35;

/** Base glow for a note from its own state — hover/grab add on top. */
function baseGlow(entity: import('@iwsdk/core').Entity): number {
  return (entity.getValue(Note, 'cluster') ?? -1) >= 0
    ? GLASS.clusteredRimIntensity
    : GLASS.rawRimIntensity;
}

/**
 * Calm life between moments: starfield drift, raw-note sway, floating seeds
 * and orbs, hover feedback on every interactable, suggestion bud pulse.
 * Skipped during Recall (which owns the glow).
 */
export class AmbientSystem extends createSystem({
  notes: { required: [Note] },
  seeds: { required: [SeedCard] },
  organizeOrbs: { required: [OrganizeOrb] },
  recallOrbs: { required: [RecallOrb] },
  typeOrbs: { required: [TypeOrb] },
  micOrbs: { required: [MicOrb] },
  textScaleOrbs: { required: [TextScaleOrb] },
  suggestionBuds: { required: [SuggestionBud] },
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

    // ── Note hover/grab feedback ──
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

    // ── Breathing float for all affordances ──
    this.float(this.queries.seeds.entities, time, 0.007, 1.1);
    this.float(this.queries.organizeOrbs.entities, time, 0.01, 1.3);
    this.float(this.queries.recallOrbs.entities, time, 0.01, 0.9);
    this.float(this.queries.typeOrbs.entities, time, 0.008, 1.0);
    this.float(this.queries.micOrbs.entities, time, 0.008, 1.15);
    this.float(this.queries.textScaleOrbs.entities, time, 0.008, 0.85);

    // ── Seed card glow pulse ──
    for (const entity of this.queries.seeds.entities) {
      const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
      if (card != null) {
        const material = card.material as MeshStandardMaterial;
        material.emissiveIntensity = 0.3 + Math.sin(time * 1.4) * 0.12;
      }
    }

    // ── Orb hover glow feedback (Meta: clear hover state required) ──
    if (feedbackAllowed) {
      this.orbHoverFeedback(this.queries.organizeOrbs.entities, lerp);
      this.orbHoverFeedback(this.queries.recallOrbs.entities, lerp);
      this.orbHoverFeedback(this.queries.typeOrbs.entities, lerp);
      this.orbHoverFeedback(this.queries.micOrbs.entities, lerp);
      this.orbHoverFeedback(this.queries.textScaleOrbs.entities, lerp);
    }

    // ── First-launch discovery pulse — guide new users to their first orb ──
    if (loci.firstLaunch) {
      const age = time - loci.birthTime;
      if (age < 6) {
        // Pulse the type and mic orbs with a warm glow that fades over 6s.
        const fade = 1 - age / 6;
        const pulse = 0.5 * fade * (0.5 + 0.5 * Math.sin(time * 3));
        for (const entities of [this.queries.typeOrbs.entities, this.queries.micOrbs.entities]) {
          for (const entity of entities) {
            const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
            if (card != null) {
              const material = card.material as MeshStandardMaterial;
              if (card.userData.baseEmissive != null) {
                material.emissiveIntensity = (card.userData.baseEmissive as number) + pulse;
              }
            }
          }
        }
      } else {
        // After 6s, stop pulsing — user has had time to discover the orbs.
        loci.firstLaunch = false;
      }
    }

    // ── Suggestion bud pulse — draws attention to actionable suggestions ──
    for (const entity of this.queries.suggestionBuds.entities) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      const bud = object.getObjectByName('card') as Mesh | undefined;
      if (bud != null) {
        const material = bud.material as MeshStandardMaterial;
        material.emissiveIntensity = 0.65 + Math.sin(time * 2.0 + object.position.x * 5) * 0.25;
      }
      // Gentle scale breathe — more visible than just glow.
      const pulse = 1 + Math.sin(time * 1.6 + object.position.y * 8) * 0.08;
      object.scale.setScalar(pulse);

      // Show text bubble on hover.
      const hovered = entity.hasComponent(Hovered);
      const bubble = object.getObjectByName('bud-text');
      if (bubble != null) {
        bubble.visible = hovered;
      }
    }
  }

  /** Hover feedback for orbs — scale lift + glow boost per Meta guidelines. */
  private orbHoverFeedback(
    entities: Iterable<import('@iwsdk/core').Entity>,
    lerp: number,
  ): void {
    for (const entity of entities) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      const hovered = entity.hasComponent(Hovered);
      const card = object.getObjectByName('card') as Mesh | undefined;
      if (card != null) {
        const material = card.material as MeshStandardMaterial;
        // Store the base emissive on first encounter.
        if (card.userData.baseEmissive == null) {
          card.userData.baseEmissive = material.emissiveIntensity;
        }
        const baseE = card.userData.baseEmissive as number;
        const targetE = hovered ? baseE + ORB_HOVER_GLOW_BOOST : baseE;
        material.emissiveIntensity += (targetE - material.emissiveIntensity) * lerp;
      }
      // Scale lerp — operates on the orb's parent group, not conflicting with float.
      // Float adjusts .position.y; scale is independent.
      const baseScale = object.userData.baseScale ?? 1;
      const targetScale = hovered ? baseScale * ORB_HOVER_SCALE : baseScale;
      const current = object.scale.x;
      object.scale.setScalar(current + (targetScale - current) * lerp);
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
