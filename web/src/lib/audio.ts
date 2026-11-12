// Synthesized cues per the art/audio direction: one chord family, soft ramps, no buzzers.
import type { Mode } from "@/lib/loci/seeds";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let droneOn = false;
const layers: Partial<Record<Mode, GainNode>> = {};
let currentMode: Mode = "think";

export function setMuted(m: boolean) { muted = m; if (master && ctx) master.gain.linearRampToValueAtTime(m ? 0 : 1, ctx.currentTime + 0.3); }
function ac() {
  if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination); }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = "sine") {
  const c = ac();
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.05);
}
function osc(freq: number, out: AudioNode, type: OscillatorType = "sine") { const o = ac().createOscillator(); o.type = type; o.frequency.value = freq; o.connect(out); o.start(); return o; }

// Mode overtone layers over a shared drone (A minor-ish family, so switching is a change of light).
function buildLayer(mode: Mode) {
  const c = ac(); const g = c.createGain(); g.gain.value = 0; g.connect(master!);
  if (mode === "think") { osc(329.6, g); osc(440, g); }
  if (mode === "grow") { osc(369.99, g, "triangle"); osc(554.4, g); }
  if (mode === "imagine") {
    osc(392, g);
    const arp = c.createGain(); arp.gain.value = 0; arp.connect(g);
    const o = osc(659.3, arp, "triangle");
    const notes = [659.3, 784, 880, 987.8];
    let i = 0;
    setInterval(() => { const t = c.currentTime; o.frequency.setValueAtTime(notes[i++ % 4]!, t); arp.gain.setValueAtTime(0, t); arp.gain.linearRampToValueAtTime(0.5, t + 0.05); arp.gain.linearRampToValueAtTime(0, t + 1.1); }, 1200);
  }
  layers[mode] = g; return g;
}
export function startDrone() {
  if (droneOn) return; droneOn = true;
  const c = ac(); const g = c.createGain(); g.gain.value = 0; g.connect(master!);
  g.gain.linearRampToValueAtTime(0.025, c.currentTime + 3);
  [110, 164.8, 220.5].forEach((f) => osc(f, g));
  setMode(currentMode, true);
}
export function setMode(mode: Mode, force = false) {
  if (mode === currentMode && !force) return;
  currentMode = mode;
  if (!droneOn) return;
  const c = ac(); const t = c.currentTime;
  (Object.keys(layers) as Mode[]).forEach((m) => { const g = layers[m]!; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(m === mode ? 0.012 : 0, t + 2); });
  const g = layers[mode] ?? buildLayer(mode);
  g.gain.linearRampToValueAtTime(0.012, t + 2);
}
const SNAP: Record<Mode, number[]> = { think: [261.6, 329.6, 392], grow: [220, 277.2, 329.6], imagine: [293.7, 370, 440, 554.4] };
export const sfx = {
  connect: () => { tone(523.2, 0, 0.25, 0.05, "triangle"); tone(659.3, 0.08, 0.25, 0.05, "triangle"); tone(784, 0.16, 0.4, 0.05, "triangle"); },
  place: () => tone(880, 0, 0.12, 0.05, "triangle"),
  snap: () => { SNAP[currentMode].forEach((f, i) => tone(f, i * 0.06, 1.6, 0.07)); tone(SNAP[currentMode][0]! * 2, 0.25, 1.4, 0.04); },
  correct: () => { tone(659.3, 0, 0.35, 0.07); tone(987.8, 0.12, 0.5, 0.07); },
  miss: () => tone(392, 0, 0.5, 0.05),
  due: () => tone(784, 0, 0.9, 0.05),
  welcome: () => { tone(523.2, 0, 1.2, 0.05); tone(784, 0.2, 1.2, 0.05); tone(1046.5, 0.45, 1.4, 0.04); },
  rewind: () => { tone(523.2, 0, 0.3, 0.05); tone(392, 0.1, 0.5, 0.05); },
};
