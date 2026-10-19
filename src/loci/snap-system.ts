import { createSystem, Grabbed } from '@iwsdk/core';
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { ConnectionLine, Note, SnapAnimation } from './components.js';
import { playConnectTone, playPlaceClick } from './audio.js';
import { getLoci } from './globals.js';
import { schedulePalaceSave } from './palace-store.js';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const UP = new Vector3(0, 1, 0);

/**
 * The snap: eased flights with an arc lift and scale pop, then connection
 * lines growing between the settled cards. This is the hook — keep it buttery.
 */
export class SnapSystem extends createSystem({
  flights: { required: [SnapAnimation], excluded: [Grabbed] },
  lines: { required: [ConnectionLine] },
}) {
  private direction = new Vector3();

  update(delta: number): void {
    for (const entity of Array.from(this.queries.flights.entities)) {
      const elapsed = (entity.getValue(SnapAnimation, 'elapsed') ?? 0) + delta;
      entity.setValue(SnapAnimation, 'elapsed', elapsed);

      const delay = entity.getValue(SnapAnimation, 'delay') ?? 0;
      const duration = entity.getValue(SnapAnimation, 'duration') ?? 0.65;
      const t = clamp01((elapsed - delay) / duration);
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
      object.scale.setScalar(1 + Math.sin(Math.PI * t) * 0.05);

      if (t >= 1) {
        object.scale.setScalar(1);
        if (entity.hasComponent(Note)) {
          entity.setValue(Note, 'state', 'settled');
        }
        entity.removeComponent(SnapAnimation);
      }
    }

    for (const line of Array.from(this.queries.lines.entities)) {
      const previous = line.getValue(ConnectionLine, 'elapsed') ?? 0;
      const elapsed = previous + delta;
      line.setValue(ConnectionLine, 'elapsed', elapsed);

      const delay = line.getValue(ConnectionLine, 'delay') ?? 0;
      if (elapsed < delay) {
        continue;
      }
      if (previous < delay) {
        playConnectTone();
      }

      const duration = line.getValue(ConnectionLine, 'duration') ?? 0.45;
      const t = clamp01((elapsed - delay) / duration);
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
      (mesh.material as MeshBasicMaterial).opacity = t * 0.85;
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
