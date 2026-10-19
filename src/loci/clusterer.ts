/**
 * Deterministic heuristic organizer — the always-available fallback.
 * Token overlap (Jaccard) + greedy union-find clustering. No model, no
 * latency, never fails: the snap always has something good to show.
 */

export interface NoteInput {
  id: string;
  text: string;
}

export interface ClusterResult {
  label: string;
  noteIds: string[];
  confidence: number;
}

export interface EdgeResult {
  a: string;
  b: string;
  relation: string;
}

export interface OrganizeResult {
  clusters: ClusterResult[];
  edges: EdgeResult[];
  suggestions?: SuggestionResult[];
}

export interface SuggestionResult {
  noteId: string;
  kind: 'expand' | 'challenge';
  text: string;
}

const STOPWORDS = new Set(
  (
    'a an and are as at be but by for from has have i if in into is it its me my no not of on or ' +
    'our so than that the their them then there these they this to too was we what when where ' +
    'which who will with you your about after all also any because can could do does just like ' +
    'more most need now only other out over really should some such thing things think thought ' +
    'thoughts time up very want way well were why would still get got keep made make much next ' +
    'one two three every dont cant wont im ive id doesnt isnt arent wasnt didnt'
  ).split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word,
    );
}

/**
 * Overlap coefficient: |A ∩ B| / min(|A|, |B|). Kinder than Jaccard for
 * short notes — one shared rare word is a genuinely strong signal here.
 */
function similarityOf(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  if (intersection === 0) {
    return 0;
  }
  return intersection / Math.min(a.size, b.size);
}

function bestSharedToken(a: Set<string>, b: Set<string>): string | null {
  let best: string | null = null;
  for (const token of a) {
    if (b.has(token) && (best === null || token.length > best.length)) {
      best = token;
    }
  }
  return best;
}

const MERGE_THRESHOLD = 0.2;
const INTRA_EDGE_THRESHOLD = 0.2;
const CROSS_EDGE_THRESHOLD = 0.15;
const MAX_EDGES = 6;

export function organize(notes: NoteInput[]): OrganizeResult {
  if (notes.length === 0) {
    return { clusters: [], edges: [] };
  }

  const tokens = notes.map((note) => new Set(tokenize(note.text)));

  // Union-find over note indices.
  const parent = notes.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root];
    }
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  };

  // All pairs by descending similarity — stable, deterministic order.
  interface Pair {
    a: number;
    b: number;
    similarity: number;
    shared: string | null;
  }
  const pairs: Pair[] = [];
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const similarity = similarityOf(tokens[i], tokens[j]);
      if (similarity > 0) {
        pairs.push({ a: i, b: j, similarity, shared: bestSharedToken(tokens[i], tokens[j]) });
      }
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity || x.a - y.a || x.b - y.b);

  for (const pair of pairs) {
    if (pair.similarity >= MERGE_THRESHOLD) {
      union(pair.a, pair.b);
    }
  }

  // Collect clusters, ordered by first note appearance for determinism.
  const clusterOrder: number[] = [];
  const clusterMembers = new Map<number, number[]>();
  for (let index = 0; index < notes.length; index += 1) {
    const root = find(index);
    if (!clusterMembers.has(root)) {
      clusterMembers.set(root, []);
      clusterOrder.push(root);
    }
    clusterMembers.get(root)!.push(index);
  }

  const clusters: ClusterResult[] = clusterOrder.map((root) => {
    const members = clusterMembers.get(root)!;
    const memberSets = members.map((index) => tokens[index]);

    // Label: the longest token shared by the most members, else any common
    // token, else a neutral name.
    const frequency = new Map<string, number>();
    for (let m = 0; m < members.length; m += 1) {
      for (const token of memberSets[m]) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
      }
    }
    let labelToken: string | null = null;
    let labelScore = 0;
    for (const [token, count] of frequency) {
      const score = count * 10 + Math.min(token.length, 9);
      if (count >= 2 && score > labelScore) {
        labelScore = score;
        labelToken = token;
      }
    }
    if (labelToken === null && frequency.size > 0) {
      // Single member or no repeats: pick the longest informative token.
      let longest = '';
      for (const token of memberSets[0] ?? []) {
        if (token.length > longest.length) {
          longest = token;
        }
      }
      labelToken = longest || null;
    }
    const label =
      labelToken !== null && labelToken.length >= 4
        ? labelToken.charAt(0).toUpperCase() + labelToken.slice(1)
        : `Thread ${clusterOrder.indexOf(root) + 1}`;

    const similaritySum = pairs
      .filter((pair) => members.includes(pair.a) && members.includes(pair.b))
      .reduce((sum, pair) => sum + pair.similarity, 0);
    const cohesion = members.length > 1 ? similaritySum / (members.length * members.length) : 0.5;
    const confidence = Math.min(0.95, 0.45 + cohesion * 0.5);

    return {
      label,
      noteIds: members.map((index) => notes[index].id),
      confidence,
    };
  });

  // Lines: the constellation's structure — strongest pairs inside each
  // cluster first, then notable threads across clusters.
  const clusterOf = new Map<number, number>();
  clusterOrder.forEach((root, clusterIndex) => {
    for (const memberIndex of clusterMembers.get(root)!) {
      clusterOf.set(memberIndex, clusterIndex);
    }
  });

  const edgeKey = (a: number, b: number): string => `${a}:${b}`;
  const usedPairs = new Set<string>();
  const edges: EdgeResult[] = [];
  const pushEdge = (pair: Pair): void => {
    if (usedPairs.has(edgeKey(pair.a, pair.b))) {
      return;
    }
    usedPairs.add(edgeKey(pair.a, pair.b));
    edges.push({
      a: notes[pair.a].id,
      b: notes[pair.b].id,
      relation: pair.shared !== null ? `both mention "${pair.shared}"` : 'related',
    });
  };

  for (let clusterIndex = 0; clusterIndex < clusterOrder.length; clusterIndex += 1) {
    const intra = pairs.filter(
      (pair) =>
        clusterOf.get(pair.a) === clusterIndex &&
        clusterOf.get(pair.b) === clusterIndex &&
        pair.similarity >= INTRA_EDGE_THRESHOLD,
    );
    for (const pair of intra.slice(0, 2)) {
      if (edges.length >= MAX_EDGES) {
        break;
      }
      pushEdge(pair);
    }
  }

  for (const pair of pairs) {
    if (edges.length >= MAX_EDGES) {
      break;
    }
    if (pair.similarity < CROSS_EDGE_THRESHOLD) {
      break;
    }
    if (clusterOf.get(pair.a) === clusterOf.get(pair.b)) {
      continue;
    }
    pushEdge(pair);
  }

  return { clusters, edges };
}
