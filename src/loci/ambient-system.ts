import { createSystem, Grabbed, Hovered } from '@iwsdk/core';
import { Color, Mesh, MeshStandardMaterial, Points, PointsMaterial } from 'three';
import {
  Note,
  MicOrb,
  OrganizeOrb,
  RecallOrb,
  SeedCard,
  SnapAnimation,
  SpawnAnimation,
  SuggestionBud,
  TextScaleOrb,
  TypeOrb,
} from './components.js';
import { createStarfield } from './note-factory.js';
import { GLASS, nebulaTint } from './palette.js';
import { getLoci } from './globals.js';

const HOVER_SCALE = 1.08;
const GRAB_SCALE = 1.12;

/** Orb hover: slightly larger than note hover for discoverability. */
const ORB_HOVER_SCALE = 1.15;
const ORB_HOVER_GLOW_BOOST = 0.08;

/** Base glow for a note from its own state — hover/grab add on top. */
function baseGlow(entity: import('@iwsdk/core').Entity): number {
  return (entity.getValue(Note, 'cluster') ?? -1) >= 0
    ? GLASS.clusteredRimIntensity
    : GLASS.rawRimIntensity;
}

/**
 * Calm life between moments: nebula starfield drift, raw-note sway, floating
 * seeds and orbs, hover feedback on every interactable, suggestion bud pulse,
 * particle burst animation, and twinkling near-field stars.
 * Skipped during Recall (which owns the glow).
 */
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

export class AmbientSystem extends createSystem({
  notes: { required: [Note] },
  spawning: { required: [SpawnAnimation] },
  seeds: { required: [SeedCard] },
  organizeOrbs: { required: [OrganizeOrb] },
  recallOrbs: { required: [RecallOrb] },
  typeOrbs: { required: [TypeOrb] },
  micOrbs: { required: [MicOrb] },
  textScaleOrbs: { required: [TextScaleOrb] },
  suggestionBuds: { required: [SuggestionBud] },
}) {
  private starNear: Points | null = null;
  private starFar: Points | null = null;
  private restY = new Map<import('@iwsdk/core').Entity, number>();
  /** Tracked particle bursts for cleanup. */
  private bursts: Points[] = [];
  private nebulaColor = new Color();

  init(): void {
    const stars = createStarfield(this.world);
    this.starNear = stars.near;
    this.starFar = stars.far;
  }

  /** Register a particle burst for animated cleanup. */
  addBurst(burst: Points): void {
    this.bursts.push(burst);
  }

  update(delta: number, time: number): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) time = 0;
    // ── Nebula color cycling on starfield ──
    const tint = nebulaTint(time);
    this.nebulaColor.setRGB(tint.r, tint.g, tint.b);
    if (this.starFar != null) {
      this.starFar.rotateY(reduced ? 0 : delta * 0.006);
      // Modulate far star opacity with slow breathe
      const farMat = this.starFar.material as PointsMaterial;
      farMat.opacity = 0.35 + Math.sin(time * 0.15) * 0.08;
    }
    if (this.starNear != null) {
      this.starNear.rotateY(reduced ? 0 : delta * 0.012); // near stars drift faster
      // Twinkle: modulate near star opacity more aggressively
      const nearMat = this.starNear.material as PointsMaterial;
      nearMat.opacity = 0.55 + Math.sin(time * 0.8) * 0.12;
    }

    const loci = getLoci(this.globals);
    const feedbackAllowed = !loci.recallActive && !loci.rewindActive && !loci.crisActive && !loci.introActive;
    if (reduced) time = 0;
    const lerp = Math.min(1, delta * 12);

    // ── Particle bursts: animate and clean up ──
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      const geo = burst.geometry;
      const life = (geo.userData.lifetime as number) + delta;
      geo.userData.lifetime = life;
      const maxLife = geo.userData.maxLife as number;
      const t = Math.min(1, life / maxLife);
      const vel = geo.userData.velocities as Float32Array;
      const posAttr = geo.getAttribute('position');
      const arr = posAttr.array as Float32Array;
      const count = arr.length / 3;
      for (let j = 0; j < count; j++) {
        arr[j * 3] += vel[j * 3] * delta;
        arr[j * 3 + 1] += vel[j * 3 + 1] * delta;
        arr[j * 3 + 2] += vel[j * 3 + 2] * delta;
        // Gravity
        vel[j * 3 + 1] -= delta * 0.3;
      }
      posAttr.needsUpdate = true;
      // Fade and shrink
      const mat = burst.material as PointsMaterial;
      mat.opacity = 0.8 * (1 - t);
      mat.size = 0.014 * (1 - t * 0.5);
      if (t >= 1) {
        burst.removeFromParent();
        geo.dispose();
        mat.dispose();
        this.bursts.splice(i, 1);
      }
    }

    // ── Spawn animation: scale 0→1 + opacity 0→1 + glow bloom ──
    for (const entity of Array.from(this.queries.spawning.entities)) {
      const elapsed = (entity.getValue(SpawnAnimation, 'elapsed') ?? 0) + delta;
      entity.setValue(SpawnAnimation, 'elapsed', elapsed);
      const duration = entity.getValue(SpawnAnimation, 'duration') ?? 0.45;
      const t = reduced ? 1 : Math.min(1, elapsed / duration);
      const eased = easeOutQuart(t);
      const object = entity.object3D;
      if (object == null) {
        entity.removeComponent(SpawnAnimation);
        continue;
      }
      // Scale ramps from near-zero to 1; a slight overshoot makes it pop.
      const overshoot = t < 0.85 ? eased * 1.08 : 1 + (1 - t) * 0.08;
      object.scale.setScalar(Math.max(0.001, overshoot));

      // Card material opacity ramp.
      const card = object.getObjectByName('card') as Mesh | undefined;
      if (card != null) {
        const material = card.material as MeshStandardMaterial;
        material.transparent = true;
        material.opacity = eased;
        // Glow bloom that fades: peaks at t=0.4, settles to base.
        const bloom = Math.sin(Math.PI * t) * 0.6;
        material.emissiveIntensity = GLASS.rawRimIntensity + bloom;
      }

      if (t >= 1) {
        // Ensure final state is clean — respect the card's resting opacity.
        object.scale.setScalar(1);
        if (card != null) {
          const material = card.material as MeshStandardMaterial;
          material.opacity = 0.94;
          material.transparent = true;
          material.emissiveIntensity = GLASS.rawRimIntensity;
        }
        entity.removeComponent(SpawnAnimation);
      }
    }

    // ── Note hover/grab feedback ──
    for (const entity of this.queries.notes.entities) {
      const object = entity.object3D;
      // While spawning, the spawn loop owns scale/opacity — hover feedback
      // would lerp against the overshoot and dampen the pop.
      if (object == null || entity.hasComponent(SnapAnimation) || entity.hasComponent(SpawnAnimation)) {
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
            baseGlow(entity) + (grabbed ? 0.09 : hovered ? 0.04 : 0);
          material.emissiveIntensity +=
            (target - material.emissiveIntensity) * lerp;
        }
      }

      if ((entity.getValue(Note, 'state') ?? 'raw') !== 'raw') {
        // ── Settled note subtle breathing — they're alive, just calm ──
        // Skip breathing when hovered/grabbed so hover feedback isn't stomped.
        const isInteracted = entity.hasComponent(Hovered) || entity.hasComponent(Grabbed);
        if (!entity.hasComponent(SnapAnimation) && !entity.hasComponent(SpawnAnimation) && !isInteracted) {
          const noteId = Number((entity.getValue(Note, 'id') ?? '').slice(1)) || 0;
          const breathe = 1 + Math.sin(time * 0.5 + noteId * 2.3) * 0.012;
          object.scale.setScalar(breathe);
        }
        continue;
      }
      // ── Raw note wandering drift: lissajous-like float in the void ──
      const seed = Number((entity.getValue(Note, 'id') ?? '').slice(1)) || 0;
      if (!entity.hasComponent(SpawnAnimation)) {
        let rest = this.restY.get(entity);
        if (rest == null) {
          rest = object.position.y;
          this.restY.set(entity, rest);
        }
        // Gentle wandering — each note drifts on its own path.
        const phase = seed * 1.7;
        object.position.y = rest + Math.sin(time * 0.4 + phase) * 0.018;
        object.position.x += Math.sin(time * 0.25 + phase * 0.7) * delta * 0.003;
        object.position.z += Math.cos(time * 0.3 + phase * 1.1) * delta * 0.002;
      }
      // Gentle tilt adds to the floating feel.
      object.rotation.z = Math.sin(time * 0.6 + seed * 1.7) * 0.025;
      object.rotation.x = Math.cos(time * 0.4 + seed * 2.1) * 0.015;
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
        material.emissiveIntensity = 0.04;
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
      if (age < 8) {
        // Pulse the type and mic orbs with a warm color-cycling glow
        const fade = 1 - age / 8;
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
        // After 8s, stop pulsing — user has had time to discover the orbs.
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
      // Gentle scale breathe — subtle and ambient.
      const pulse = 1 + Math.sin(time * 1.6 + object.position.y * 8) * 0.04;
      object.scale.setScalar(pulse);

      // Show text bubble on hover.
      const hovered = entity.hasComponent(Hovered);
      const bubble = object.getObjectByName('bud-text');
      if (bubble != null) {
        bubble.visible = hovered || bubble.userData.pinned === true;
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
