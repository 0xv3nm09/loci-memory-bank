/**
 * Sage's model client — calls Vultr Serverless Inference (OpenAI-compatible,
 * always-on serverless). The heuristic organizer always stands behind it:
 * any error, timeout, or malformed response falls back cleanly.
 */

export type { NoteInput } from './clusterer.js';
import type { NoteInput } from './clusterer.js';

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

export interface ModelSuggestion {
  noteId: string;
  kind: 'expand' | 'challenge';
  text: string;
}

export interface ModelOrganizeResult {
  clusters: ModelCluster[];
  edges: ModelEdge[];
  suggestions?: ModelSuggestion[];
}

const VULTR_BASE = 'https://api.vultrinference.com/v1';
const VULTR_KEY = 'GHLQ6JMVJXDO5EO3WGKLPFAVOV3W6YJFGXUQ';
const VULTR_MODEL = 'qwen3.8-flash-next';
const ORGANIZE_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = [
  'You are Sage, the organizing intelligence inside Loci, a spatial thought space.',
  'Group the given thought notes into thematic clusters: 2 to 4 clusters when the material supports it; every note id appears in exactly one cluster.',
  'Give each cluster a short label (one or two words) drawn from the shared theme, in English.',
  'Draw up to 4 edges between notes in DIFFERENT clusters that genuinely relate; set relation to a two-word reason like "same deadline".',
  'Then add up to 2 suggestions: at most one "expand" (offer to take a thin note further, one inviting question) and at most one "challenge" (kindly press on a weak or contradictory note, one honest question). Suggestions are offers, never instructions.',
  'Use EXACTLY the note ids provided — never invent ids. Keep every note text confidential and never add commentary.',
  'Respond with valid JSON matching this schema: { clusters: [{ label: string, noteIds: string[], confidence?: number }], edges?: [{ a: string, b: string, relation?: string }], suggestions?: [{ noteId: string, kind: "expand"|"challenge", text: string }] }',
].join(' ');

export function modelBaseUrl(): string {
  return VULTR_BASE;
}

export function resolveModel(): string {
  return VULTR_MODEL;
}

export function warmupModel(): void {
  // Serverless inference is always warm — no VRAM to preload.
}

async function chat(
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${VULTR_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VULTR_KEY}`,
      },
      body: JSON.stringify({
        model: VULTR_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function organizeOnce(notes: NoteInput[]): Promise<ModelOrganizeResult> {
  const content = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          notes: notes.map((n) => ({ id: n.id, text: n.text })),
        }),
      },
    ],
    ORGANIZE_TIMEOUT_MS,
  );

  let parsed: {
    clusters?: Array<{ label?: unknown; noteIds?: unknown; confidence?: unknown }>;
    edges?: Array<{ a?: unknown; b?: unknown; relation?: unknown }>;
    suggestions?: Array<{ noteId?: unknown; kind?: unknown; text?: unknown }>;
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

  const suggestions: ModelSuggestion[] = [];
  for (const raw of parsed.suggestions ?? []) {
    if (suggestions.length >= 2) {
      break;
    }
    if (
      typeof raw.noteId === 'string' &&
      validIds.has(raw.noteId) &&
      (raw.kind === 'expand' || raw.kind === 'challenge') &&
      typeof raw.text === 'string' &&
      raw.text.trim() !== ''
    ) {
      suggestions.push({
        noteId: raw.noteId,
        kind: raw.kind,
        text: raw.text.trim().slice(0, 160),
      });
    }
  }

  return { clusters, edges, suggestions };
}

/**
 * Ask the model to organize the notes — one fast retry to ride out
 * blips, then the caller's heuristic fallback takes over.
 */
export async function organizeWithModel(notes: NoteInput[]): Promise<ModelOrganizeResult> {
  try {
    return await organizeOnce(notes);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return organizeOnce(notes);
  }
}
