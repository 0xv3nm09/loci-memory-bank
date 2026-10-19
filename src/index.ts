/**
 * Loci — a spatial memory bank.
 * Build for the Meta VR Start Developer Competition 2026 (Productivity track).
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { AmbientSystem } from './loci/ambient-system.js';
import { CaptureSystem } from './loci/capture-system.js';
import { MouseDragSystem } from './loci/mouse-drag-system.js';
import { OrganizeSystem } from './loci/organize-system.js';
import { RecallSystem } from './loci/recall-system.js';
import { RewindSystem } from './loci/rewind-system.js';
import { GrabWatchSystem, SnapSystem } from './loci/snap-system.js';
import { createLociGlobals } from './loci/globals.js';
import { loadLociFont } from './loci/text-label.js';

// Register the bundled Inter before any card label is drawn, so every
// surface uses the same type from the first frame.
await loadLociFont();

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  (world.globals as Record<string, unknown>)['loci'] = createLociGlobals();

  world.registerSystem(CaptureSystem);
  world.registerSystem(OrganizeSystem);
  world.registerSystem(SnapSystem);
  world.registerSystem(GrabWatchSystem);
  world.registerSystem(AmbientSystem);
  world.registerSystem(MouseDragSystem);
  world.registerSystem(RecallSystem);
  world.registerSystem(RewindSystem);
  world.registerSystem(PanelSystem);
});
