/**
 * All Loci audio is synthesized with WebAudio — zero assets, zero licensing,
 * always available. One cue each: snap (resolving chord), connect (rising
 * two-note), place (soft click), per the Art & Audio tokens.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function ensureAudio(): AudioContext | null {
  try {
    if (ctx == null) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.75;
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
}

function voice(options: VoiceOptions): void {
  if (ctx == null || master == null) {
    return;
  }
  const { freq, start, duration, peak, type = 'sine', attack = 0.025 } = options;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** The snap: a warm resolving A-major-ish chord with a soft swell. */
export function playSnapChord(delaySeconds = 0.1): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime + delaySeconds;
  voice({ freq: 220, start: t0, duration: 1.6, peak: 0.3 });
  voice({ freq: 277.18, start: t0 + 0.04, duration: 1.5, peak: 0.22 });
  voice({ freq: 329.63, start: t0 + 0.08, duration: 1.4, peak: 0.18 });
  voice({ freq: 440, start: t0 + 0.16, duration: 1.2, peak: 0.09 });
}

let lastConnectAt = 0;

/** A connection line drew in — rising two-note ping, rate-limited. */
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
  voice({ freq: 660, start: t0, duration: 0.12, peak: 0.11, attack: 0.01 });
  voice({ freq: 880, start: t0 + 0.09, duration: 0.16, peak: 0.09, attack: 0.01 });
}

/** A card settles in the hand — soft click. */
export function playPlaceClick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  voice({
    freq: 1180,
    start: audio.currentTime,
    duration: 0.05,
    peak: 0.11,
    type: 'triangle',
    attack: 0.004,
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
  voice({ freq: 196, start: t0, duration: 2.2, peak: 0.07, attack: 0.5 });
  voice({ freq: 246.9, start: t0 + 0.4, duration: 1.8, peak: 0.05, attack: 0.5 });
}

/** A thought materializes — soft rising shimmer, gentle and brief. */
export function playSpawnTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  // Breathy shimmer: two detuned sines that swell and die quickly.
  voice({ freq: 523, start: t0, duration: 0.22, peak: 0.06, attack: 0.04 });
  voice({ freq: 784, start: t0 + 0.05, duration: 0.18, peak: 0.04, attack: 0.03 });
  voice({ freq: 1047, start: t0 + 0.08, duration: 0.12, peak: 0.02, attack: 0.02 });
}

/** Orb press — crisp tick, slightly higher than place click. */
export function playOrbClick(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 1400, start: t0, duration: 0.04, peak: 0.09, type: 'triangle', attack: 0.003 });
  voice({ freq: 2100, start: t0 + 0.02, duration: 0.03, peak: 0.05, type: 'sine', attack: 0.003 });
}

/**
 * Ambient drone — a barely-audible low hum that establishes the "calm dark
 * mind-space." Two detuned oscillators through a heavy lowpass, very quiet.
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

  const droneGain = audio.createGain();
  droneGain.gain.setValueAtTime(0.0001, audio.currentTime);
  droneGain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + 3);

  const lp = audio.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  lp.Q.value = 0.7;

  const osc1 = audio.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 55; // A1

  const osc2 = audio.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 55.6; // slightly detuned — slow beat

  osc1.connect(droneGain);
  osc2.connect(droneGain);
  droneGain.connect(lp);
  lp.connect(master);
  osc1.start();
  osc2.start();

  return () => {
    droneGain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 1);
    setTimeout(() => {
      osc1.stop();
      osc2.stop();
      droneActive = false;
    }, 1200);
  };
}

/** A recall miss — soft neutral tone, never a "failure" buzz. */
export function playMissTone(): void {
  const audio = ensureAudio();
  if (audio == null) {
    return;
  }
  const t0 = audio.currentTime;
  voice({ freq: 330, start: t0, duration: 0.16, peak: 0.045, attack: 0.012 });
  voice({ freq: 262, start: t0 + 0.12, duration: 0.22, peak: 0.04, attack: 0.012 });
}
