// Safety gate: runs on every capture before a note enters the palace. Ported from the Loci repo.
const TRIGGERS: RegExp[] = [
  /\bsuicid\w*\b/i, /\bkill(ing)? (myself|me)\b/i, /\bend(ing)? (it all|my life)\b/i,
  /\bwant (to die|to be dead)\b/i, /\bbetter off dead\b/i, /\bhurt(ing)? myself\b/i,
  /\bself[- ]?harm\b/i, /\bno reason to (live|go on)\b/i,
  /\bdo(n'?t| not) want to (be here|live|exist|wake up)\b/i, /\btake my (own )?life\b/i,
  /\boverdos(e|ing)\b/i, /\bcut(ting)? myself\b/i, /\bdon'?t want to be alive\b/i,
  /\bwish i (was|were) dead\b/i, /\bcan'?t (go on|take it|do this) any ?more\b/i,
  /\bnobody (would|will) (miss|care|notice)\b/i,
];
export const checkDistress = (text: string) => TRIGGERS.some((p) => p.test(text));
