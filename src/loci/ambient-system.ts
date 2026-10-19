import { createSystem } from '@iwsdk/core';
import { Mesh, MeshStandardMaterial, Points } from 'three';
import { Note, SeedCard } from './components.js';
import { createStarfield } from './note-factory.js';

/** Calm life between moments: starfield drift, raw-note sway, seed breathing. */
export class AmbientSystem extends createSystem({
  rawNotes: { required: [Note] },
  seeds: { required: [SeedCard] },
}) {
  private starfield: Points | null = null;

  init(): void {
    this.starfield = createStarfield(this.world);
  }

  update(delta: number, time: number): void {
    this.starfield?.rotateY(delta * 0.006);

    for (const entity of this.queries.rawNotes.entities) {
      if ((entity.getValue(Note, 'state') ?? 'raw') !== 'raw') {
        continue;
      }
      const object = entity.object3D;
      if (object == null) {
        continue;
      }
      const seed = Number((entity.getValue(Note, 'id') ?? '').slice(1)) || 0;
      object.rotation.z = Math.sin(time * 0.6 + seed * 1.7) * 0.02;
    }

    for (const entity of this.queries.seeds.entities) {
      const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
      if (card != null) {
        const material = card.material as MeshStandardMaterial;
        material.emissiveIntensity = 0.3 + Math.sin(time * 1.4) * 0.12;
      }
    }
  }
}
