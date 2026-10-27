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
 */

import { createSystem, VisibilityState } from '@iwsdk/core';
import { setAppStatus } from './status3d.js';

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

/* ---------- System ------------------------------------------------------- */

export class WebcamHandSystem extends createSystem({}) {
  private active = false;
  private handLandmarker: HandLandmarkerInstance | null = null;
  private video: HTMLVideoElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private cursor: HTMLDivElement | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private pinching = false;
  private lastScreenX = 0;
  private lastScreenY = 0;
  private lastDetectTime = -1;
  private canvas: HTMLCanvasElement | null = null;

  init(): void {
    // Only activate on desktop — check once.
    if (this.world.visibilityState.peek() !== VisibilityState.NonImmersive) {
      return;
    }
    this.canvas = this.renderer.domElement;
    this.buildUI();
    this.bootMediaPipe();
    this.cleanupFuncs.push(() => this.teardown());
  }

  /* ---- UI: webcam preview + cursor ---- */

  private buildUI(): void {
    // Wrapper — bottom-left, small.
    const overlay = document.createElement('div');
    overlay.id = 'webcam-hand-overlay';
    overlay.style.cssText = `
      position: fixed; bottom: 16px; left: 16px; z-index: 800;
      width: 180px; height: 135px; border-radius: 12px;
      overflow: hidden; border: 2px solid rgba(130,160,255,0.4);
      background: #0a0e1a; opacity: 0.92;
      pointer-events: none;
    `;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      transform: scaleX(-1);
    `;
    overlay.appendChild(video);

    const badge = document.createElement('div');
    badge.textContent = '✋ Hand Tracking';
    badge.style.cssText = `
      position: absolute; top: 6px; left: 8px;
      font: 600 10px/1 Inter, sans-serif; color: #b0c4ff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.7);
      pointer-events: none;
    `;
    overlay.appendChild(badge);

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.video = video;

    // Cursor — a soft ring that follows the index finger on the main canvas.
    const cursor = document.createElement('div');
    cursor.id = 'webcam-hand-cursor';
    cursor.style.cssText = `
      position: fixed; z-index: 799;
      width: 28px; height: 28px; border-radius: 50%;
      border: 2.5px solid rgba(130,200,255,0.7);
      box-shadow: 0 0 10px rgba(100,180,255,0.4);
      pointer-events: none; transform: translate(-50%, -50%);
      transition: width 0.1s, height 0.1s, border-color 0.1s;
      display: none;
    `;
    document.body.appendChild(cursor);
    this.cursor = cursor;
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
      } else {
        this.hideCursor();
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
    const rect = this.canvas!.getBoundingClientRect();
    const screenX = rect.left + (1 - indexTip.x) * rect.width;
    const screenY = rect.top + indexTip.y * rect.height;

    this.lastScreenX = screenX;
    this.lastScreenY = screenY;
    this.showCursor(screenX, screenY);

    // Pinch detection with hysteresis.
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (!this.pinching && dist < PINCH_THRESHOLD) {
      this.pinching = true;
      this.setPinchVisual(true);
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
  }

  private hideCursor(): void {
    if (this.cursor == null) { return; }
    this.cursor.style.display = 'none';
  }

  private setPinchVisual(pinching: boolean): void {
    if (this.cursor == null) { return; }
    if (pinching) {
      this.cursor.style.borderColor = 'rgba(100,255,180,0.9)';
      this.cursor.style.width = '20px';
      this.cursor.style.height = '20px';
      this.cursor.style.boxShadow = '0 0 16px rgba(80,255,160,0.5)';
    } else {
      this.cursor.style.borderColor = 'rgba(130,200,255,0.7)';
      this.cursor.style.width = '28px';
      this.cursor.style.height = '28px';
      this.cursor.style.boxShadow = '0 0 10px rgba(100,180,255,0.4)';
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
  }
}
