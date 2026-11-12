/**
 * Webcam Hand-Tracking System — desktop testing without a VR headset.
 *
 * Uses MediaPipe HandLandmarker (via @mediapipe/tasks-vision) to track the
 * user's hand through their webcam. Maps the index-finger tip to screen
 * coordinates and emits synthetic PointerEvents on the renderer canvas so
 * that **all existing interactions** (MouseDragSystem, IWSDK RayInteractable,
 * orb presses, etc.) work untouched.
 *
 * Pinch gesture (thumb tip ↔ index tip) toggles pointerdown / pointerup.
 *
 * Activates only in NonImmersive mode (desktop). A small webcam preview +
 * cursor overlay appears in the bottom-left corner.
 *
 * v2 — Deep polish: cursor trail particles, smooth glow ring, pinch scale
 * animation, hand-confidence indicator, and glass-morphism webcam overlay.
 */

import { createSystem, VisibilityState } from '@iwsdk/core';
import { setAppStatus } from './status3d.js';
import { playHoverTick } from './audio.js';

/* ---------- MediaPipe types (minimal, to avoid depending on the npm types
   package which may not be available — we dynamically import the module) -- */
interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandLandmarkerResult {
  landmarks: Landmark[][];
}

interface HandLandmarkerInstance {
  setOptions(opts: Record<string, unknown>): Promise<void>;
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult;
}

/* ---------- Constants ---------------------------------------------------- */

const PINCH_THRESHOLD = 0.055; // normalised distance — closed
const PINCH_RELEASE   = 0.078; // normalised distance — open (hysteresis)
const POINTER_ID      = 9999;  // synthetic pointer id
const TRAIL_LENGTH    = 8;     // number of trail dots
const TRAIL_INTERVAL  = 25;    // ms between trail dot spawns

/* ---------- System ------------------------------------------------------- */

export class WebcamHandSystem extends createSystem({}) {
  private active = false;
  private handLandmarker: HandLandmarkerInstance | null = null;
  private video: HTMLVideoElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private cursor: HTMLDivElement | null = null;
  private cursorGlow: HTMLDivElement | null = null;
  private trailDots: HTMLDivElement[] = [];
  private stream: MediaStream | null = null;
  private rafId = 0;
  private pinching = false;
  private lastScreenX = 0;
  private lastScreenY = 0;
  private lastDetectTime = -1;
  private canvas: HTMLCanvasElement | null = null;
  private lastTrailTime = 0;
  private trailIndex = 0;
  private confidenceDot: HTMLDivElement | null = null;

  init(): void {
    // Only activate on desktop — check once.
    if (this.world.visibilityState.peek() !== VisibilityState.NonImmersive) {
      return;
    }
    this.canvas = this.renderer.domElement;
    // Defer the camera prompt until the visitor's first interaction: a
    // permission dialog on page load is a terrible first five minutes.
    const startOnGesture = (): void => {
      this.buildUI();
      void this.bootMediaPipe();
    };
    document.getElementById('webcam-toggle')?.addEventListener('click', startOnGesture, { once: true });
    this.cleanupFuncs.push(() => {
      document.getElementById('webcam-toggle')?.removeEventListener('click', startOnGesture);
      this.teardown();
    });
  }

  /* ---- UI: webcam preview + cursor + trail ---- */

  private buildUI(): void {
    // Wrapper — bottom-left, glass morphism.
    const overlay = document.createElement('div');
    overlay.id = 'webcam-hand-overlay';
    overlay.style.cssText = `
      position: fixed; bottom: 16px; left: 16px; z-index: 800;
      width: 190px; height: 142px; border-radius: 14px;
      overflow: hidden;
      border: 1.5px solid rgba(130,160,255,0.3);
      background: rgba(6, 10, 22, 0.8);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(80,120,220,0.06) inset;
      opacity: 0.95;
      pointer-events: none;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    `;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      transform: scaleX(-1);
      opacity: 0.85;
    `;
    overlay.appendChild(video);

    const badge = document.createElement('div');
    badge.textContent = '✋ Hand Tracking';
    badge.style.cssText = `
      position: absolute; top: 8px; left: 10px;
      font: 600 10px/1 Inter, sans-serif; color: #b0c4ff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      letter-spacing: 0.03em;
    `;
    overlay.appendChild(badge);

    // Confidence indicator — a small dot that goes green when hand is detected
    const confidenceDot = document.createElement('div');
    confidenceDot.style.cssText = `
      position: absolute; top: 8px; right: 10px;
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(100,100,140,0.5);
      box-shadow: 0 0 4px rgba(0,0,0,0.3);
      transition: background 0.3s ease, box-shadow 0.3s ease;
      pointer-events: none;
    `;
    overlay.appendChild(confidenceDot);
    this.confidenceDot = confidenceDot;

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.video = video;

    // Cursor — a layered ring with soft outer glow.
    const cursorGlow = document.createElement('div');
    cursorGlow.id = 'webcam-hand-glow';
    cursorGlow.style.cssText = `
      position: fixed; z-index: 798;
      width: 48px; height: 48px; border-radius: 50%;
      background: radial-gradient(circle, rgba(100,180,255,0.12) 0%, transparent 70%);
      pointer-events: none; transform: translate(-50%, -50%);
      transition: width 0.15s ease, height 0.15s ease, background 0.2s ease;
      display: none;
    `;
    document.body.appendChild(cursorGlow);
    this.cursorGlow = cursorGlow;

    const cursor = document.createElement('div');
    cursor.id = 'webcam-hand-cursor';
    cursor.style.cssText = `
      position: fixed; z-index: 799;
      width: 26px; height: 26px; border-radius: 50%;
      border: 2px solid rgba(130,200,255,0.75);
      box-shadow: 0 0 12px rgba(100,180,255,0.35), inset 0 0 6px rgba(100,180,255,0.1);
      pointer-events: none; transform: translate(-50%, -50%);
      transition: width 0.12s ease, height 0.12s ease, border-color 0.15s ease,
                  box-shadow 0.15s ease, background 0.15s ease;
      display: none;
    `;
    document.body.appendChild(cursor);
    this.cursor = cursor;

    // Trail dots — fading ring particles behind the cursor.
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: fixed; z-index: 797;
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(130,200,255,0.4);
        pointer-events: none; transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
        display: none;
      `;
      document.body.appendChild(dot);
      this.trailDots.push(dot);
    }
  }

  /* ---- MediaPipe bootstrap (dynamic import) ---- */

  private async bootMediaPipe(): Promise<void> {
    try {
      setAppStatus('Starting webcam hand tracking…');
      // Dynamic import — the module must be installed (npm i @mediapipe/tasks-vision).
      const { FilesetResolver, HandLandmarker } = await import(
        '@mediapipe/tasks-vision'
      );

      const vision = await FilesetResolver.forVisionTasks(
        // The WASM files are loaded from the node_modules via Vite's dependency
        // bundling, or from the CDN fallback baked into the package.
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm',
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      // Open camera.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }

      this.active = true;
      setAppStatus('Hand tracking active — pinch to interact.');
      this.tick();
    } catch (err) {
      console.warn('[webcam-hand] Failed to initialise:', err);
      setAppStatus('Hand tracking unavailable — using mouse.');
      // Graceful fallback: the system simply stays inactive; mouse still works.
    }
  }

  /* ---- Per-frame detection loop ---- */

  private tick = (): void => {
    if (!this.active || this.video == null || this.handLandmarker == null) {
      return;
    }

    const now = performance.now();
    // Run detection only when the video has a new frame.
    if (this.video.currentTime !== this.lastDetectTime && this.video.readyState >= 2) {
      this.lastDetectTime = this.video.currentTime;
      const result = this.handLandmarker.detectForVideo(this.video, now);
      if (result.landmarks.length > 0) {
        this.processHand(result.landmarks[0]);
        this.setConfidence(true);
      } else {
        this.hideCursor();
        this.setConfidence(false);
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /* ---- Landmark → pointer ---- */

  private processHand(landmarks: Landmark[]): void {
    // Index finger tip = landmark 8, thumb tip = landmark 4.
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    if (indexTip == null || thumbTip == null) {
      return;
    }

    // Map normalised x/y (mirrored camera, so invert x) to screen coords.
    if (this.canvas == null) { return; }
    const rect = this.canvas.getBoundingClientRect();
    const screenX = rect.left + (1 - indexTip.x) * rect.width;
    const screenY = rect.top + indexTip.y * rect.height;

    this.lastScreenX = screenX;
    this.lastScreenY = screenY;
    this.showCursor(screenX, screenY);
    this.spawnTrail(screenX, screenY);

    // Pinch detection with hysteresis.
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (!this.pinching && dist < PINCH_THRESHOLD) {
      this.pinching = true;
      this.setPinchVisual(true);
      playHoverTick();
      this.dispatchPointer('pointerdown', screenX, screenY);
    } else if (this.pinching && dist > PINCH_RELEASE) {
      this.pinching = false;
      this.setPinchVisual(false);
      this.dispatchPointer('pointerup', screenX, screenY);
    } else {
      // Always send move so the drag system keeps up.
      this.dispatchPointer('pointermove', screenX, screenY);
    }
  }

  /* ---- Synthetic pointer events ---- */

  private dispatchPointer(type: string, clientX: number, clientY: number): void {
    if (this.canvas == null) {
      return;
    }
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: POINTER_ID,
      pointerType: 'touch',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: this.pinching ? 1 : 0,
    });
    this.canvas.dispatchEvent(event);
  }

  /* ---- Cursor visuals ---- */

  private showCursor(x: number, y: number): void {
    if (this.cursor == null) { return; }
    this.cursor.style.display = 'block';
    this.cursor.style.left = `${x}px`;
    this.cursor.style.top = `${y}px`;
    if (this.cursorGlow != null) {
      this.cursorGlow.style.display = 'block';
      this.cursorGlow.style.left = `${x}px`;
      this.cursorGlow.style.top = `${y}px`;
    }
  }

  private hideCursor(): void {
    if (this.cursor == null) { return; }
    this.cursor.style.display = 'none';
    if (this.cursorGlow != null) {
      this.cursorGlow.style.display = 'none';
    }
    // Fade out trail
    for (const dot of this.trailDots) {
      dot.style.opacity = '0';
    }
  }

  private setPinchVisual(pinching: boolean): void {
    if (this.cursor == null) { return; }
    if (pinching) {
      this.cursor.style.borderColor = 'rgba(100,255,180,0.9)';
      this.cursor.style.width = '18px';
      this.cursor.style.height = '18px';
      this.cursor.style.boxShadow = '0 0 20px rgba(80,255,160,0.5), inset 0 0 8px rgba(80,255,160,0.2)';
      this.cursor.style.background = 'rgba(80,255,160,0.08)';
      if (this.cursorGlow != null) {
        this.cursorGlow.style.width = '56px';
        this.cursorGlow.style.height = '56px';
        this.cursorGlow.style.background = 'radial-gradient(circle, rgba(80,255,160,0.18) 0%, transparent 70%)';
      }
      // Overlay border glow on pinch
      if (this.overlay != null) {
        this.overlay.style.borderColor = 'rgba(100,255,180,0.5)';
        this.overlay.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4), 0 0 12px rgba(80,255,160,0.15)';
      }
    } else {
      this.cursor.style.borderColor = 'rgba(130,200,255,0.75)';
      this.cursor.style.width = '26px';
      this.cursor.style.height = '26px';
      this.cursor.style.boxShadow = '0 0 12px rgba(100,180,255,0.35), inset 0 0 6px rgba(100,180,255,0.1)';
      this.cursor.style.background = 'transparent';
      if (this.cursorGlow != null) {
        this.cursorGlow.style.width = '48px';
        this.cursorGlow.style.height = '48px';
        this.cursorGlow.style.background = 'radial-gradient(circle, rgba(100,180,255,0.12) 0%, transparent 70%)';
      }
      if (this.overlay != null) {
        this.overlay.style.borderColor = 'rgba(130,160,255,0.3)';
        this.overlay.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(80,120,220,0.06) inset';
      }
    }
  }

  /* ---- Cursor trail ---- */

  private spawnTrail(x: number, y: number): void {
    const now = performance.now();
    if (now - this.lastTrailTime < TRAIL_INTERVAL) { return; }
    this.lastTrailTime = now;

    const dot = this.trailDots[this.trailIndex % TRAIL_LENGTH];
    if (dot == null) { return; }

    dot.style.display = 'block';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.opacity = this.pinching ? '0.6' : '0.35';
    dot.style.background = this.pinching
      ? 'rgba(100,255,180,0.5)'
      : 'rgba(130,200,255,0.4)';
    dot.style.width = this.pinching ? '5px' : '4px';
    dot.style.height = this.pinching ? '5px' : '4px';

    // Schedule fade
    setTimeout(() => {
      dot.style.opacity = '0';
    }, 120);

    this.trailIndex++;
  }

  /* ---- Confidence indicator ---- */

  private setConfidence(detected: boolean): void {
    if (this.confidenceDot == null) { return; }
    if (detected) {
      this.confidenceDot.style.background = 'rgba(80,220,140,0.8)';
      this.confidenceDot.style.boxShadow = '0 0 6px rgba(80,220,140,0.5)';
    } else {
      this.confidenceDot.style.background = 'rgba(100,100,140,0.5)';
      this.confidenceDot.style.boxShadow = '0 0 4px rgba(0,0,0,0.3)';
    }
  }

  /* ---- Cleanup ---- */

  private teardown(): void {
    this.active = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }
    this.overlay?.remove();
    this.cursor?.remove();
    this.cursorGlow?.remove();
    for (const dot of this.trailDots) {
      dot.remove();
    }
    this.trailDots = [];
  }
}
