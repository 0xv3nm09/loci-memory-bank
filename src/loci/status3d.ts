import { createLabel } from './note-factory.js';
import type { World } from '@iwsdk/core';
import type { Mesh } from 'three';

/**
 * The in-scene status line — Sage's voice inside the VR scene, so feedback
 * never depends on the desktop DOM overlay. The DOM #hud-status (desktop
 * convenience) mirrors every message.
 */

const POS = { x: 0, y: 0.78, z: -0.9 };
let redraw: ((text: string) => void) | null = null;

export function initStatus3D(world: World): void {
  const label = createLabel('The space is calm. Dump a thought.', 0.0135, '#9fb0d8', 0.6);
  label.position.set(POS.x, POS.y, POS.z);
  label.lookAt(POS.x, POS.y, 0.001);
  world.createTransformEntity(label, { persistent: true });
  redraw = (text: string) => label.userData.redraw?.(text);
}

/** One funnel for every status message — scene label + desktop mirror. */
export function setAppStatus(text: string): void {
  redraw?.(text);
  const dom = document.getElementById('hud-status');
  if (dom != null) {
    dom.textContent = text;
  }
}

export type StatusMesh = Mesh;
