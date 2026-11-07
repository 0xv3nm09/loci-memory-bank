/**
 * Loci — a spatial memory bank.
 * Build for the Meta VR Start Developer Competition 2026 (Productivity track).
 */

import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { AmbientSystem } from './loci/ambient-system.js';
import { CaptureSystem } from './loci/capture-system.js';
import { MouseDragSystem } from './loci/mouse-drag-system.js';
import { OrganizeSystem } from './loci/organize-system.js';
import { CrisisPanelSystem } from './loci/crisis-panel.js';
import { KeyboardSystem } from './loci/capture-keyboard.js';
import { RecallSystem } from './loci/recall-system.js';
import { RewindSystem } from './loci/rewind-system.js';
import { GrabWatchSystem, SnapSystem } from './loci/snap-system.js';
import { createLociGlobals } from './loci/globals.js';
import { loadLociFont } from './loci/text-label.js';
import { warmupModel } from './loci/model-client.js';
import { initStatus3D } from './loci/status3d.js';
import { WebcamHandSystem } from './loci/webcam-hand-system.js';

// Register the bundled Inter before any card label is drawn, so every
// surface uses the same type from the first frame.
try {
  await loadLociFont();
} catch {
  // Font load failed — canvas labels fall back to system font.
}

const sceneContainer = document.getElementById('scene-container');
if (sceneContainer == null) {
  throw new Error('Missing #scene-container element');
}

World.create(sceneContainer as HTMLDivElement, projectOptions).catch((err) => {
  console.error('[Loci] World.create failed:', err);
}).then((world) => {
  if (world == null) { return; }
  (world.globals as Record<string, unknown>)['loci'] = createLociGlobals();

  world.registerSystem(CaptureSystem);
  world.registerSystem(OrganizeSystem);
  world.registerSystem(SnapSystem);
  world.registerSystem(GrabWatchSystem);
  world.registerSystem(AmbientSystem);
  world.registerSystem(MouseDragSystem);
  world.registerSystem(RecallSystem);
  world.registerSystem(RewindSystem);
  world.registerSystem(CrisisPanelSystem);
  world.registerSystem(KeyboardSystem);
  world.registerSystem(PanelSystem);
  world.registerSystem(WebcamHandSystem);

  // Sage's voice in the scene — status never depends on the DOM overlay.
  initStatus3D(world);

  // Preload Sage into the server's VRAM so the first Organize is warm.
  warmupModel();

  // Quest comfort + performance targets (judging: min 60fps, seated).
  world.visibilityState.subscribe((state) => {
    if (state === VisibilityState.Visible) {
      try {
        world.session?.updateTargetFrameRate(72);
        world.renderer.xr.setFoveation(0.8);
      } catch {
        // session may not support these — desktop is unaffected
      }
    }
  });
});
