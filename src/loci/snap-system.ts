import { createSystem, Grabbed } from '@iwsdk/core';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { ConnectionLine, Note, SnapAnimation } from './components.js';
import { playConnectTone, playPlaceClick } from './audio.js';
import { getLoci } from './globals.js';
import { schedulePalaceSave } from './palace-store.js';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const UP = new Vector3(0, 1, 0);

/* ── Lightweight particle trail for snap flights ── */

const TRAIL_PARTICLES = 6;
const TRAIL_LIFE = 0.7; // seconds each particle lives

interface TrailParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface TrailCloud {
  particles: TrailParticle[];
  points: Points;
  geometry: BufferGeometry;
  material: PointsMaterial;
}

const trailClouds: TrailCloud[] = [];

function spawnTrailParticle(x: number, y: number, z: number): TrailParticle {
  return {
    x,
    y,
    z,
    vx: (Math.random() - 0.5) * 0.04,
    vy: (Math.random() - 0.3) * 0.03,
    vz: (Math.random() - 0.5) * 0.04,
    life: TRAIL_LIFE,
    maxLife: TRAIL_LIFE,
  };
}

function getOrCreateTrailCloud(scene: { add(o: Points): void }): TrailCloud {
  // Reuse a dead cloud if available.
  for (const cloud of trailClouds) {
    if (cloud.particles.length === 0) {
      return cloud;
    }
  }
  const geometry = new BufferGeometry();
  const positions = new Float32Array(TRAIL_PARTICLES * 3 * 8);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const material = new PointsMaterial({
    color: 0x8ad0ff,
    size: 0.010,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.renderOrder = 8;
  points.frustumCulled = false;
  scene.add(points);
  const cloud: TrailCloud = { particles: [], points, geometry, material };
  trailClouds.push(cloud);
  return cloud;
}

/**
 * The snap: eased flights with an arc lift and scale pop, then connection
 * lines growing between the settled cards. This is the hook — keep it buttery.
 */
export class SnapSystem extends createSystem({
  flights: { required: [SnapAnimation], excluded: [Grabbed] },
  lines: { required: [ConnectionLine] },
}) {
  private direction = new Vector3();
  private trailTimer = 0;
  private readonly _flightScratch: import('@iwsdk/core').Entity[] = [];
  private readonly _lineScratch: import('@iwsdk/core').Entity[] = [];

  update(delta: number): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // ── Update trail particles ──
    for (const cloud of trailClouds) {
      if (cloud.particles.length === 0) {
        continue;
      }
      const posAttr = cloud.geometry.getAttribute('position');
      const arr = posAttr.array as Float32Array;
      let alive = 0;
      for (let i = 0; i < cloud.particles.length; i++) {
        const p = cloud.particles[i];
        p.life -= delta;
        if (p.life <= 0) {
          continue;
        }
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        arr[alive * 3] = p.x;
        arr[alive * 3 + 1] = p.y;
        arr[alive * 3 + 2] = p.z;
        cloud.particles[alive] = p;
        alive++;
      }
      cloud.particles.length = alive;
      cloud.geometry.setDrawRange(0, alive);
      posAttr.needsUpdate = true;
      cloud.material.opacity = alive > 0 ? 0.5 : 0;
    }

    // ── Spawn trail particles from moving cards ──
    this.trailTimer += delta;
    const shouldSpawnTrail = !reduced && this.trailTimer > 0.04; // ~25fps trail spawn rate
    if (shouldSpawnTrail) {
      this.trailTimer = 0;
    }

    const flights = this._flightScratch;
    flights.length = 0;
    for (const e of this.queries.flights.entities) { flights.push(e); }
    for (const entity of flights) {
      const elapsed = (entity.getValue(SnapAnimation, 'elapsed') ?? 0) + delta;
      entity.setValue(SnapAnimation, 'elapsed', elapsed);

      const delay = entity.getValue(SnapAnimation, 'delay') ?? 0;
      const duration = entity.getValue(SnapAnimation, 'duration') ?? 0.65;
      const t = reduced ? 1 : clamp01((elapsed - delay) / duration);
      const eased = easeOutCubic(t);

      const object = entity.object3D;
      if (object == null) {
        entity.removeComponent(SnapAnimation);
        continue;
      }
      const start = entity.getVectorView(SnapAnimation, 'startPos');
      const target = entity.getVectorView(SnapAnimation, 'targetPos');
      const lift = Math.sin(Math.PI * t) * 0.045;
      object.position.set(
        start[0] + (target[0] - start[0]) * eased,
        start[1] + (target[1] - start[1]) * eased + lift,
        start[2] + (target[2] - start[2]) * eased,
      );
      object.lookAt(0, object.position.y, 0.001);
      object.scale.setScalar(1 + Math.sin(Math.PI * t) * 0.08);

      // Spawn trail dust while in flight.
      if (shouldSpawnTrail && t > 0.05 && t < 0.95) {
        const cloud = getOrCreateTrailCloud(this.world.scene);
        cloud.particles.push(
          spawnTrailParticle(object.position.x, object.position.y, object.position.z),
        );
      }

      if (t >= 1) {
        object.scale.setScalar(1);
        if (entity.hasComponent(Note)) {
          entity.setValue(Note, 'state', 'settled');
        }
        // Brief bloom flash on settle — emissive spikes then ambient-system
        // lerps it back to its base over the next few frames.
        const card = object.getObjectByName('card') as Mesh | undefined;
        if (card != null) {
          (card.material as MeshStandardMaterial).emissiveIntensity = reduced ? 0.06 : 0.12;
        }
        entity.removeComponent(SnapAnimation);
      }
    }

    const lines = this._lineScratch;
    lines.length = 0;
    for (const e of this.queries.lines.entities) { lines.push(e); }
    for (const line of lines) {
      const previous = line.getValue(ConnectionLine, 'elapsed') ?? 0;
      const elapsed = previous + delta;
      line.setValue(ConnectionLine, 'elapsed', elapsed);

      const delay = line.getValue(ConnectionLine, 'delay') ?? 0;
      if (!reduced && elapsed < delay) {
        continue;
      }
      if (previous < delay) {
        playConnectTone();
      }

      const duration = line.getValue(ConnectionLine, 'duration') ?? 0.45;
      const t = reduced ? 1 : clamp01((elapsed - delay) / duration);
      const loci = getLoci(this.globals);
      const from = loci.noteById.get(line.getValue(ConnectionLine, 'fromId') ?? '');
      const to = loci.noteById.get(line.getValue(ConnectionLine, 'toId') ?? '');
      const fromPos = from?.object3D?.position;
      const toPos = to?.object3D?.position;
      const mesh = line.object3D;
      if (fromPos == null || toPos == null || !(mesh instanceof Mesh)) {
        line.dispose();
        continue;
      }

      this.direction.subVectors(toPos, fromPos);
      const length = this.direction.length();
      if (length < 1e-4) {
        continue;
      }
      this.direction.divideScalar(length);
      mesh.position.copy(fromPos);
      mesh.quaternion.setFromUnitVectors(UP, this.direction);
      mesh.scale.set(1, Math.max(length * t, 0.0001), 1);
      (mesh.material as MeshBasicMaterial).opacity = t * 0.45;
    }
  }
}

/** Marks notes the player moved by hand — the agent never overwrites them. */
export class GrabWatchSystem extends createSystem({
  held: { required: [Note, Grabbed] },
}) {
  init(): void {
    this.queries.held.subscribe('disqualify', (entity) => {
      try {
        entity.setValue(Note, 'userPlaced', true);
        entity.setValue(Note, 'state', 'settled');
        if (entity.hasComponent(SnapAnimation)) {
          entity.removeComponent(SnapAnimation);
        }
        playPlaceClick();
        schedulePalaceSave(getLoci(this.globals));
      } catch {
        // Entity already destroyed during release.
      }
    });
  }
}
