/**
 * The universal safety gate — runs on EVERY capture, before the note enters
 * the palace or any model call. A reviewed high-recall trigger list, never
 * the main model: near-zero latency, auditable, fail-toward-showing-resources.
 *
 * The 3D crisis surface itself lives in crisis-panel.ts (in-headset).
 */

export interface DistressCheck {
  flagged: boolean;
}

const TRIGGERS: RegExp[] = [
  /\bsuicid\w*\b/i,
  /\bkill(ing)? (myself|me)\b/i,
  /\bend(ing)? (it all|my life)\b/i,
  /\bwant (to die|to be dead)\b/i,
  /\bbetter off dead\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bno reason to (live|go on)\b/i,
  /\bdo(n'?t| not) want to (be here|live|exist|wake up)\b/i,
  /\btake my (own )?life\b/i,
  /\boverdos(e|ing)\b/i,
  /\bcut(ting)? myself\b/i,
  /\bdon'?t want to be alive\b/i,
];

export function checkDistress(text: string): DistressCheck {
  const flagged = TRIGGERS.some((pattern) => pattern.test(text));
  return { flagged };
}
