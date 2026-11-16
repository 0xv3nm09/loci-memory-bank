/**
 * All Loci audio is synthesized with WebAudio — zero assets, zero licensing,
 * always available. One cue each: snap (resolving chord), connect (rising
 * two-note), place (soft click), per the Art & Audio tokens.
 *
 * v2 — Deep polish: richer ambient drone with evolving harmonics, binaural
 * detune, filtered pad layers, and state-reactive mixing. The ambient bed
 * now breathes with the palace — growing richer as more notes exist.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
export function setAudioMuted(next: boolean): void {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.75, ctx.currentTime, 0.08);
}

export function ensureAudio(): AudioContext | null {
  try {
    if (ctx == null) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.75;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2600;
      master.connect(lowpass);
      lowpass.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Browsers suspend audio created outside a user gesture. Call this on the
 * first click/press so every later cue (snap chord, recall pings) is heard.
 */
export function primeAudioOnFirstGesture(): void {
  const prime = (): void => {
    ensureAudio();
  };
  window.addEventListener('pointerdown', prime, { once: true });
  window.addEventListener('keydown', prime, { once: true });
}

interface VoiceOptions {
  freq: number;
  start: number;
  duration: number;
  peak: number;
  type?: OscillatorType;
  attack?: number;
  /** Pitch slide target (Hz). If set, frequency sweeps to this value. */
  slideTo?: number;
  /** Pan position (-1 to 1). */
  pan?: number;
}

function voice(options: VoiceOptions): void {
  if (ctx == null || master == null) {
    return;
  }
  const { freq, start, duration, peak, type = 'sine', attack = 0.025, slideTo, pan } = options;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration * 0.7);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);

  if (pan != null && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }

  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** The snap: a warm resolving A-major-ish chord with stereo spread. */
export function playSnapChord(delaySeconds = 0.1): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime + delaySeconds;
  voice({ freq: 220, start: t0, duration: 1.8, peak: 0.28, pan: -0.2 });
  voice({ freq: 277.18, start: t0 + 0.04, duration: 1.6, peak: 0.20, pan: 0.15 });
  voice({ freq: 329.63, start: t0 + 0.08, duration: 1.5, peak: 0.16, pan: -0.1 });
  voice({ freq: 440, start: t0 + 0.16, duration: 1.3, peak: 0.08, pan: 0.2 });
  // Shimmer overtone — adds sparkle to the resolve
  voice({ freq: 659, start: t0 + 0.22, duration: 0.9, peak: 0.035, pan: 0.3 });
}

let lastConnectAt = 0;

/** A connection line drew in — rising two-note ping with stereo placement. */
export function playConnectTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const now = performance.now();
  if (now - lastConnectAt < 140) {
    return;
  }
  lastConnectAt = now;
  const t0 = audio.currentTime;
  // Slight random pan for spatial interest
  const randomPan = (Math.random() - 0.5) * 0.6;
  voice({ freq: 660, start: t0, duration: 0.14, peak: 0.10, attack: 0.01, pan: randomPan });
  voice({ freq: 880, start: t0 + 0.09, duration: 0.18, peak: 0.08, attack: 0.01, pan: -randomPan });
}

/** A card settles in the hand — soft click with subtle resonance. */
export function playPlaceClick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({
    freq: 1180,
    start: t0,
    duration: 0.06,
    peak: 0.10,
    type: 'triangle',
    attack: 0.004,
  });
  // Resonant tail
  voice({
    freq: 590,
    start: t0 + 0.03,
    duration: 0.12,
    peak: 0.03,
    type: 'sine',
    attack: 0.01,
  });
}

/**
 * Crisis surface cue — deliberately calm, low, slow: presence and care,
 * never an alarm. The one audio accompaniment to the safety panel.
 */
export function playCalmTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 196, start: t0, duration: 2.5, peak: 0.07, attack: 0.6, pan: -0.15 });
  voice({ freq: 246.9, start: t0 + 0.4, duration: 2.0, peak: 0.05, attack: 0.6, pan: 0.15 });
  // Gentle fifth — adds warmth without tension
  voice({ freq: 293.66, start: t0 + 0.8, duration: 1.6, peak: 0.03, attack: 0.8, pan: 0 });
}

/** A thought materializes — rising shimmer with harmonic sparkle. */
export function playSpawnTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  // Breathy shimmer: detuned sines that swell and die quickly.
  voice({ freq: 523, start: t0, duration: 0.25, peak: 0.06, attack: 0.04, pan: -0.2 });
  voice({ freq: 784, start: t0 + 0.05, duration: 0.20, peak: 0.04, attack: 0.03, pan: 0.2 });
  voice({ freq: 1047, start: t0 + 0.08, duration: 0.15, peak: 0.025, attack: 0.02, pan: 0 });
  // Upward sweep adds a "materialization" feel
  voice({ freq: 392, start: t0, duration: 0.3, peak: 0.02, attack: 0.06, slideTo: 784, pan: -0.3 });
}

/** Orb press — crisp tick with harmonic tail, slightly higher than place click. */
export function playOrbClick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 1400, start: t0, duration: 0.04, peak: 0.08, type: 'triangle', attack: 0.003 });
  voice({ freq: 2100, start: t0 + 0.02, duration: 0.04, peak: 0.05, type: 'sine', attack: 0.003 });
  // Musical tail for satisfaction
  voice({ freq: 700, start: t0 + 0.03, duration: 0.1, peak: 0.025, type: 'sine', attack: 0.01 });
}

/**
 * Organize trigger — a brief "gathering" motif. Rising arpeggio that
 * sounds like thoughts being drawn together. Plays when Sage starts organizing.
 */
export function playOrganizeTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  // Quick ascending triad — feels like assembly
  voice({ freq: 330, start: t0, duration: 0.18, peak: 0.06, attack: 0.015, pan: -0.3 });
  voice({ freq: 440, start: t0 + 0.08, duration: 0.18, peak: 0.055, attack: 0.015, pan: 0 });
  voice({ freq: 554, start: t0 + 0.16, duration: 0.22, peak: 0.05, attack: 0.015, pan: 0.3 });
  // Sustain hum underneath
  voice({ freq: 165, start: t0, duration: 0.5, peak: 0.03, attack: 0.08, pan: 0 });
}

/** Recall correct — bright ascending chime with sparkle. */
export function playCorrectTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 523, start: t0, duration: 0.15, peak: 0.07, attack: 0.01, pan: -0.2 });
  voice({ freq: 659, start: t0 + 0.06, duration: 0.15, peak: 0.06, attack: 0.01, pan: 0 });
  voice({ freq: 784, start: t0 + 0.12, duration: 0.2, peak: 0.05, attack: 0.01, pan: 0.2 });
  // Shimmer overtone
  voice({ freq: 1568, start: t0 + 0.16, duration: 0.12, peak: 0.02, attack: 0.01, pan: 0.15 });
}

/**
 * Ambient drone v2 — an evolving multi-voice ambient soundscape.
 *
 * Three layers:
 * 1. Sub-bass foundation (55Hz binaural pair — creates spatial width)
 * 2. Mid pad (filtered saw waves, slowly modulated)
 * 3. High shimmer (very quiet sine pair with LFO tremolo)
 *
 * Returns a stop function. Idempotent: calling when already running is a no-op.
 */
let droneActive = false;
export function startAmbientDrone(): () => void {
  if (droneActive) {
    return () => {};
  }
  const audio = ensureAudio();
  if (audio == null || master == null) {
    return () => {};
  }
  droneActive = true;

  const nodes: (OscillatorNode | GainNode | BiquadFilterNode)[] = [];

  // ── Layer 1: Sub-bass binaural pair ──
  const subGain = audio.createGain();
  subGain.gain.setValueAtTime(0.0001, audio.currentTime);
  subGain.gain.exponentialRampToValueAtTime(0.032, audio.currentTime + 4);
  nodes.push(subGain);

  const subLP = audio.createBiquadFilter();
  subLP.type = 'lowpass';
  subLP.frequency.value = 160;
  subLP.Q.value = 0.7;
  nodes.push(subLP);

  const sub1 = audio.createOscillator();
  sub1.type = 'sine';
  sub1.frequency.value = 55; // A1

  const sub2 = audio.createOscillator();
  sub2.type = 'sine';
  sub2.frequency.value = 55.5; // slight detune — slow binaural beat (~0.5Hz)

  // Stereo spread for immersion
  if (typeof audio.createStereoPanner === 'function') {
    const panL = audio.createStereoPanner();
    panL.pan.value = -0.3;
    const panR = audio.createStereoPanner();
    panR.pan.value = 0.3;
    sub1.connect(panL);
    panL.connect(subGain);
    sub2.connect(panR);
    panR.connect(subGain);
  } else {
    sub1.connect(subGain);
    sub2.connect(subGain);
  }
  subGain.connect(subLP);
  subLP.connect(master);
  sub1.start();
  sub2.start();

  // ── Layer 2: Mid pad — filtered "saw" → warmth ──
  const padGain = audio.createGain();
  padGain.gain.setValueAtTime(0.0001, audio.currentTime);
  padGain.gain.exponentialRampToValueAtTime(0.012, audio.currentTime + 6);
  nodes.push(padGain);

  const padFilter = audio.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 320;
  padFilter.Q.value = 2.0;
  nodes.push(padFilter);

  // Slowly modulate the filter for evolving texture
  const filterLFO = audio.createOscillator();
  filterLFO.type = 'sine';
  filterLFO.frequency.value = 0.06; // very slow sweep: ~16s cycle
  const filterLFOGain = audio.createGain();
  filterLFOGain.gain.value = 120; // sweep 200-440 Hz
  filterLFO.connect(filterLFOGain);
  filterLFOGain.connect(padFilter.frequency);
  filterLFO.start();

  const pad1 = audio.createOscillator();
  pad1.type = 'sawtooth';
  pad1.frequency.value = 110; // A2

  const pad2 = audio.createOscillator();
  pad2.type = 'sawtooth';
  pad2.frequency.value = 110.8; // detuned

  pad1.connect(padFilter);
  pad2.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(master);
  pad1.start();
  pad2.start();

  // ── Layer 3: High shimmer — barely audible harmonic cloud ──
  const shimmerGain = audio.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, audio.currentTime);
  shimmerGain.gain.exponentialRampToValueAtTime(0.006, audio.currentTime + 8);
  nodes.push(shimmerGain);

  // Tremolo LFO for "twinkling"
  const tremoloLFO = audio.createOscillator();
  tremoloLFO.type = 'sine';
  tremoloLFO.frequency.value = 0.3; // gentle tremolo
  const tremoloGain = audio.createGain();
  tremoloGain.gain.value = 0.004;
  tremoloLFO.connect(tremoloGain);
  tremoloGain.connect(shimmerGain.gain);
  tremoloLFO.start();

  const shimmer1 = audio.createOscillator();
  shimmer1.type = 'sine';
  shimmer1.frequency.value = 880; // A5

  const shimmer2 = audio.createOscillator();
  shimmer2.type = 'sine';
  shimmer2.frequency.value = 1108; // ~C#6 (major third up)

  if (typeof audio.createStereoPanner === 'function') {
    const sL = audio.createStereoPanner();
    sL.pan.value = -0.5;
    const sR = audio.createStereoPanner();
    sR.pan.value = 0.5;
    shimmer1.connect(sL);
    sL.connect(shimmerGain);
    shimmer2.connect(sR);
    sR.connect(shimmerGain);
  } else {
    shimmer1.connect(shimmerGain);
    shimmer2.connect(shimmerGain);
  }
  shimmerGain.connect(master);
  shimmer1.start();
  shimmer2.start();

  const allOscs = [sub1, sub2, pad1, pad2, shimmer1, shimmer2, filterLFO, tremoloLFO];

  return () => {
    const now = audio.currentTime;
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    padGain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    setTimeout(() => {
      for (const osc of allOscs) {
        try { osc.stop(); } catch { /* already stopped */ }
      }
      droneActive = false;
    }, 2500);
  };
}

/** A recall miss — soft neutral tone, never a "failure" buzz. */
export function playMissTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 330, start: t0, duration: 0.18, peak: 0.045, attack: 0.012, pan: -0.1 });
  voice({ freq: 262, start: t0 + 0.12, duration: 0.24, peak: 0.04, attack: 0.012, pan: 0.1 });
}

/** Hover tick — tiny crystalline ping when gaze lands on an interactable. */
export function playHoverTick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 2400, start: t0, duration: 0.025, peak: 0.025, type: 'sine', attack: 0.002 });
}

let lastGazeTickAt = 0;

/**
 * Gaze locks onto a card — an ultra-soft, near-subliminal tick that marks the
 * moment a card enters the center of view. Deliberately quieter than the
 * hover tick and throttled, so scanning a row never chatters.
 */
export function playGazeFocusTick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const now = performance.now();
  if (now - lastGazeTickAt < 250) {
    return;
  }
  lastGazeTickAt = now;
  const t0 = audio.currentTime;
  voice({ freq: 880, start: t0, duration: 0.02, peak: 0.015, type: 'sine', attack: 0.002 });
}

/** Rewind scrub — short tonal blip, pitched to the timeline position. */
export function playRewindTick(fraction: number): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  // Pitch rises as you scrub forward in time
  const freq = 300 + fraction * 500;
  voice({ freq, start: t0, duration: 0.04, peak: 0.03, type: 'triangle', attack: 0.004 });
}
