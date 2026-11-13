# Vultr Serverless Inference — Integration Guide for Loci

## Why switch

Loci's Sage AI currently calls a self-hosted Ollama instance (`ollama.youtubeccanalyzer.com`) running `qwen3:14b`. This works when the GPU is on, but if it's off or cold-starting, the model is unreachable and every organize falls back to the heuristic. Vultr Serverless Inference is always on, pay-per-token, and already on the same network (Vultr → Vultr), so latency stays minimal.

**What stays the same:** The heuristic fallback in `clusterer.ts` is untouched — it still catches any failure. The `organize-system.ts` flow doesn't change. Only `model-client.ts` gets modified.

---

## Step 1 — Create a Vultr Serverless Inference subscription

1. Log in to [Vultr Console](https://my.vultr.com/)
2. Go to **Compute → Serverless Inference**
3. Click **Create Inference**
4. Enter a label (e.g. `loci-sage`)
5. Acknowledge the usage-based billing and click **Create Inference**
6. Wait for status to show **Active**

## Step 2 — Get your API key

1. Open the subscription you just created
2. On the **Overview** tab, find the **API Key** section
3. Click **Copy API Key** — save this, you'll need it

Your endpoint is: `https://api.vultrinference.com/v1`

## Step 3 — Pick a model

Vultr offers these relevant models (as of Nov 2026):

| Model ID | Context | Input cost | Output cost | Notes |
|---|---|---|---|---|
| `vultr/qwen3.8-flash-next` | 262K | $0.10/M | $0.20/M | **Recommended** — cheapest, fast, Qwen family |
| `vultr/qwen3.8-27b` | 262K | $0.15/M | $1.00/M | Larger Qwen, better clustering quality |
| `vultr/deepseek-v4.1-flash` | 1M | $0.15/M | $0.60/M | Good alternative |

**Recommendation:** Start with `vultr/qwen3.8-flash-next` — it's the cheapest at $0.10/$0.20 per million tokens. Loci's organize calls are small (a handful of notes, ~200-500 tokens per call), so cost will be negligible even with heavy use.

---

## Step 4 — Code changes

Only **one file** needs to change: `src/loci/model-client.ts`

### Current flow (Ollama)

```
model-client.ts
  ├── modelBaseUrl() → "https://ollama.youtubeccanalyzer.com"
  ├── resolveModel() → GET /api/tags → finds "qwen3:14b"
  ├── warmupModel() → POST /api/chat (1 token, keeps model in VRAM)
  └── organizeWithModel() → POST /api/chat (structured JSON output)
        ↓
organize-system.ts
  ├── calls organize() from clusterer.ts (heuristic, instant)
  ├── calls organizeWithModel() (AI, async)
  └── uses whichever covers more notes
```

### New flow (Vultr Inference)

```
model-client.ts
  ├── modelBaseUrl() → "https://api.vultrinference.com/v1"
  ├── resolveModel() → returns configured model string directly
  ├── warmupModel() → no-op (serverless, always warm)
  └── organizeWithModel() → POST /v1/chat/completions (OpenAI format)
        ↓
organize-system.ts
  ├── (unchanged)
  └── (unchanged)
```

### The diff

Replace the contents of `src/loci/model-client.ts` with:

```typescript
/**
 * Sage's model client — calls Vultr Serverless Inference (OpenAI-compatible).
 * The heuristic organizer always stands behind it: any error, timeout, or
 * malformed response falls back cleanly.
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

// ── Configuration ──────────────────────────────────────────────────────
// Option A: hardcode (simple, fine for a competition entry)
// Option B: ?vultr_key= query param or localStorage (for local dev)

const VULTR_BASE = 'https://api.vultrinference.com/v1';
const VULTR_MODEL = 'vultr/qwen3.8-flash-next'; // cheapest Qwen on Vultr
const ORGANIZE_TIMEOUT_MS = 30000;

function getApiKey(): string {
  try {
    // Check URL param first (for dev/testing)
    const override = new URLSearchParams(window.location.search).get('vultr_key');
    if (override) return override;
    // Then localStorage
    const stored = localStorage.getItem('loci.vultr_key');
    if (stored) return stored;
  } catch {
    // storage blocked
  }
  // Fallback: hardcoded key (replace with your actual key)
  return 'YOUR_VULTR_API_KEY_HERE';
}

export function modelBaseUrl(): string {
  return VULTR_BASE;
}

async function fetchChat(
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
        'Authorization': `Bearer ${getApiKey()}`,
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
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/** No-op for serverless — the model is always warm. */
export async function resolveModel(): Promise<string | null> {
  return VULTR_MODEL;
}

/** No-op for serverless — no VRAM to pre-load. */
export function warmupModel(): void {
  // Serverless inference is stateless — no warmup needed.
}

const SYSTEM_PROMPT = [
  'You are Sage, the organizing intelligence inside Loci, a spatial thought space.',
  'Group the given thought notes into thematic clusters: 2 to 4 clusters when the material supports it; every note id appears in exactly one cluster.',
  'Give each cluster a short label (one or two words) drawn from the shared theme, in English.',
  'Draw up to 4 edges between notes in DIFFERENT clusters that genuinely relate; set relation to a two-word reason like "same deadline".',
  'Then add up to 2 suggestions: at most one "expand" (offer to take a thin note further, one inviting question) and at most one "challenge" (kindly press on a weak or contradictory note, one honest question). Suggestions are offers, never instructions.',
  'Use EXACTLY the note ids provided — never invent ids. Keep every note text confidential and never add commentary.',
  'Respond with valid JSON matching this schema: { clusters: [{ label: string, noteIds: string[], confidence?: number }], edges?: [{ a: string, b: string, relation?: string }], suggestions?: [{ noteId: string, kind: "expand"|"challenge", text: string }] }',
].join(' ');

async function organizeOnce(notes: NoteInput[]): Promise<ModelOrganizeResult> {
  const content = await fetchChat(
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
    if (suggestions.length >= 2) break;
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
```

---

## Step 5 — Set your API key

You have three options (pick one):

### Option A: Hardcode (quickest for competition)
Replace `'YOUR_VULTR_API_KEY_HERE'` in the code above with your actual Vultr API key.

> ⚠️ **Don't commit this to a public repo.** Use Option B or C for anything public.

### Option B: URL parameter (for testing)
Leave the fallback as-is and pass the key in the URL:
```
https://your-app.com/?vultr_key=YOUR_KEY_HERE
```

### Option C: localStorage (for deployed app)
Open browser console on your deployed app and run:
```javascript
localStorage.setItem('loci.vultr_key', 'YOUR_KEY_HERE');
```
The key persists across sessions. Clear with `localStorage.removeItem('loci.vultr_key')`.

---

## Step 6 — CORS

Vultr's inference API at `api.vultrinference.com` supports CORS for browser requests. If you hit CORS errors (unlikely), you have two options:

1. **Proxy through your Vultr server** — add a tiny endpoint on your existing Vultr server that forwards requests to `api.vultrinference.com` with the API key in the server-side header (also hides the key from the browser).

2. **Use Vite's dev proxy** — in `vite.config.ts`:
   ```typescript
   server: {
     proxy: {
       '/vultr-api': {
         target: 'https://api.vultrinference.com',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/vultr-api/, ''),
       },
     },
   }
   ```

---

## What changed, what didn't

| Component | Before (Ollama) | After (Vultr) |
|---|---|---|
| **Endpoint** | `https://ollama.youtubeccanalyzer.com/api/chat` | `https://api.vultrinference.com/v1/chat/completions` |
| **Auth** | None (public endpoint) | Bearer token in `Authorization` header |
| **Model** | `qwen3:14b` (auto-discovered via `/api/tags`) | `vultr/qwen3.8-flash-next` (hardcoded) |
| **Request format** | Ollama native (`model`, `messages`, `format`) | OpenAI-compatible (`model`, `messages`, `response_format`) |
| **Warmup** | Needed (loads model into VRAM) | Not needed (serverless) |
| **JSON mode** | Ollama `format` schema object | OpenAI `response_format: { type: "json_object" }` |
| **Fallback** | Heuristic in `clusterer.ts` | **Unchanged** — same heuristic |
| **organize-system.ts** | — | **Unchanged** |
| **Cost** | GPU instance (always running) | ~$0.10-0.20 per million tokens |
| **Availability** | Depends on GPU being on | Always on |

---

## Cost estimate

A typical Loci organize call sends ~300 tokens in and gets ~400 tokens back. At `vultr/qwen3.8-flash-next` pricing ($0.10/$0.20 per million tokens):

- **Per organize:** ~$0.00011 (essentially free)
- **100 organizes/day:** ~$0.011/day → ~$0.33/month
- **Heavy use (500/day):** ~$1.65/month

Compare this to keeping a GPU instance running 24/7 for occasional calls.

---

## Quick test

After making the changes, open the app in a browser and check the console:

1. Capture 3+ thoughts
2. Hit the Organize orb
3. Watch for:
   - `"Sage organized your thoughts."` → Vultr is working
   - `"Sage couldn't reach the model — organized locally instead."` → check API key / network
4. The orb glows **gold** for Sage, **gray** for heuristic fallback

You can also test the endpoint directly:
```bash
curl -X POST https://api.vultrinference.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "vultr/qwen3.8-flash-next",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 50
  }'
```

---

## Switching back to Ollama

If your GPU is back and you want Ollama again, revert `model-client.ts` to the original or use the URL override that already exists in the current code:
```
https://your-app.com/?ollama=https://ollama.youtubeccanalyzer.com
```

---

## Sources

- [Vultr Serverless Inference — Chat Endpoint](https://docs.vultr.com/products/serverless/inference/management/usage/chat)
- [Vultr Serverless Inference — API Key](https://docs.vultr.com/products/serverless/inference/management/connection/)
- [Vultr Serverless Inference — Provisioning](https://docs.vultr.com/products/compute/serverless-inference/provisioning.md)
- [Vultr Model Pricing (via Mastra)](https://mastra.ai/models/providers/vultr/llms.txt)
