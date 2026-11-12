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
import { playSnapChord, playOrganizeTone } from './audio.js';
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
    playOrganizeTone();

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
      // Model unreachable — the heuristic stands. This is expected when
      // offline or the Ollama endpoint is cold.
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

  /** Push point `a` away from `b` so they're at least `minDist` apart. */
  private separate(a: Vector3, b: Vector3, minDist: number): void {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist >= minDist) {
      return;
    }
    if (dist < 1e-4) {
      // Perfect overlap: nudge along a stable pseudo-random direction.
      a.x += Math.random() * 0.01;
      a.y += Math.random() * 0.005;
      dist = 1e-4;
    }
    const push = (minDist - dist) / dist;
    a.x += dx * push;
    a.y += dy * push;
    a.z += dz * push;
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

    // Phase 1 — compute every movable note's base grid target.
    interface Targeted {
      entity: Entity;
      target: Vector3;
    }
    const targets: Targeted[] = [];
    const clusterMeta: Array<{ center: Vector3; hue: number; count: number; label: string }> = [];
    result.clusters.forEach((cluster, clusterIndex) => {
      const center = new Vector3();
      const raw = clusterCenter(clusterIndex, result.clusters.length);
      center.set(raw.x, raw.y, raw.z);
      const hue = CLUSTER_HUES[clusterIndex % CLUSTER_HUES.length];
      clusterMeta.push({ center, hue, count: cluster.noteIds.length, label: cluster.label });

      cluster.noteIds.forEach((id, index) => {
        const entity = loci.noteById.get(id);
        const object = entity?.object3D;
        if (entity == null || object == null) {
          return;
        }
        const offset = noteOffset(index, cluster.noteIds.length);
        targets.push({
          entity,
          target: new Vector3(center.x + offset.x, center.y + offset.y, center.z + offset.z),
        });
        entity.setValue(Note, 'cluster', clusterIndex);
        entity.setValue(Note, 'hue', hue);
        entity.setValue(Note, 'state', 'snapping');
        setNoteTint(entity, hue, 0.45);
      });
    });

    // Phase 2 — declump: relax movable targets away from overlaps, treating
    // user-placed cards as immovable obstacles. A gentle nudge so nothing
    // visually overlaps — never a rearrangement of the user's placements.
    const MIN_DIST = 0.185;
    const obstacles: Vector3[] = [];
    for (const entity of this.queries.notes.entities) {
      if ((entity.getValue(Note, 'userPlaced') ?? false) && entity.object3D != null) {
        obstacles.push(entity.object3D.position.clone());
      }
    }
    for (let pass = 0; pass < 5; pass += 1) {
      for (let i = 0; i < targets.length; i += 1) {
        for (let j = i + 1; j < targets.length; j += 1) {
          this.separate(targets[i].target, targets[j].target, MIN_DIST);
        }
        for (const obstacle of obstacles) {
          this.separate(targets[i].target, obstacle, MIN_DIST);
        }
      }
    }

    // Phase 3 — launch the flights with the declumped targets.
    let flightIndex = 0;
    let maxDelay = 0;
    for (const { entity, target } of targets) {
      const object = entity.object3D!;
      const start = object.position;
      const delay = flightIndex * 0.045;
      maxDelay = Math.max(maxDelay, delay);
      flightIndex += 1;
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
    }

    // Phase 4 — labels above each (declumped) cluster.
    result.clusters.forEach((_, clusterIndex) => {
      const meta = clusterMeta[clusterIndex];
      createClusterLabel(
        this.world,
        meta.label,
        meta.hue,
        new Vector3(meta.center.x, meta.center.y + gridHalfHeight(meta.count) + 0.1, meta.center.z + 0.02),
        clusterIndex,
      );
    });

    for (const edge of result.edges) {
      createLine(this.world, edge.a, edge.b, maxDelay + 0.55);
    }

    // Sage's offers: expand (green) / challenge (amber) buds — press to read.
    // Use post-snap targets (not current pre-snap positions) so buds appear
    // where cards will land, not where they took off from.
    const targetById = new Map<string, Vector3>();
    for (const { entity, target } of targets) {
      const id = entity.getValue(Note, 'id') ?? '';
      if (id !== '') {
        targetById.set(id, target);
      }
    }
    for (const suggestion of result.suggestions ?? []) {
      const pos = targetById.get(suggestion.noteId);
      if (pos == null) {
        continue;
      }
      createSuggestionBud(
        this.world,
        suggestion.kind,
        suggestion.text,
        new Vector3(
          pos.x + 0.11,
          pos.y + 0.13,
          pos.z + 0.04,
        ),
      );
    }

    // The guide did its job — clear the stage for the snap.
    loci.hideWelcome();
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
