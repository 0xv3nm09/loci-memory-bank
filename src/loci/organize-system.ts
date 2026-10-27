import { createSystem, Pressed, type Entity } from '@iwsdk/core';
import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  ClusterLabel,
  ConnectionLine,
  Note,
  OrganizeOrb,
  SnapAnimation,
  SuggestionBud,
} from './components.js';
import { organize, type OrganizeResult } from './clusterer.js';
import type { NoteInput } from './model-client.js';
import { organizeWithModel } from './model-client.js';
import { setAppStatus } from './status3d.js';
import { CLUSTER_HUES, clusterCenter, gridHalfHeight, noteOffset } from './layout.js';
import { createClusterLabel, createLine, createSuggestionBud, setNoteTint } from './note-factory.js';
import { playSnapChord } from './audio.js';
import { getLoci } from './globals.js';
import { schedulePalaceSave } from './palace-store.js';

export class OrganizeSystem extends createSystem({
  notes: { required: [Note] },
  lines: { required: [ConnectionLine] },
  labels: { required: [ClusterLabel] },
  buds: { required: [SuggestionBud] },
  budsPressed: { required: [SuggestionBud, Pressed] },
  orbPressed: { required: [OrganizeOrb, Pressed] },
  orbs: { required: [OrganizeOrb] },
}) {
  private trash: Entity[] = [];
  private thinking = false;

  init(): void {
    getLoci(this.globals).requestOrganize = () => this.organize();
    this.queries.orbPressed.subscribe('qualify', () => this.organize());
    this.queries.budsPressed.subscribe('qualify', (entity) => {
      const bubble = entity.object3D?.getObjectByName('bud-text');
      if (bubble != null) {
        bubble.visible = !bubble.visible;
      }
    });
  }

  update(): void {
    // Deferred disposal — destroying entities during an input callback
    // mutates the query the input system is iterating, so they're parked
    // here and reaped on the next tick.
    if (this.trash.length === 0) {
      return;
    }
    const doomed = this.trash;
    this.trash = [];
    for (const entity of doomed) {
      try {
        entity.object3D?.removeFromParent();
      } catch {
        // already detached
      }
      try {
        entity.dispose();
      } catch {
        // already destroyed
      }
    }
  }

  private organize(): void {
    const loci = getLoci(this.globals);
    if (loci.recallActive || this.thinking || loci.rewindActive || loci.crisActive) {
      return;
    }
    // A deliberate organize supersedes any pending auto-organize timer.
    loci.cancelAutoOrganize();
    const movable = Array.from(this.queries.notes.entities).filter(
      (entity) => !entity.getValue(Note, 'userPlaced'),
    );
    if (movable.length === 0) {
      return;
    }

    const inputs: NoteInput[] = movable.map((entity) => ({
      id: entity.getValue(Note, 'id') ?? '',
      text: entity.getValue(Note, 'text') ?? '',
    }));

    // The heuristic result exists before the question is even asked — if the
    // model is slow, down, or wrong, the snap still happens this session.
    const fallback = organize(inputs);
    this.thinking = true;
    this.setStatus('Sage is reading your thoughts…');

    void this.applyBest(fallback, inputs);
  }

  private async applyBest(fallback: OrganizeResult, inputs: NoteInput[]): Promise<void> {
    let result = fallback;
    let source = 'local';
    try {
      const model = await organizeWithModel(inputs);
      const covered = model.clusters.reduce((sum, cluster) => sum + cluster.noteIds.length, 0);
      if (covered >= Math.ceil(inputs.length * 0.6)) {
        result = model;
        source = 'Sage';
      }
    } catch {
      // model down, slow, or unusable — the heuristic stands
    }
    this.thinking = false;
    this.setStatus(
      source === 'Sage'
        ? 'Sage organized your thoughts.'
        : 'Sage couldn\'t reach the model — organized locally instead.',
    );
    // Persistent who-did-this indicator: the orb stays gold after a real
    // model organize, gray after the local fallback — visible at a glance
    // which intelligence shaped the current layout.
    this.tintOrb(source === 'Sage' ? 0xe8b34b : 0x8a93a8, source === 'Sage' ? 1.15 : 0.5);
    this.applyResult(result);
  }

  private tintOrb(color: number, intensity: number): void {
    const orb = this.queries.orbs.entities.values().next().value;
    const card = orb?.object3D?.getObjectByName('card');
    if (card == null) {
      return;
    }
    const material = (card as Mesh).material as MeshStandardMaterial;
    material.emissive.set(color);
    material.emissiveIntensity = intensity;
    material.color.set(color);
  }

  private setStatus(message: string): void {
    setAppStatus(message);
  }

  private applyResult(result: OrganizeResult): void {
    const loci = getLoci(this.globals);
    for (const line of Array.from(this.queries.lines.entities)) {
      this.trash.push(line);
    }
    for (const label of Array.from(this.queries.labels.entities)) {
      this.trash.push(label);
    }
    for (const bud of Array.from(this.queries.buds.entities)) {
      this.trash.push(bud);
    }

    let flightIndex = 0;
    let maxDelay = 0;
    result.clusters.forEach((cluster, clusterIndex) => {
      const center = clusterCenter(clusterIndex, result.clusters.length);
      const hue = CLUSTER_HUES[clusterIndex % CLUSTER_HUES.length];

      cluster.noteIds.forEach((id, index) => {
        const entity = loci.noteById.get(id);
        const object = entity?.object3D;
        if (entity == null || object == null) {
          return;
        }
        const offset = noteOffset(index, cluster.noteIds.length);
        const target = new Vector3(
          center.x + offset.x,
          center.y + offset.y,
          center.z + offset.z,
        );
        const start = object.position;
        const delay = flightIndex * 0.045;
        maxDelay = Math.max(maxDelay, delay);
        flightIndex += 1;

        entity.setValue(Note, 'cluster', clusterIndex);
        entity.setValue(Note, 'hue', hue);
        entity.setValue(Note, 'state', 'snapping');
        if (entity.hasComponent(SnapAnimation)) {
          entity.removeComponent(SnapAnimation);
        }
        entity.addComponent(SnapAnimation, {
          startPos: [start.x, start.y, start.z],
          targetPos: [target.x, target.y, target.z],
          elapsed: 0,
          duration: 0.65,
          delay,
        });
        setNoteTint(entity, hue, 0.45);
      });

      createClusterLabel(
        this.world,
        cluster.label,
        hue,
        new Vector3(center.x, center.y + gridHalfHeight(cluster.noteIds.length) + 0.1, center.z + 0.02),
        clusterIndex,
      );
    });

    for (const edge of result.edges) {
      createLine(this.world, edge.a, edge.b, maxDelay + 0.55);
    }

    // Sage's offers: expand (green) / challenge (amber) buds — press to read.
    for (const suggestion of result.suggestions ?? []) {
      const noteEntity = loci.noteById.get(suggestion.noteId);
      const object = noteEntity?.object3D;
      if (object == null) {
        continue;
      }
      createSuggestionBud(
        this.world,
        suggestion.kind,
        suggestion.text,
        new Vector3(
          object.position.x + 0.11,
          object.position.y + 0.13,
          object.position.z + 0.04,
        ),
      );
    }

    playSnapChord(0.18);
    // Remember the structure for recall quizzes and the palace save, then
    // save after the flights land so stored positions are the settled ones.
    loci.lastEdges = result.edges.map((edge) => ({ a: edge.a, b: edge.b }));
    loci.lastLabels = result.clusters.map((cluster, index) => ({
      index,
      label: cluster.label,
      hue: CLUSTER_HUES[index % CLUSTER_HUES.length],
    }));
    schedulePalaceSave(loci, 1800);
  }
}
