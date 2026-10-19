/**
 * Sage's model client — calls the user's public Ollama endpoint directly from
 * the browser (no backend, no keys). The heuristic organizer always stands
 * behind it: any error, timeout, or malformed response falls back cleanly.
 */

export interface NoteInput {
  id: string;
  text: string;
}

export interface ModelCluster {
  label: string;
  noteIds: string[];
  confidence: number;
}

export interface ModelEdge {
  a: string;
  b: string;
  relation: string;
}

export interface ModelOrganizeResult {
  clusters: ModelCluster[];
  edges: ModelEdge[];
}

const DEFAULT_BASE = 'https://ollama.youtubeccanalyzer.com';
const HEALTH_TIMEOUT_MS = 4000;
const ORGANIZE_TIMEOUT_MS = 20000;

export function modelBaseUrl(): string {
  try {
    const override = new URLSearchParams(window.location.search).get('ollama');
    if (override != null && override !== '') {
      return override;
    }
    const stored = localStorage.getItem('loci.ollama');
    if (stored != null && stored !== '') {
      return stored;
    }
  } catch {
    // storage blocked — default
  }
  return DEFAULT_BASE;
}

async function fetchJson(path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${modelBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

let cachedModel: string | null = null;

/** Prefer a Qwen model; otherwise the first model the server offers. */
export async function resolveModel(): Promise<string | null> {
  if (cachedModel != null) {
    return cachedModel;
  }
  try {
    const data = (await fetchJson('/api/tags', { method: 'GET' }, HEALTH_TIMEOUT_MS)) as {
      models?: Array<{ name?: string }>;
    };
    const names = (data.models ?? []).map((m) => m.name ?? '').filter((n) => n !== '');
    if (names.length === 0) {
      return null;
    }
    cachedModel = names.find((n) => n.toLowerCase().startsWith('qwen')) ?? names[0];
    return cachedModel;
  } catch {
    return null;
  }
}

const ORGANIZE_SCHEMA = {
  type: 'object',
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          noteIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
        required: ['label', 'noteIds'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'string' },
          relation: { type: 'string' },
        },
        required: ['a', 'b'],
      },
    },
  },
  required: ['clusters'],
} as const;

const SYSTEM_PROMPT = [
  'You are Sage, the organizing intelligence inside Loci, a spatial thought space.',
  'Group the given thought notes into thematic clusters: 2 to 4 clusters when the material supports it; every note id appears in exactly one cluster.',
  'Give each cluster a short label (one or two words) drawn from the shared theme, in English.',
  'Draw up to 4 edges between notes in DIFFERENT clusters that genuinely relate; set relation to a two-word reason like "same deadline".',
  'Use EXACTLY the note ids provided — never invent ids. Keep every note text confidential and never add commentary.',
].join(' ');

/**
 * Ask the model to organize the notes. Validates and sanitizes the response;
 * ids that do not exist are dropped, leftover notes are swept into a final
 * cluster so the snap always has a home for every thought.
 */
export async function organizeWithModel(notes: NoteInput[]): Promise<ModelOrganizeResult> {
  const model = await resolveModel();
  if (model == null) {
    throw new Error('no model available');
  }
  const data = (await fetchJson(
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: ORGANIZE_SCHEMA,
        options: { temperature: 0.2, num_ctx: 4096 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              notes: notes.map((n) => ({ id: n.id, text: n.text })),
            }),
          },
        ],
      }),
    },
    ORGANIZE_TIMEOUT_MS,
  )) as { message?: { content?: string } };

  const content = data.message?.content ?? '';
  let parsed: {
    clusters?: Array<{ label?: unknown; noteIds?: unknown; confidence?: unknown }>;
    edges?: Array<{ a?: unknown; b?: unknown; relation?: unknown }>;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('model returned non-JSON');
  }

  const validIds = new Set(notes.map((n) => n.id));
  const clusters: ModelCluster[] = [];
  const covered = new Set<string>();
  for (const raw of parsed.clusters ?? []) {
    const label = typeof raw.label === 'string' ? raw.label : '';
    const noteIds = Array.isArray(raw.noteIds)
      ? raw.noteIds.filter(
          (id): id is string => typeof id === 'string' && validIds.has(id) && !covered.has(id),
        )
      : [];
    if (label === '' || noteIds.length === 0) {
      continue;
    }
    for (const id of noteIds) {
      covered.add(id);
    }
    const confidence =
      typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.8;
    clusters.push({ label: label.slice(0, 24), noteIds, confidence });
  }
  if (clusters.length === 0) {
    throw new Error('model organized nothing usable');
  }
  const leftovers = notes.filter((n) => !covered.has(n.id)).map((n) => n.id);
  if (leftovers.length > 0) {
    clusters.push({
      label: 'Loose threads',
      noteIds: leftovers,
      confidence: 0.4,
    });
  }

  const edges: ModelEdge[] = [];
  for (const raw of parsed.edges ?? []) {
    if (
      typeof raw.a === 'string' &&
      typeof raw.b === 'string' &&
      validIds.has(raw.a) &&
      validIds.has(raw.b) &&
      raw.a !== raw.b &&
      edges.length < 6
    ) {
      edges.push({
        a: raw.a,
        b: raw.b,
        relation: typeof raw.relation === 'string' ? raw.relation.slice(0, 40) : 'related',
      });
    }
  }

  return { clusters, edges };
}
