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
  /\bwish i (was|were) dead\b/i,
  /\bcan'?t (go on|take it|do this) any ?more\b/i,
  /\bnobody (would|will) (miss|care|notice)\b/i,
  /\bhang myself\b/i,
  /\bend it all\b/i,
  /\bnot want to (be here|live|exist)\b/i,
];

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

export function checkDistress(rawText: string): DistressCheck {
  const text = normalize(rawText);
  const flagged = TRIGGERS.some((pattern) => pattern.test(text));
  return { flagged };
}
