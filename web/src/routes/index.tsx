import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Starfield } from "@/components/loci/Starfield";
import { Overlay } from "@/components/loci/Overlay";
import { Intro } from "@/components/loci/Intro";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mic, Settings as SettingsIcon, CircleHelp } from "lucide-react";
import { CLUSTER_ACCENTS } from "@/lib/palette";
import { sfx, setMode as setAudioMode, setMuted, startDrone } from "@/lib/audio";
import { emptyStats, isReturning, recordRemembered, recordVisit, rememberedThisWeek, streak, type Stats } from "@/lib/loci/stats";
import { organize, type Edge, type Suggestion } from "@/lib/loci/clusterer";
import { checkDistress } from "@/lib/loci/distress";
import { isDue, queue, review } from "@/lib/loci/recall";
import { MODES, SAGE, SEEDS, pick, type Mode } from "@/lib/loci/seeds";
import { tokenize } from "@/lib/loci/clusterer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loci — spatial memory bank" },
      { name: "description", content: "Dump scattered thoughts into a calm void and watch them snap into organized clusters you can recall." },
      { property: "og:title", content: "Loci — spatial memory bank" },
      { property: "og:description", content: "Capture, organize and recall your thoughts in a calm memory palace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Note = { id: string; text: string; x: number; y: number; cluster: number | null; box: number; dueAt: number; pinned?: boolean };
type Region = { label: string; x: number; y: number; r: number; confidence: number };
type Palace = { notes: Note[]; regions: Region[]; edges: (Edge & { cross: boolean })[]; suggestions: Suggestion[] };
type State = Record<Mode, Palace>;
type Settings = { scale: 1 | 1.25 | 1.5; sound: boolean };

const KEY = "loci-palace-v2";
const ONBOARD_KEY = "loci-onboarded";
const SETTINGS_KEY = "loci-settings";
const STATS_KEY = "loci-stats";
const HISTORY_KEY = "loci-history";
const empty = (): Palace => ({ notes: [], regions: [], edges: [], suggestions: [] });
const blank = (): State => ({ think: empty(), grow: empty(), imagine: empty() });

const STEPS = [
  { title: "Capture a thought", desc: "Type anything below and press Add — or tap the mic to speak. Each thought lands as a soft card in your palace." },
  { title: "Organize", desc: "Press Organize. Sage groups your notes into glowing clusters, draws links, and offers ideas (green) or gentle pushback (amber)." },
  { title: "Recall & Rewind", desc: "Come back later and press Recall — your weakest notes come first. Rewind lets you scrub back through every change." },
];

function layout(notes: Note[]): Palace {
  const res = organize(notes);
  const n = res.clusters.length;
  const total = Math.max(notes.length, 1);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.ceil(n / cols);
  const byId = new Map(notes.map((x) => [x.id, x]));
  const out: Note[] = [];
  const regions: Region[] = [];
  const compact = notes.length > 24;
  res.clusters.forEach((c, ci) => {
    const cx = 12 + ((ci % cols) + 0.5) * (76 / cols);
    const cy = 16 + (Math.floor(ci / cols) + 0.5) * (60 / rows);
    const cellR = Math.min(76 / cols, 60 / rows) / 2;
    const k = c.noteIds.length;
    // Small clusters sit on a ring; big ones spiral outward (golden angle) so cards don't stack.
    const spread = k > 1 ? Math.min(cellR * 0.9, (compact ? 2.4 : 6) + Math.sqrt(k) * (compact ? 1.6 : 2.4)) : 0;
    regions.push({ label: c.label, x: cx, y: cy, r: spread + 8, confidence: c.confidence });
    c.noteIds.forEach((id, i) => {
      const note = byId.get(id)!;
      const ring = k <= 7;
      const a = ring ? (i / k) * Math.PI * 2 - Math.PI / 2 : i * 2.39996;
      const r = ring ? spread : spread * Math.sqrt((i + 0.5) / k);
      const placed = note.pinned && note.cluster === ci;
      out.push({ ...note, cluster: ci, x: placed ? note.x : cx + Math.cos(a) * r, y: placed ? note.y : cy + Math.sin(a) * r * 1.2 });
    });
  });
  void total;
  // Relaxation: nudge overlapping cards apart (card ≈ 12% × 7% of the screen; smaller when compact).
  const W = compact ? 10 : 15, H = compact ? 4.2 : 8;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const ox = W - Math.abs(dx), oy = H - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        moved = true;
        if (ox / W < oy / H) { const m = (ox / 2) * Math.sign(dx || 1); if (!a.pinned) a.x -= m; if (!b.pinned) b.x += m; }
        else { const m = (oy / 2) * Math.sign(dy || 1); if (!a.pinned) a.y -= m; if (!b.pinned) b.y += m; }
      }
    }
    out.forEach((n) => { n.x = Math.max(7, Math.min(93, n.x)); n.y = Math.max(10, Math.min(80, n.y)); });
    if (!moved) break;
  }
  const clusterOf = new Map(out.map((x) => [x.id, x.cluster]));
  return { notes: out, regions, edges: res.edges.map((e) => ({ ...e, cross: clusterOf.get(e.a) !== clusterOf.get(e.b) })), suggestions: res.suggestions };
}

function Index() {
  const [splash, setSplash] = useState(true);
  const [state, setState] = useState<State>(blank);
  const [mode, setMode] = useState<Mode>("think");
  const [history, setHistory] = useState<State[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [onboard, setOnboard] = useState<number | null>(null);
  const [intro, setIntro] = useState(false);
  const [panel, setPanel] = useState<null | "help" | "settings" | "rewind" | "crisis">(null);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [bloom, setBloom] = useState(0);
  const [settings, setSettings] = useState<Settings>({ scale: 1, sound: true });
  const [recall, setRecall] = useState<{ ids: string[]; i: number; revealed: boolean; score: number } | null>(null);
  const [rewindAt, setRewindAt] = useState(0);
  const [openBud, setOpenBud] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [welcome, setWelcome] = useState(false);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [sage, setSage] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const mobile = useIsMobile();
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const palace = state[mode];
  const view = panel === "rewind" && rewindAt < history.length ? history[rewindAt]![mode] : palace;

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY); if (s) setState({ ...blank(), ...JSON.parse(s) });
      const h = localStorage.getItem(HISTORY_KEY); if (h) setHistory(JSON.parse(h));
      const st = localStorage.getItem(SETTINGS_KEY); if (st) setSettings(JSON.parse(st));
    } catch {}
    let loaded = emptyStats();
    try { const raw = localStorage.getItem(STATS_KEY); if (raw) loaded = JSON.parse(raw); } catch {}
    const returning = isReturning(loaded);
    setStats(recordVisit(loaded));
    const t = setTimeout(() => { setSplash(false); if (!localStorage.getItem(ONBOARD_KEY)) setIntro(true); else if (returning) setWelcome(true); }, 1700);
    return () => clearTimeout(t);
  }, []);
  const loaded = useRef(false);
  useEffect(() => { if (!loaded.current) { loaded.current = true; return; } localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { if (history.length) try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { setHistory((h) => h.slice(-10)); } }, [history]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); setMuted(!settings.sound); }, [settings]);
  useEffect(() => { if (stats.lastVisit) localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }, [stats]);
  useEffect(() => { if (!sage) return; const t = setTimeout(() => setSage(null), 4200); return () => clearTimeout(t); }, [sage]);
  useEffect(() => { if (!status) return; const t = setTimeout(() => setStatus(""), 2800); return () => clearTimeout(t); }, [status]);

  const commit = (next: Palace) => { setHistory((h) => [...h.slice(-40), state]); setState((s) => ({ ...s, [mode]: next })); };
  const sound = (fn: () => void) => { startDrone(); fn(); };

  const capture = (texts: string[]) => {
    const clean = texts.map((t) => t.trim()).filter(Boolean);
    if (!clean.length) return;
    if (clean.some(checkDistress)) { setPanel("crisis"); setInput(""); sound(sfx.miss); return; }
    const now = Date.now();
    const added: Note[] = clean.map((t) => ({ id: crypto.randomUUID(), text: t.slice(0, 140), x: 20 + Math.random() * 60, y: 18 + Math.random() * 50, cluster: null, box: 0, dueAt: now }));
    commit({ ...palace, notes: [...palace.notes, ...added] });
    setInput("");
    setFocus({ x: added[added.length - 1]!.x, y: added[added.length - 1]!.y });
    sound(sfx.place);
    setSage(pick(SAGE[mode].capture));
    setStatus(clean.length > 1 ? `${clean.length} thoughts spilled into the void` : "Thought captured");
  };

  const doOrganize = () => {
    if (palace.notes.length < 2) return setStatus("Capture a couple of thoughts first");
    setThinking(true);
    setTimeout(() => {
      const next = layout(palace.notes);
      commit(next);
      const big = [...next.regions].sort((a, b) => b.r - a.r)[0];
      if (big) setFocus({ x: big.x, y: big.y });
      setThinking(false);
      sound(sfx.snap); setBloom((b) => b + 1);
      setSage(pick(SAGE[mode].snap));
      setStatus("Snapped into place — drag anything, double-click two cards to link them");
    }, 900);
  };

  const startRecall = () => {
    const q = queue(palace.notes).slice(0, 5);
    if (!q.length) { const next = Math.min(...palace.notes.map((n) => n.dueAt)); return setStatus(palace.notes.length ? `Nothing due — next visit ${new Date(next).toLocaleDateString()}` : "Capture some thoughts first"); }
    sound(sfx.due);
    setSage("Let's walk it. What connects to this?");
    setRecall({ ids: q.map((n) => n.id), i: 0, revealed: false, score: 0 });
  };
  const answer = (ok: boolean) => {
    if (!recall) return;
    const id = recall.ids[recall.i];
    setState((s) => ({ ...s, [mode]: { ...s[mode], notes: s[mode].notes.map((n) => (n.id === id ? review(n, ok) : n)) } }));
    sound(ok ? sfx.correct : sfx.miss);
    if (ok) setStats((st) => recordRemembered(st));
    setSage(ok ? "You've got it." : "No worries — I'll bring it back soon.");
    const score = recall.score + (ok ? 1 : 0);
    if (recall.i + 1 >= recall.ids.length) { setRecall(null); setTimeout(() => setSage("Come back tomorrow — I'll keep it fresh."), 1200); setStatus(`Recall done — ${score}/${recall.ids.length} remembered`); }
    else setRecall({ ...recall, i: recall.i + 1, revealed: false, score });
  };

  const openRewind = () => { if (!history.length) return setStatus("Nothing to rewind yet"); setRewindAt(history.length); setPanel("rewind"); };
  const scrub = (v: number) => { if (v < rewindAt) sfx.rewind(); else if (v > rewindAt) sfx.place(); setRewindAt(v); };
  const confirmRewind = () => {
    if (rewindAt < history.length) { setState(history[rewindAt]!); setHistory((h) => h.slice(0, rewindAt)); setStatus(`Rewound ${history.length - rewindAt} step${history.length - rewindAt > 1 ? "s" : ""}`); }
    setPanel(null);
  };

  const voice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setStatus("Voice isn't available here — typing works just as well");
    const r = new SR();
    r.onresult = (e: any) => capture([e.results[0][0].transcript]);
    r.onerror = () => setStatus("Couldn't hear that — try typing instead");
    r.onend = () => setListening(false);
    setListening(true); r.start();
  };

  const acceptBud = (s: Suggestion) => {
    commit({ ...palace, suggestions: palace.suggestions.filter((x) => x !== s), notes: [...palace.notes, { id: crypto.randomUUID(), text: s.text, x: 50, y: 40, cluster: null, box: 0, dueAt: Date.now() }] });
    setOpenBud(null); sound(sfx.place);
  };
  const dismissBud = (s: Suggestion) => { setState((st) => ({ ...st, [mode]: { ...palace, suggestions: palace.suggestions.filter((x) => x !== s) } })); setOpenBud(null); };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    d.moved = true;
    const bounds = board.current?.getBoundingClientRect(); if (!bounds) return;
    const x = Math.max(7, Math.min(93, ((e.clientX - bounds.left) / bounds.width) * 100 - d.dx)), y = Math.max(10, Math.min(80, ((e.clientY - bounds.top) / bounds.height) * 100 - d.dy));
    setState((s) => ({ ...s, [mode]: { ...s[mode], notes: s[mode].notes.map((n) => (n.id === d.id ? { ...n, x, y, pinned: true } : n)) } }));
  };
  const onUp = () => { if (drag.current?.moved) { sfx.place(); setHistory((h) => [...h.slice(-40), state]); setSage("Saved. It's yours now."); } drag.current = null; };
  const linkTap = (id: string) => {
    if (!linking) { setLinking(id); setStatus("Now double-click another card to link it"); return; }
    if (linking !== id && !palace.edges.some((e) => (e.a === linking && e.b === id) || (e.a === id && e.b === linking))) {
      const na = palace.notes.find((n) => n.id === linking), nb = palace.notes.find((n) => n.id === id);
      commit({ ...palace, edges: [...palace.edges, { a: linking, b: id, relation: "you linked these", cross: na?.cluster !== nb?.cluster }] });
      sound(sfx.connect); setSage("Nice — that connects.");
    }
    setLinking(null);
  };
  const nudge = (id: string, dx: number, dy: number) => setState((s) => ({ ...s, [mode]: { ...s[mode], notes: s[mode].notes.map((n) => (n.id === id ? { ...n, x: Math.max(4, Math.min(96, n.x + dx)), y: Math.max(8, Math.min(88, n.y + dy)), pinned: true } : n)) } }));

  const closeOnboard = () => { setOnboard(null); localStorage.setItem(ONBOARD_KEY, "1"); };
  const switchMode = (m: Mode) => { if (m === mode) return; setMode(m); setRecall(null); setFocus(null); setLinking(null); setAudioMode(m); sound(sfx.due); if (state[m].notes.length) setSage(SAGE[m].switch); setStatus(`${MODES.find((x) => x.id === m)!.label} — ${MODES.find((x) => x.id === m)!.hint.toLowerCase()}`); };

  const dueCount = palace.notes.filter((n) => isDue(n)).length;
  const mobileHeight = Math.max(400, view.notes.length * 180 + 140);
  const displayNotes = useMemo(() => mobile ? [...view.notes].sort((a, b) => (a.cluster ?? 999) - (b.cluster ?? 999)).map((note, i) => ({ ...note, x: 50, y: (i * 180 + 130) / mobileHeight * 100 })) : view.notes, [view.notes, mobile, mobileHeight]);
  const recallId = recall?.ids[recall.i];
  const recallNote = displayNotes.find((n) => n.id === recallId);
  const recallPrev = recall && recall.i > 0 ? displayNotes.find((n) => n.id === recall.ids[recall.i - 1]) : undefined;
  const noteById = useMemo(() => new Map(displayNotes.map((n) => [n.id, n])), [displayNotes]);
  useEffect(() => { if (!mobile || !recallId) return; board.current?.querySelector<HTMLElement>(`[data-note-id="${recallId}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [mobile, recallId]);
  const allDue = (Object.keys(state) as Mode[]).reduce((n, m) => n + state[m].notes.filter((x) => isDue(x)).length, 0);
  const days = streak(stats);
  const mastery = palace.notes.length ? Math.round((palace.notes.filter((n) => n.box >= 3).length / palace.notes.length) * 100) : 0;
  // Cross-mode threads: notes in other rooms that share words with each cluster.
  const crossLinks = useMemo(() => view.regions.map((_, ci) => {
    const words = new Set(view.notes.filter((n) => n.cluster === ci).flatMap((n) => tokenize(n.text)));
    return (Object.keys(state) as Mode[]).filter((m) => m !== mode).map((m) => ({ m, n: state[m].notes.filter((o) => tokenize(o.text).some((w) => words.has(w))).length })).filter((x) => x.n > 0);
  }), [view, state, mode]);
  const weekly = rememberedThisWeek(stats);
  const glowAt = recallNote ? { x: recallNote.x, y: recallNote.y } : focus;
  const modeVar = { think: "var(--mode-think)", grow: "var(--mode-grow)", imagine: "var(--mode-imagine)" } as const;

  return (
    <main className="loci-app relative h-dvh w-full overflow-hidden bg-background" style={{ ["--note-scale" as string]: settings.scale }} onPointerMove={onMove} onPointerUp={onUp}>
      <Starfield />

      <div className="palace-viewport" aria-label="Memory palace">
      <div ref={board} style={{ ["--mobile-board-height" as string]: `${view.notes.length ? mobileHeight : 0}px` }} className={`palace-board ${view.notes.length > 24 ? "palace-board-dense" : ""}`}>
      {/* Sage: a warm ambient presence that drifts to whatever it's touching */}
      <div className={`sage-glow pointer-events-none absolute ${glowAt ? "opacity-100" : "opacity-0"}`} style={{ left: `${glowAt?.x ?? 50}%`, top: `${glowAt?.y ?? 45}%` }} aria-hidden />

      {sage && (
        <div key={sage} className="sage-line pointer-events-none absolute z-20 max-w-[260px] -translate-x-1/2 text-center rounded-full border border-border bg-glass px-4 py-1.5 text-sm font-medium text-foreground backdrop-blur-md"
          style={{ left: "50%", top: "1%" }} role="status">
          <span className="mr-2 text-[var(--sage)]">✦</span>{sage}
        </div>
      )}

      {/* Cluster regions */}
      {view.regions.map((r, i) => (
        <div key={`${bloom}-${i}`} className="region pointer-events-none absolute" style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.r * 2}vw`, height: `${r.r * 2}vw`, ["--rc" as string]: CLUSTER_ACCENTS[i % CLUSTER_ACCENTS.length], transform: "translate(-50%,-50%)" }}>
        </div>
      ))}

      {view.regions.map((r, i) => (
        <span key={`t${bloom}-${i}`} className="bud pointer-events-none absolute z-[7] max-w-[220px] -translate-x-1/2 text-center rounded-full bg-background/70 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ left: `${mobile ? 50 : r.x}%`, top: `${Math.max(2, Math.min(...displayNotes.filter((n) => n.cluster === i).map((n) => n.y)) - (mobile ? 70 / mobileHeight * 100 : 10))}%`, color: CLUSTER_ACCENTS[i % CLUSTER_ACCENTS.length], opacity: r.confidence < 0.55 ? 0.55 : 0.95 }}>
          {r.label}{r.confidence < 0.55 ? " ?" : ""}
          {crossLinks[i]?.map((c) => <span key={c.m} className="ml-2 normal-case tracking-normal text-[var(--thread)]" title="Gold thread: related notes in another mode">⟷ {c.n} in {MODES.find((x) => x.id === c.m)!.label}</span>)}
        </span>
      ))}

      {/* Links */}
      <svg key={`l${bloom}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {view.edges.map((e) => {
          const a = noteById.get(e.a), b = noteById.get(e.b);
          if (!a || !b) return null;
          return <line key={e.a + e.b} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} className={`connection-line ${e.cross ? "cross" : ""}`}><title>{e.relation}</title></line>;
        })}
        {recallPrev && recallNote && <line x1={`${recallPrev.x}%`} y1={`${recallPrev.y}%`} x2={`${recallNote.x}%`} y2={`${recallNote.y}%`} className="connection-line" style={{ strokeWidth: 3, opacity: 0.9 }} />}
      </svg>
      {bloom > 0 && <div key={`b${bloom}`} className="snap-bloom pointer-events-none fixed inset-0" aria-hidden />}

      {/* Empty state with seed cards */}
      {!view.notes.length && !splash && (
        <div className="palace-empty absolute inset-0 flex flex-col items-center justify-center gap-6 px-5 text-center">
          <p className="breathe max-w-full text-xl font-medium text-ink-dim">{SAGE[mode].hello}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {SEEDS[mode].map((s) => (
              <Button variant="bare" size="natural" key={s.title} onClick={() => capture(s.notes)} className="glass group rounded-xl px-5 py-4 text-left transition hover:-translate-y-1 hover:shadow-[var(--glow-accent)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Seed</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{s.title}</div>
                <div className="mt-1 text-xs text-ink-muted">{s.notes.length} thoughts · tap to spill</div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {displayNotes.map((n) => {
        const accent = n.cluster === null ? null : CLUSTER_ACCENTS[n.cluster % CLUSTER_ACCENTS.length];
        const buds = view.suggestions.filter((s) => s.noteId === n.id);
        const inRecall = !!recall;
        return (
          <div
            key={n.id}
            data-note-id={n.id}
            data-raw={n.cluster === null}
            data-mode={mode}
            data-compact={!mobile && view.notes.length > 24}
            data-goal={mode === "grow" && /^goal\b/i.test(n.text)}
            tabIndex={0}
            role="button"
            aria-label={`Note: ${n.text}. Arrow keys move it, L links it.`}
            onDoubleClick={() => linkTap(n.id)}
            onFocus={() => setSelected(n.id)}
            onKeyDown={(e) => {
              const k = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
              if (k) { e.preventDefault(); nudge(n.id, k[0]!, k[1]!); }
              if (e.key.toLowerCase() === "l") linkTap(n.id);
            }}
            className={`note-card absolute w-[200px] max-w-[230px] touch-none cursor-grab select-none rounded-lg bg-card/90 px-4 py-3 leading-snug text-card-foreground backdrop-blur-md active:cursor-grabbing ${inRecall ? (n.id === recallId ? "recall-target" : "dimmed") : ""} ${linking === n.id ? "linking" : ""} ${selected === n.id ? "focus-visible:ring-2 focus-visible:ring-ring" : ""} outline-none`}
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%,-50%)", border: `1px solid ${accent ?? "var(--raw-rim)"}`, boxShadow: accent ? `0 0 22px -6px ${accent}` : "var(--shadow-glass)", animationDelay: `0s, ${(n.x % 3).toFixed(2)}s` }}
            onPointerDown={(e) => { if (mobile || (e.target as HTMLElement).closest("button") || panel === "rewind") return; const bounds = board.current?.getBoundingClientRect(); if (!bounds) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: n.id, dx: ((e.clientX - bounds.left) / bounds.width) * 100 - n.x, dy: ((e.clientY - bounds.top) / bounds.height) * 100 - n.y, moved: false }; }}
          >
            <span className="note-text flex min-w-0 items-start gap-2">
              {accent && <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />}
              <span className={`min-w-0 break-words ${inRecall && n.id === recallId && !recall?.revealed ? "blur-sm" : ""}`}>{n.text}</span>
            </span>
            {buds.map((s) => (
              <div key={s.kind} className="absolute -right-3 -top-3">
                <Button variant="bare" size="natural" aria-label={s.kind === "expand" ? "Suggestion" : s.kind === "reframe" ? "Kinder view" : "Challenge"} onClick={() => setOpenBud(openBud === n.id + s.kind ? null : n.id + s.kind)}
                  className={`bud flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${s.kind === "challenge" ? "bg-challenge" : "bg-expand"}`}>
                  {s.kind === "expand" ? "+" : s.kind === "reframe" ? "♡" : "!"}
                </Button>
                {openBud === n.id + s.kind && (
                  <div className="panel absolute left-1/2 top-8 z-20 w-60 -translate-x-1/2 rounded-xl p-3 text-left">
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${s.kind === "challenge" ? "text-challenge" : "text-expand"}`}>{s.kind === "expand" ? "+ Sage suggests" : s.kind === "reframe" ? "♡ A kinder view" : "! Sage wonders"}</div>
                    <p className="mt-1 text-sm text-secondary-foreground">{s.text}</p>
                    <div className="mt-3 flex gap-1.5">
                      <Button variant="bare" size="natural" className="loci-btn px-2.5 py-1.5 text-xs" onClick={() => acceptBud(s)}>{s.kind === "reframe" ? "Keep both" : "Add as note"}</Button>
                      <Button variant="bare" size="natural" className="loci-btn px-2.5 py-1.5 text-xs" data-v="secondary" onClick={() => dismissBud(s)}>Dismiss</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      </div>
      </div>
      {/* Top bar: wordmark + mode orbs */}
      <header className="loci-header fixed inset-x-4 top-4 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:inset-x-5 sm:top-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="splash-orb h-5 w-5 shrink-0 rounded-full" />
          <span className="text-gradient-splash text-lg font-bold tracking-[0.06em]">Loci</span>
        </div>
        <nav className="loci-modes glass flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-1.5" aria-label="Mode">
          {MODES.map((m) => (
            <Button variant="bare" size="natural" key={m.id} onClick={() => switchMode(m.id)} title={m.hint} className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-ink-dim transition hover:text-foreground" aria-pressed={mode === m.id}>
              <span className="mode-orb h-3.5 w-3.5 rounded-full" data-on={mode === m.id} style={{ ["--orb-c" as string]: modeVar[m.id] }} />
              <span className={mode === m.id ? "text-foreground" : ""}>{m.label}</span>
            </Button>
          ))}
        </nav>
      <div className="loci-tools flex shrink-0 gap-1.5">
        <Button variant="bare" size="natural" className="loci-btn w-9 px-0" data-v="secondary" onClick={() => setPanel("settings")} aria-label="Settings" title="Settings"><SettingsIcon className="size-4" /></Button>
        <Button variant="bare" size="natural" className="loci-btn w-9 px-0 font-bold" data-v="secondary" onClick={() => setPanel("help")} aria-label="Help" title="Help"><CircleHelp className="size-4" /></Button>
      </div>

      </header>
      <div className="loci-bottom fixed inset-x-2 bottom-2 z-10 mx-auto flex max-w-[820px] flex-col items-center gap-2">
      {/* Status + thinking */}
      <div className={`loci-status pointer-events-none flex min-h-8 w-full items-center justify-center gap-2 text-center text-xs font-medium tracking-[0.05em] text-ink-dim transition-opacity duration-500 ${status || thinking ? "opacity-100" : "opacity-0"}`}>
        {thinking ? (<>Sage is thinking<span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="thinking-dot h-1 w-1 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />)}</span></>) : status}
      </div>

      {/* Health pill */}
      <div className={`loci-health pointer-events-none flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-glass px-3 py-1.5 text-[11px] font-medium tracking-[0.03em] text-ink-dim backdrop-blur-md transition-opacity duration-500 ${palace.notes.length ? "opacity-100" : "opacity-0"}`}>
        <span className="h-[7px] w-[7px] rounded-full bg-health-blue" />{palace.notes.length} thought{palace.notes.length === 1 ? "" : "s"}
        <span className="h-3.5 w-px bg-border" />
        <span className="h-[7px] w-[7px] rounded-full bg-health-amber" /><span className={dueCount ? "text-health-amber" : "text-health-green"}>{dueCount} due</span>
        {days > 0 && (<><span className="h-3.5 w-px bg-border" /><span className="text-primary">◆</span>{days}-day streak</>)}
        {mastery > 0 && (<><span className="h-3.5 w-px bg-border" />{mastery}% mastered</>)}
        {weekly > 0 && (<><span className="h-3.5 w-px bg-border" /><span className="text-expand">✓</span>{weekly} remembered this week</>)}
        {palace.regions.length > 0 && (<><span className="h-3.5 w-px bg-border" /><span className="h-[7px] w-[7px] rounded-full bg-health-green" />{palace.regions.length} clusters</>)}
      </div>

      {/* HUD */}
      <form onSubmit={(e) => { e.preventDefault(); capture([input]); }} className="loci-capture glass grid w-full min-w-0 items-center gap-1.5 rounded-xl p-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="What's on your mind?" maxLength={140} aria-label="Capture a thought"
          className="min-w-0 w-full rounded-[10px] border border-input bg-muted/85 px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-ink-muted focus:border-ring focus:shadow-[0_0_0_3px_var(--ring)]" />
        <Button variant="bare" size="natural" type="button" className="loci-btn" data-v="secondary" data-active={listening} onClick={voice} aria-label="Voice capture" title="Voice capture"><Mic className="size-4" /></Button>
        <Button variant="bare" size="natural" type="submit" className="loci-btn" data-v="add">Add</Button>
        <Button variant="bare" size="natural" type="button" className="loci-btn" data-v="organize" onClick={doOrganize} disabled={thinking}>Organize</Button>
        <Button variant="bare" size="natural" type="button" className="loci-btn" data-v="recall" onClick={startRecall}>Recall</Button>
        <Button variant="bare" size="natural" type="button" className="loci-btn" data-v="rewind" onClick={openRewind}>Rewind</Button>
      </form>

      </div>
      {/* Recall card (non-blocking, sits top-center) */}
      {recall && recallNote && (
        <div className="loci-recall panel fixed left-1/2 top-20 z-30 w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-[22px] px-6 py-5 text-center">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Recall · {recall.i + 1} of {recall.ids.length}</span>
            <Button variant="bare" size="natural" onClick={() => setRecall(null)} className="text-ink-muted hover:text-foreground">End</Button>
          </div>
          <div className="text-gradient mt-2 text-lg font-bold">
            {recallNote.cluster !== null && palace.regions[recallNote.cluster] ? `Something about "${palace.regions[recallNote.cluster]!.label}"…` : "What was this thought?"}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Follow the glow. Try to remember, then reveal.</p>
          <div className="mt-4 flex justify-center gap-2">
            {!recall.revealed ? <Button variant="bare" size="natural" className="loci-btn px-5" onClick={() => setRecall({ ...recall, revealed: true })}>Reveal</Button> : (<>
              <Button variant="bare" size="natural" className="loci-btn" data-v="secondary" onClick={() => answer(false)}>Not yet</Button>
              <Button variant="bare" size="natural" className="loci-btn" onClick={() => answer(true)}>I remembered</Button>
            </>)}
          </div>
        </div>
      )}

      {/* Rewind dial */}
      {panel === "rewind" && (
        <div className="loci-rewind panel fixed bottom-24 right-5 z-30 w-72 rounded-[22px] p-5">
          <div className="flex items-center gap-3">
            <div className="dial relative h-12 w-12 shrink-0 rounded-full" style={{ transform: `rotate(${(rewindAt / Math.max(history.length, 1)) * 300 - 150}deg)`, transition: "transform .4s cubic-bezier(.16,1,.3,1)" }}>
              <span className="absolute left-1/2 top-1 h-3 w-1 -translate-x-1/2 rounded-full bg-foreground" />
            </div>
            <div>
              <div className="text-gradient text-base font-bold">Rewind</div>
              <div className="text-xs text-ink-muted">{rewindAt === history.length ? "Now" : `${history.length - rewindAt} step${history.length - rewindAt > 1 ? "s" : ""} back`}</div>
            </div>
          </div>
          <input type="range" className="loci-range mt-4 w-full" min={0} max={history.length} value={rewindAt} onChange={(e) => scrub(Number(e.target.value))} aria-label="Rewind timeline" />
          <div className="mt-3 flex justify-end gap-1.5">
            <Button variant="bare" size="natural" className="loci-btn" data-v="secondary" onClick={() => setPanel(null)}>Cancel</Button>
            <Button variant="bare" size="natural" className="loci-btn" data-v="rewind" onClick={confirmRewind}>Restore</Button>
          </div>
        </div>
      )}

      {/* Welcome back */}
      <Overlay visible={welcome} z="z-40" onClose={() => setWelcome(false)}>
        <div className="splash-orb mx-auto mb-5 h-10 w-10 rounded-full" />
        <div className="text-gradient-splash text-2xl font-bold">Welcome back</div>
        <p className="mt-2 text-sm text-secondary-foreground">
          {allDue ? `${allDue} thought${allDue > 1 ? "s are" : " is"} waiting to be recalled.` : "Your palace is calm — nothing due right now."}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[{ v: days, l: "day streak", c: "text-primary" }, { v: weekly, l: "remembered this week", c: "text-expand" }, { v: allDue, l: "due now", c: "text-challenge" }].map((x) => (
            <div key={x.l} className="rounded-xl border border-border bg-muted/60 px-2 py-3">
              <div className={`text-2xl font-bold ${x.c}`}>{x.v}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{x.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="bare" size="natural" className="loci-btn" data-v="secondary" onClick={() => setWelcome(false)}>Just look around</Button>
          {allDue > 0 && <Button variant="bare" size="natural" className="loci-btn" data-v="recall" onClick={() => {
            setWelcome(false);
            const m = palace.notes.some((x) => isDue(x)) ? mode : (Object.keys(state) as Mode[]).find((k) => state[k].notes.some((x) => isDue(x)))!;
            if (m !== mode) { setMode(m); setAudioMode(m); }
            const q = queue(state[m].notes).slice(0, 5);
            sound(sfx.welcome);
            setRecall({ ids: q.map((x) => x.id), i: 0, revealed: false, score: 0 });
          }}>Start recall</Button>}
        </div>
      </Overlay>

      {/* Onboarding */}
      <Overlay visible={onboard !== null} z="z-40">
        {onboard !== null && (<>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Step {onboard + 1} of 3</div>
          <div className="text-gradient mb-2 text-xl font-bold">{STEPS[onboard]?.title}</div>
          <p className="mb-5 text-sm leading-relaxed text-secondary-foreground">{STEPS[onboard]?.desc}</p>
          <div className="mb-4 flex justify-center gap-2">
            {STEPS.map((_, i) => <span key={i} className={`h-2 w-2 rounded-full transition duration-300 ${i === onboard ? "scale-125 bg-accent" : i < onboard ? "bg-accent/50" : "bg-border"}`} />)}
          </div>
          <Button variant="bare" size="natural" className="loci-btn px-7 py-2.5 text-sm" onClick={() => (onboard < 2 ? setOnboard(onboard + 1) : closeOnboard())}>{onboard < 2 ? "Next" : "Start"}</Button>
          <Button variant="bare" size="natural" className="mx-auto mt-2.5 block px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink-dim" onClick={closeOnboard}>Skip intro</Button>
        </>)}
      </Overlay>

      {/* Settings */}
      <Overlay visible={panel === "settings"} z="z-50" align="left" onClose={() => setPanel(null)}>
        <div className="text-gradient mb-4 text-[22px] font-bold">Settings</div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Text size</div>
        <div className="mb-5 flex gap-2">
          {([1, 1.25, 1.5] as const).map((s) => <Button variant="bare" size="natural" key={s} className="loci-btn" data-v={settings.scale === s ? undefined : "secondary"} onClick={() => setSettings({ ...settings, scale: s })}>{Math.round(s * 100)}%</Button>)}
        </div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sound</div>
        <div className="flex gap-2">
          <Button variant="bare" size="natural" className="loci-btn" data-v={settings.sound ? undefined : "secondary"} onClick={() => setSettings({ ...settings, sound: true })}>On</Button>
          <Button variant="bare" size="natural" className="loci-btn" data-v={!settings.sound ? undefined : "secondary"} onClick={() => setSettings({ ...settings, sound: false })}>Off</Button>
        </div>
        <p className="mt-5 text-xs text-ink-muted">Meaning is never carried by color alone: suggestions show +, challenges show !, low-confidence clusters show ?.</p>
        <Button variant="bare" size="natural" className="loci-btn mt-5 px-5 py-2.5 text-sm" onClick={() => setPanel(null)}>Done</Button>
      </Overlay>

      {/* Help */}
      <Overlay visible={panel === "help"} z="z-50" align="left" onClose={() => setPanel(null)}>
        <div className="text-gradient mb-1 text-[22px] font-bold">How Loci works</div>
        <div className="mb-4 text-[13px] text-muted-foreground">Your spatial memory bank</div>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-secondary-foreground">
          <li><b className="text-foreground">Capture</b> — type, speak, or spill a seed set.</li>
          <li><b className="text-foreground">Organize</b> — notes snap into clusters with links.</li>
          <li><b className="text-foreground">Arrange</b> — drag any card; your spot is respected. Double-click two cards (or press L) to link them.</li>
          <li><b className="text-foreground">Keyboard</b> — Tab to a card, arrow keys to move it.</li>
          <li><b className="text-foreground">Recall</b> — weakest notes first, then spaced out over days.</li>
          <li><b className="text-foreground">Rewind</b> — turn the dial to scrub back through changes.</li>
          <li><b className="text-foreground">Modes</b> — Think, Grow and Imagine each keep their own palace.</li>
        </ol>
        <hr className="mb-3 mt-5 border-border" />
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data tools</div>
        <div className="flex gap-2">
          <Button variant="bare" size="natural" className="loci-btn" data-v="secondary" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })); a.download = "loci-palace.json"; a.click(); }}>Export palace</Button>
          <Button variant="bare" size="natural" className="loci-btn" data-v="danger" onClick={() => { commit(empty()); setPanel(null); setStatus("This palace was cleared — Rewind can bring it back"); }}>Clear this palace</Button>
        </div>
        <p className="mt-4 text-xs text-ink-muted">Everything stays in this browser. Nothing is sent anywhere.</p>
        <Button variant="bare" size="natural" className="loci-btn mt-5 px-5 py-2.5 text-sm" onClick={() => setPanel(null)}>Got it</Button>
      </Overlay>

      {/* Crisis card */}
      <Overlay visible={panel === "crisis"} z="z-[60]">
        <div className="text-gradient mb-2 text-xl font-bold">That sounds really heavy.</div>
        <p className="text-sm leading-relaxed text-secondary-foreground">You don't have to carry this alone, and nothing here needs to be organized right now. Please reach out to a real person:</p>
        <ul className="mt-4 space-y-2 text-sm text-foreground">
          <li><a className="underline decoration-accent underline-offset-4" href="https://findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a> — free, confidential helplines in your country</li>
          <li>US & Canada: call or text <b>988</b></li>
          <li>In immediate danger? Contact your local emergency services.</li>
        </ul>
        <p className="mt-4 text-sm text-primary">Tell someone you trust. You matter.</p>
        <Button variant="bare" size="natural" className="loci-btn mt-5 px-5 py-2.5 text-sm" data-v="secondary" onClick={() => setPanel(null)}>I'm okay — continue</Button>
      </Overlay>

      {intro && <Intro onDone={() => { setIntro(false); setOnboard(0); }} />}

      {/* Splash */}
      <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-all duration-700 ${splash ? "visible opacity-100" : "invisible opacity-0"}`}>
        <div className="splash-orb mb-6 h-12 w-12 rounded-full" />
        <div className="text-gradient-splash mb-2 text-[28px] font-bold tracking-[0.06em]">Loci</div>
        <div className="text-[13px] tracking-[0.04em] text-ink-muted">Entering your memory palace…</div>
      </div>
    </main>
  );
}
