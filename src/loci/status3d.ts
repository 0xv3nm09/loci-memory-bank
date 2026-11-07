import { createLabel } from './note-factory.js';
import type { World } from '@iwsdk/core';
import type { Mesh } from 'three';
import { SEMANTIC } from './palette.js';

/**
 * The in-scene status line — Sage's voice inside the VR scene, so feedback
 * never depends on the desktop DOM overlay. The DOM #hud-status (desktop
 * convenience) mirrors every message.
 */

const POS = { x: 0, y: 1.02, z: -0.82 };
let redraw: ((text: string) => void) | null = null;

export function initStatus3D(world: World): void {
  // 20px+ for comfortable VR reading at this distance.
  const label = createLabel('The space is calm. Drop a thought.', 0.020, SEMANTIC.statusText, 0.6);
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
