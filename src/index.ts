/**
 * Loci — a spatial memory bank.
 * Build for the Meta VR Start Developer Competition 2026 (Productivity track).
 */

import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import './styles.css';
import { ExperienceSystem } from './loci/experience-system.js';
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

import { startHealthIndicator } from './loci/palace-health.js';

// Register the bundled Inter before any card label is drawn, so every
// surface uses the same type from the first frame.
try {
  await Promise.race([loadLociFont(), new Promise(r => setTimeout(r, 3000))]);
} catch {
  // Font load failed — canvas labels fall back to system font.
}

const sceneContainer = document.getElementById('scene-container');
if (sceneContainer == null) {
  throw new Error('Missing #scene-container element');
}

/**
 * Boot failure must be VISIBLE, not a silent splash forever: if World.create
 * rejects, the error lands on the page and the console.
 */
function showBootFailure(err: unknown): void {
  console.error('[Loci] boot failed:', err);
  const splash = document.getElementById('loci-splash');
  const line = document.createElement('div');
  line.style.cssText =
    'position:fixed;inset:auto 0 40%;0;text-align:center;color:#ff9b9b;' +
    "font:600 15px Inter, system-ui, sans-serif;text-shadow:0 1px 4px #000;";
  line.textContent = 'Loci failed to start — refresh the page to try again.';
  document.body.appendChild(line);
  if (splash) {
    splash.style.opacity = '0.4';
  }
}

async function boot(): Promise<void> {
  let world: World;
  try {
    world = await World.create(sceneContainer as HTMLDivElement, projectOptions);
  } catch (err) {
    showBootFailure(err);
    return;
  }

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
  world.registerSystem(ExperienceSystem);
  world.registerSystem(WebcamHandSystem);

  // ── ECS error boundary ──
  // One throwing system update must never freeze the whole world loop: wrap
  // every registered system's update in a guard that logs the first failure
  // per system and then keeps going.
  const guarded = new Set<string>();
  for (const system of (world as unknown as { systems: Array<{ constructor: { name: string }; update: (d: number, t: number) => void }> }).systems) {
    const name = system.constructor?.name ?? 'System';
    const original = system.update.bind(system);
    system.update = (delta: number, time: number): void => {
      try {
        original(delta, time);
      } catch (err) {
        if (!guarded.has(name)) {
          guarded.add(name);
          console.error(`[Loci] system "${name}" threw — further errors from it are suppressed:`, err);
        }
      }
    };
  }

  // Sage's voice in the scene — status never depends on the DOM overlay.
  initStatus3D(world);

  // Preload Sage into the server's VRAM so the first Organize is warm.
  warmupModel();

  // ── Splash dismiss ──
  const splash = document.getElementById('loci-splash');
  if (splash) {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Safety fallback — remove after 1.2s even if transitionend doesn't fire
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 1200);
  }

  // ── First-time onboarding ──
  // ExperienceSystem owns the single spatial opening sequence.

  // ── Palace health indicator ──
  startHealthIndicator();

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
}

void boot();
