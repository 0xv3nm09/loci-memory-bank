import { createSystem, VisibilityState, type Entity } from '@iwsdk/core';
import { Object3D, Plane, Raycaster, Vector3, Vector2 } from 'three';
import { Note, SnapAnimation } from './components.js';
import { playPlaceClick } from './audio.js';
import { getLoci } from './globals.js';
import { schedulePalaceSave } from './palace-store.js';

/**
 * Desktop arranging: click-drag cards on a camera-facing plane. VR uses the
 * grab system (pinch / squeeze) — this exists so the flow is testable in a
 * plain browser.
 */
export class MouseDragSystem extends createSystem({}) {
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private plane = new Plane();
  private cameraDirection = new Vector3();
  private hitPoint = new Vector3();
  private grabOffset = new Vector3();
  private dragEntity: Entity | null = null;

  init(): void {
    const canvas = this.renderer.domElement;

    const pointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || this.dragEntity != null) {
        return;
      }
      const loci = getLoci(this.globals);
      if (loci.rewindActive) {
        return;
      }
      if (this.world.visibilityState.peek() !== VisibilityState.NonImmersive) {
        return;
      }
      const entity = this.pickNote(event);
      const object = entity?.object3D;
      if (entity == null || object == null) {
        return;
      }
      event.preventDefault();
      this.dragEntity = entity;
      this.camera.getWorldDirection(this.cameraDirection);
      this.plane.setFromNormalAndCoplanarPoint(
        this.cameraDirection.negate(),
        this.hitPoint,
      );
      this.grabOffset.subVectors(object.position, this.hitPoint);
      canvas.setPointerCapture(event.pointerId);
    };

    const pointerMove = (event: PointerEvent): void => {
      if (this.dragEntity == null) {
        return;
      }
      this.updatePointer(event);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(this.plane, this.hitPoint)) {
        const object = this.dragEntity.object3D;
        if (object == null) {
          return;
        }
        object.position.copy(this.hitPoint).add(this.grabOffset);
        object.lookAt(0, object.position.y, 0.001);
      }
    };

    const pointerUp = (event: PointerEvent): void => {
      if (this.dragEntity == null) {
        return;
      }
      try {
        if (this.dragEntity.hasComponent(Note)) {
          this.dragEntity.setValue(Note, 'userPlaced', true);
          this.dragEntity.setValue(Note, 'state', 'settled');
        }
        if (this.dragEntity.hasComponent(SnapAnimation)) {
          this.dragEntity.removeComponent(SnapAnimation);
        }
        playPlaceClick();
        schedulePalaceSave(getLoci(this.globals));
      } catch {
        // Entity destroyed mid-drag.
      }
      this.dragEntity = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    this.cleanupFuncs.push(
      () => canvas.removeEventListener('pointerdown', pointerDown),
      () => canvas.removeEventListener('pointermove', pointerMove),
      () => canvas.removeEventListener('pointerup', pointerUp),
      () => canvas.removeEventListener('pointercancel', pointerUp),
    );
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private pickNote(event: PointerEvent): Entity | null {
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const loci = getLoci(this.globals);
    const roots: Object3D[] = [];
    for (const entity of loci.noteById.values()) {
      if (entity.object3D != null) {
        roots.push(entity.object3D);
      }
    }
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      let node: Object3D | null = hit.object;
      while (node != null && !node.name.startsWith('note-')) {
        node = node.parent;
      }
      if (node == null) {
        continue;
      }
      const id = node.name.slice('note-'.length);
      const entity = loci.noteById.get(id);
      if (entity != null) {
        this.hitPoint.copy(hit.point);
        return entity;
      }
    }
    return null;
  }
}
