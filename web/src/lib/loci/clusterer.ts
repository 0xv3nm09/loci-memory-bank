// Deterministic heuristic organizer (ported from the Loci repo): overlap similarity + union-find.
export interface NoteInput { id: string; text: string }
export interface Cluster { label: string; noteIds: string[]; confidence: number }
export interface Edge { a: string; b: string; relation: string }
export interface Suggestion { noteId: string; kind: "expand" | "challenge" | "reframe"; text: string }
export interface OrganizeResult { clusters: Cluster[]; edges: Edge[]; suggestions: Suggestion[] }

const STOP = new Set(("a an and are as at be but by for from has have i if in into is it its me my no not of on or our so than that the their them then there these they this to too was we what when where which who will with you your about after all also any because can could do does just like more most need now only other out over really should some such thing things think thought thoughts time up very want way well were why would still get got keep made make much next one two three every always never things dont cant wont im ive id doesnt isnt arent wasnt didnt").split(" "));

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}
function sim(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let n = 0; for (const t of a) if (b.has(t)) n++;
  return n / Math.min(a.size, b.size);
}
function shared(a: Set<string>, b: Set<string>) {
  let best: string | null = null;
  for (const t of a) if (b.has(t) && (!best || t.length > best.length)) best = t;
  return best;
}
export const HARSH = /\b(not good enough|always (quit|fail|mess)\w*|i'?m (so )?(stupid|useless|a failure|hopeless)|i can'?t do anything|i ruin everything)\b/i;
export const MERGE_THRESHOLD = 0.2;
const MAX_EDGES = 24;

export function organize(notes: NoteInput[]): OrganizeResult {
  if (!notes.length) return { clusters: [], edges: [], suggestions: [] };
  // Words found in too many notes ("idea", "work") would chain everything into one blob — ignore them.
  const raw = notes.map((n) => new Set(tokenize(n.text)));
  const df = new Map<string, number>();
  raw.forEach((set) => set.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const tooCommon = (t: string) => notes.length >= 8 && df.get(t)! / notes.length > 0.3;
  const tokens = raw.map((set) => new Set([...set].filter((t) => !tooCommon(t))));
  const parent = notes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const pairs: { a: number; b: number; s: number; w: string | null }[] = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
    const s = sim(tokens[i]!, tokens[j]!);
    if (s > 0) pairs.push({ a: i, b: j, s, w: shared(tokens[i]!, tokens[j]!) });
  }
  pairs.sort((x, y) => y.s - x.s || x.a - y.a || x.b - y.b);
  for (const p of pairs) if (p.s >= MERGE_THRESHOLD) { const ra = find(p.a), rb = find(p.b); if (ra !== rb) parent[rb] = ra; }

  const order: number[] = []; const members = new Map<number, number[]>();
  notes.forEach((_, i) => { const r = find(i); if (!members.has(r)) { members.set(r, []); order.push(r); } members.get(r)!.push(i); });

  const clusters: Cluster[] = order.map((root, ci) => {
    const m = members.get(root)!;
    const freq = new Map<string, number>();
    m.forEach((i) => tokens[i]!.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1)));
    let label: string | null = null, score = 0;
    for (const [t, c] of freq) { const sc = c * 10 + Math.min(t.length, 9); if (c >= 2 && sc > score) { score = sc; label = t; } }
    if (!label) label = [...(tokens[m[0]!] ?? [])].sort((a, b) => b.length - a.length)[0] ?? null;
    const sum = pairs.filter((p) => m.includes(p.a) && m.includes(p.b)).reduce((s, p) => s + p.s, 0);
    const cohesion = m.length > 1 ? sum / (m.length * m.length) : 0.5;
    return {
      label: label && label.length >= 3 ? label[0]!.toUpperCase() + label.slice(1) : `Thread ${ci + 1}`,
      noteIds: m.map((i) => notes[i]!.id),
      confidence: Math.min(0.95, 0.45 + cohesion * 0.5),
    };
  });

  const clusterOf = new Map<number, number>();
  order.forEach((r, ci) => members.get(r)!.forEach((i) => clusterOf.set(i, ci)));
  const used = new Set<string>(); const edges: Edge[] = [];
  const push = (p: (typeof pairs)[number]) => {
    const k = `${p.a}:${p.b}`; if (used.has(k) || edges.length >= MAX_EDGES) return; used.add(k);
    edges.push({ a: notes[p.a]!.id, b: notes[p.b]!.id, relation: p.w ? `both mention "${p.w}"` : "related" });
  };
  order.forEach((_, ci) => pairs.filter((p) => clusterOf.get(p.a) === ci && clusterOf.get(p.b) === ci && p.s >= 0.2).slice(0, 3).forEach(push));
  for (const p of pairs) { if (p.s < 0.15) break; if (clusterOf.get(p.a) !== clusterOf.get(p.b)) push(p); }

  // Suggestions: expand the biggest cluster, challenge a confident-sounding note.
  const suggestions: Suggestion[] = [];
  const big = [...clusters].sort((a, b) => b.noteIds.length - a.noteIds.length)[0];
  if (big && big.noteIds.length >= 2) suggestions.push({ noteId: big.noteIds[0]!, kind: "expand", text: `What's the next step for "${big.label}"?` });
  const bold = notes.find((n) => /\b(always|never|must|everyone|nobody|definitely)\b/i.test(n.text));
  if (bold) suggestions.push({ noteId: bold.id, kind: "challenge", text: "Is this always true? What's one exception?" });
  const harsh = notes.find((n) => HARSH.test(n.text));
  if (harsh) suggestions.push({ noteId: harsh.id, kind: "reframe", text: "That's pretty harsh on yourself. Another way to see it: one moment isn't the whole story — you showed up." });
  return { clusters, edges, suggestions };
}
