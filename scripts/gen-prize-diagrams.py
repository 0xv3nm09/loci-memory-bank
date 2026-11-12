#!/usr/bin/env python3
"""
Generates the prize-diagram SVGs (vertical flows + sequence diagrams).

Design rules (from feedback):
- VERTICAL layout only — horizontal flows squeeze text.
- Full-width nodes (560px) with wrapped lines; side detail panels (250px)
  carry the per-step explanation instead of cramming it into the node.
- Dark brand theme matching the app.
- Sequence diagrams flow downward (time = down), short labels above arrows,
  exact row-height accounting so nothing clips.

Run:  python3 scripts/gen-prize-diagrams.py
Out:  prizes/diagrams/*.svg
"""

import os
import html

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prizes", "diagrams")

W = 940
COL_X = 50
COL_W = 560
DET_X = 655
DET_W = 250

INK = "#EDF1FA"
BODY = "#c3cdea"
DIM = "#8fa3d8"
BG = "#0b101f"
GLASS = "#1b2238"
GLASS2 = "#10162b"
STROKE = "#3a4b7a"
GOLD = "#e8b34b"
GRAY = "#8a93a8"
SKY = "#5bd9fd"
MINT = "#2fe880"
RED = "#ea4a4a"
VIOLET = "#a78bfa"

ARROW_DEFS = (
    '<defs>'
    '<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    '<path d="M0,0 L10,5 L0,10 z" fill="#7f8ec4"/></marker>'
    '</defs>'
)


def esc(s):
    return html.escape(s, quote=False)


class Flow:
    """Vertical flowchart with side detail panels."""

    def __init__(self, title, subtitle, accent=SKY):
        self.title = title
        self.subtitle = subtitle
        self.accent = accent
        self.items = []
        self.y = 118

    def node(self, title, lines, detail=None, accent=None, tag=None, color=None):
        self.items.append(("node", dict(title=title, lines=lines, detail=detail,
                                        accent=accent or self.accent, tag=tag, color=color)))
        return self

    def branch(self, label_a, node_a, label_b, node_b, detail=None):
        self.items.append(("branch", dict(label_a=label_a, a=node_a, label_b=label_b,
                                          b=node_b, detail=detail)))
        return self

    def note(self, text, accent=VIOLET):
        self.items.append(("note", dict(text=text, accent=accent)))
        return self

    def _node_h(self, lines, title):
        return 34 + 19 * len(lines) + (22 if title else 0) + 16

    def _node(self, x, y, w, accent, tag, title, lines, color=None):
        h = self._node_h(lines, title)
        stroke = color or accent
        out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{GLASS}" stroke="{stroke}" stroke-width="1.6"/>']
        ty = y + 26
        if tag:
            out.append(f'<rect x="{x+16}" y="{y+12}" width="{10*len(tag)+16}" height="20" rx="10" fill="{stroke}" opacity="0.18"/>')
            out.append(f'<text x="{x+24}" y="{y+26}" font-size="11.5" font-weight="700" fill="{stroke}">{esc(tag)}</text>')
            ty = y + 50
        if title:
            out.append(f'<text x="{x+16}" y="{ty}" font-size="16.5" font-weight="700" fill="{INK}">{esc(title)}</text>')
            ty += 21
        for line in lines:
            out.append(f'<text x="{x+16}" y="{ty}" font-size="13" fill="{BODY}">{esc(line)}</text>')
            ty += 19
        return "".join(out), h

    def _detail(self, y, detail, accent):
        head, lines = detail
        h = 26 + 18 * len(lines)
        out = [f'<rect x="{DET_X}" y="{y}" width="{DET_W}" height="{h}" rx="10" fill="{GLASS2}" stroke="{STROKE}" stroke-dasharray="4 4"/>']
        out.append(f'<text x="{DET_X+12}" y="{y+18}" font-size="11.5" font-weight="700" fill="{accent}">{esc(head.upper())}</text>')
        ty = y + 36
        for line in lines:
            out.append(f'<text x="{DET_X+12}" y="{ty}" font-size="11.5" fill="{DIM}">{esc(line)}</text>')
            ty += 18
        return "".join(out), h

    def render(self):
        p = []
        y = self.y
        prev_bottom = None
        for kind, d in self.items:
            if kind == "node":
                svg, h = self._node(COL_X, y, COL_W, d["accent"], d["tag"], d["title"], d["lines"], d.get("color"))
                if prev_bottom is not None:
                    p.append(self._arrow(COL_X + COL_W / 2, prev_bottom, y))
                p.append(svg)
                node_mid = y + h / 2
                if d.get("detail"):
                    dh = 26 + 18 * len(d["detail"][1])
                    dsvg, _ = self._detail(int(node_mid - dh / 2), d["detail"], d["accent"])
                    p.append(f'<line x1="{COL_X+COL_W}" y1="{node_mid}" x2="{DET_X}" y2="{node_mid}" stroke="{STROKE}" stroke-dasharray="3 4"/>')
                    p.append(dsvg)
                prev_bottom = y + h
                y += h + 56
            elif kind == "branch":
                half = (COL_W - 24) // 2
                ha = self._node_h(d["a"][1], d["a"][0])
                hb = self._node_h(d["b"][1], d["b"][0])
                h = max(ha, hb)
                ax, bx = COL_X, COL_X + half + 24
                p.append(self._arrow(COL_X + COL_W / 2, prev_bottom, y, label_left=d["label_a"], label_right=d["label_b"]))
                sa, _ = self._node(ax, y, half, d["a"][2], None, d["a"][0], d["a"][1])
                sb, _ = self._node(bx, y, half, d["b"][2], None, d["b"][0], d["b"][1])
                p.append(sa)
                p.append(sb)
                if d.get("detail"):
                    dsvg, _ = self._detail(y + 10, d["detail"], self.accent)
                    p.append(dsvg)
                prev_bottom = y + h
                y += h + 56
            elif kind == "note":
                # wrap at ~78 chars so the text never crosses the dashed border
                words = d["text"].split(" ")
                wrapped, line = [], ""
                for word in words:
                    if len(line) + len(word) + 1 > 78:
                        wrapped.append(line)
                        line = word
                    else:
                        line = f"{line} {word}".strip()
                if line:
                    wrapped.append(line)
                h = 40 + 19 * (len(wrapped) - 1)
                p.append(f'<rect x="{COL_X}" y="{y}" width="{COL_W}" height="{h}" rx="10" fill="{GLASS2}" stroke="{d["accent"]}" stroke-dasharray="5 4"/>')
                ty = y + 26
                for line in wrapped:
                    p.append(f'<text x="{COL_X+16}" y="{ty}" font-size="13" fill="{d["accent"]}">{esc(line)}</text>')
                    ty += 19
                prev_bottom = y + h
                y += h + 46
        return y + 30, p

    def _arrow(self, cx, y1, y2, label_left=None, label_right=None):
        mid = (y1 + y2) / 2
        s = [f'<line x1="{cx}" y1="{y1+2}" x2="{cx}" y2="{y2-8}" stroke="#7f8ec4" stroke-width="2" marker-end="url(#arr)"/>']
        if label_left:
            s.append(f'<text x="{cx-14}" y="{mid}" font-size="12.5" font-weight="700" fill="{RED}" text-anchor="end">{esc(label_left)}</text>')
        if label_right:
            s.append(f'<text x="{cx+14}" y="{mid}" font-size="12.5" font-weight="700" fill="{MINT}">{esc(label_right)}</text>')
        return "".join(s)

    def save(self, name):
        total, body = self.render()
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{total}" viewBox="0 0 {W} {total}" '
               f'font-family="Inter, system-ui, sans-serif">{ARROW_DEFS}'
               f'<rect width="{W}" height="{total}" fill="{BG}"/>'
               f'<text x="{COL_X}" y="46" font-size="23" font-weight="800" fill="{INK}">{esc(self.title)}</text>'
               f'<text x="{COL_X}" y="70" font-size="13.5" fill="{DIM}">{esc(self.subtitle)}</text>'
               + "".join(body) + "</svg>\n")
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "w") as f:
            f.write(svg)
        print(f"  wrote diagrams/{name} ({total}px tall)")


class Sequence:
    """Top-down sequence diagram: lifelines, short labels above arrows."""

    def __init__(self, title, subtitle, participants, accent=SKY):
        self.title = title
        self.subtitle = subtitle
        self.accent = accent
        self.parts = participants
        self.rows = []
        self.step = 46

    def msg(self, a, b, text, dashed=False, bold=False):
        self.rows.append(("msg", dict(a=a, b=b, text=text, dashed=dashed, bold=bold)))
        return self

    def selfmsg(self, a, text):
        self.rows.append(("self", dict(a=a, text=text)))
        return self

    def divider(self, text):
        self.rows.append(("divider", dict(text=text)))
        return self

    def alt(self, label, a, b, text, dashed=False):
        self.rows.append(("alt", dict(label=label, a=a, b=b, text=text, dashed=dashed)))
        return self

    def note(self, a, text):
        self.rows.append(("note", dict(a=a, text=text)))
        return self

    def save(self, name):
        def norm(text):
            return text if isinstance(text, list) else text.split("\\n")

        def row_h(kind, d):
            if kind == "divider":
                return 54
            if kind == "note":
                return 40 + 16 * (len(norm(d["text"])) - 1)
            if kind == "alt":
                return self.step + 16
            return self.step

        n = len(self.parts)
        span = W - 180
        xs = [90 + span * (i + 0.5) / n for i in range(n)]
        box_w = min(124, span / n - 10)
        idx = {p: i for i, p in enumerate(self.parts)}
        head = 96
        total = head + sum(row_h(k, d) for k, d in self.rows) + 50

        p = [f'<rect width="{W}" height="{total}" fill="{BG}"/>',
             f'<text x="50" y="46" font-size="23" font-weight="800" fill="{INK}">{esc(self.title)}</text>',
             f'<text x="50" y="70" font-size="13.5" fill="{DIM}">{esc(self.subtitle)}</text>']
        y0 = head - 6
        for i, part in enumerate(self.parts):
            p.append(f'<rect x="{xs[i]-box_w/2}" y="{y0}" width="{box_w}" height="36" rx="9" fill="{GLASS}" stroke="{self.accent}"/>')
            p.append(f'<text x="{xs[i]}" y="{y0+23}" font-size="12" font-weight="700" fill="{INK}" text-anchor="middle">{esc(part)}</text>')
            p.append(f'<line x1="{xs[i]}" y1="{y0+36}" x2="{xs[i]}" y2="{total-20}" stroke="{STROKE}" stroke-dasharray="4 5"/>')
        y = y0 + 58
        for kind, d in self.rows:
            if kind == "divider":
                p.append(f'<line x1="50" y1="{y}" x2="{W-50}" y2="{y}" stroke="{VIOLET}" stroke-width="1.4"/>')
                p.append(f'<rect x="{W/2-110}" y="{y-13}" width="220" height="26" rx="13" fill="{GLASS2}" stroke="{VIOLET}"/>')
                p.append(f'<text x="{W/2}" y="{y+5}" font-size="12" font-weight="700" fill="{VIOLET}" text-anchor="middle">{esc(d["text"])}</text>')
                y += 54
            elif kind == "msg":
                xa, xb = xs[idx[d["a"]]], xs[idx[d["b"]]]
                dash = ' stroke-dasharray="6 5"' if d["dashed"] else ""
                weight = ' font-weight="700"' if d["bold"] else ""
                color = INK if d["bold"] else BODY
                p.append(f'<line x1="{xa}" y1="{y}" x2="{xb}" y2="{y}" stroke="#7f8ec4" stroke-width="2"{dash} marker-end="url(#arr)"/>')
                midx = (xa + xb) / 2
                lines = norm(d["text"])
                ty = y - (7 if len(lines) == 1 else 1)
                for line in lines:
                    p.append(f'<text x="{midx}" y="{ty}" font-size="12.5"{weight} fill="{color}" text-anchor="middle">{esc(line)}</text>')
                    ty += 15
                y += self.step if len(lines) == 1 else self.step + 14
            elif kind == "self":
                x = xs[idx[d["a"]]]
                p.append(f'<rect x="{x-150}" y="{y-14}" width="300" height="26" rx="8" fill="{GLASS2}" stroke="{STROKE}"/>')
                p.append(f'<text x="{x}" y="{y+3}" font-size="12" fill="{BODY}" text-anchor="middle">{esc(d["text"])}</text>')
                y += 44
            elif kind == "alt":
                # Section label as GOLD TEXT above the message — no frames,
                # nothing can overlap.
                xa, xb = xs[idx[d["a"]]], xs[idx[d["b"]]]
                midx = (xa + xb) / 2
                dash = ' stroke-dasharray="6 5"' if d["dashed"] else ""
                p.append(f'<text x="{midx}" y="{y-20}" font-size="11" font-weight="800" fill="{GOLD}" text-anchor="middle" letter-spacing="1.5">{esc(d["label"])}</text>')
                p.append(f'<line x1="{xa}" y1="{y}" x2="{xb}" y2="{y}" stroke="#7f8ec4" stroke-width="2"{dash} marker-end="url(#arr)"/>')
                p.append(f'<text x="{midx}" y="{y-6}" font-size="12.5" fill="{BODY}" text-anchor="middle">{esc(d["text"])}</text>')
                y += self.step + 16
            elif kind == "note":
                lines = norm(d["text"])
                h = 24 + 16 * (len(lines) - 1)
                x = max(10 + 165, min(W - 10 - 165, xs[idx[d["a"]]]))
                p.append(f'<rect x="{x-165}" y="{y-12}" width="330" height="{h}" rx="8" fill="{GLASS2}" stroke="{VIOLET}" stroke-dasharray="5 4"/>')
                ty = y + 4
                for line in lines:
                    p.append(f'<text x="{x}" y="{ty}" font-size="12" fill="{VIOLET}" text-anchor="middle">{esc(line)}</text>')
                    ty += 16
                y += 40 + 16 * (len(lines) - 1)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{total}" viewBox="0 0 {W} {total}" '
               f'font-family="Inter, system-ui, sans-serif">{ARROW_DEFS}'
               f'<rect width="{W}" height="{total}" fill="{BG}"/>'
               f'<text x="50" y="46" font-size="23" font-weight="800" fill="{INK}">{esc(self.title)}</text>'
               f'<text x="50" y="70" font-size="13.5" fill="{DIM}">{esc(self.subtitle)}</text>'
               + "".join(p) + "</svg>\n")
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "w") as f:
            f.write(svg)
        print(f"  wrote diagrams/{name} ({total}px tall)")


print("Generating prize diagrams…")

# 1 — master system (vertical)
f = Flow("Loci — master system map", "How every piece is connected: headset internals, the model path, and the real-case fallback.", SKY)
f.node("INPUT — capture, four ways", [
    "Mic orb (voice, desktop) · Type orb → spatial keyboard",
    "Seed cards (one touch) · typed bar (desktop)",
], detail=("works alone", ["every channel is optional", "all feed the same pipeline"]), tag="IN")
f.node("SAFETY — the distress gate", [
    "Reviewed trigger list runs on EVERY capture,",
    "before the model ever sees text.",
], detail=("safety-critical", ["flagged → 3D crisis panel,", "calm tone, flow stops,", "nothing is organized or saved"]), accent=RED, tag="GATE")
f.branch(
    "flagged", ("Crisis panel", ["3D world-space, real resources", "I'm okay — continue to resume"], RED),
    "clear", ("OrganizeSystem", ["snapshot of layout + notes in context"], MINT),
    detail=("two exits only", ["the gate decides which —", "never the model, never a prompt"]))
f.node("ORGANIZE — two intelligences, one contract", [
    "Model path: schema-bound call to qwen3-14b (retry once)",
    "Local path: deterministic organizer, instant, always up",
], detail=("arbitration", ["model result wins if it covers", "≥60% of notes; else local"]), tag="BOTH PATHS", accent=GOLD)
f.node("THE SNAP — the hook", [
    "Cards arc into clusters, lines draw in, chord resolves",
    "Organize orb: GOLD = model did it · GRAY = local did",
], detail=("Best Agentic", ["the orb is the persistent", "who-did-this indicator"]), accent=GOLD)
f.node("ARRANGE — human authority", [
    "Grab / pinch / drag any card anywhere",
    "userPlaced = true → the agent never moves it again",
], detail=("control", ["AI proposes; you dispose —", "enforced in code, both paths"]))
f.node("PERSIST — palace-store", [
    "localStorage: notes, layout, strength, 30 snapshots",
    "Export to JSON from the ? menu (desktop)",
], detail=("no server", ["the palace lives in the browser —", "privacy by architecture"]))
f.node("RETURN — greeting + Recall", [
    "Welcome back — last here N ago. N thoughts due.",
    "Quiz: weakest first · graded · strengths reschedule tomorrow",
], detail=("loop", ["strength 0–5 per note,", "misses resurface first"]), accent=VIOLET)
f.node("REWIND — scrub the growth", [
    "Drag the dial: snapshots replay with the snap animation",
], detail=("only in VR", ["a changelog on a flat screen", "cannot scrub a place"]), accent=VIOLET)
f.save("master-system.svg")

# 2 — productivity ritual sequence
s = Sequence("Productivity — the daily ritual", "One day, then the next: the recurring context the track rewards.",
             ["You", "Loci", "Sage", "Palace"])
s.msg("You", "Loci", "dump thoughts (voice / type / seed)")
s.selfmsg("Loci", "distress gate first — always")
s.msg("Loci", "Sage", "schema-bound organize request")
s.msg("Sage", "Loci", "clusters + connections + suggestions", dashed=True)
s.msg("Loci", "You", "THE SNAP — thoughts become a constellation", bold=True)
s.msg("You", "Loci", "arrange by hand (placements win)")
s.msg("Loci", "Palace", "autosave: layout + strengths + snapshot")
s.divider("NEXT DAY")
s.msg("You", "Loci", "open the app")
s.msg("Loci", "You", "welcome back — N thoughts due for Recall", dashed=True)
s.msg("Loci", "You", "Recall quiz — weakest notes first")
s.msg("You", "Loci", "answer by touch or voice")
s.msg("Loci", "Palace", "strengths updated — tomorrow is scheduled")
s.save("productivity-ritual-sequence.svg")

# 3 — agentic organize sequence
s = Sequence("Best Agentic — one organize, every branch", "Retry, fallback, and the honest gold/gray indicator.",
             ["Player", "Client", "Gate", "Model client", "Ollama", "Heuristic"])
s.msg("Player", "Client", "dump thoughts")
s.msg("Client", "Gate", "raw capture text — before anything")
s.msg("Gate", "Client", "clear", dashed=True)
s.msg("Client", "Heuristic", "compute local result instantly (held ready)")
s.msg("Client", "Model client", "request organize")
s.msg("Model client", "Ollama", "POST — JSON schema enforced")
s.alt("MODEL ANSWERS", "Ollama", "Client", "clusters, edges, suggestions → SNAP + GOLD orb + buds")
s.alt("MODEL DOWN", "Model client", "Ollama", "retry once after 1.5s → still failing", dashed=True)
s.msg("Model client", "Client", "error swallowed — fallback stands", dashed=True)
s.msg("Client", "Player", "SNAP + GRAY orb — the product never stumbles", bold=True)
s.note("Client", ["userPlaced = true on every card you moved —", "the agent never reorganizes your placements"])
s.save("agentic-organize-sequence.svg")

# 4 — retention loop sequence
s = Sequence("Reason to Come Back — the loop", "Two sessions: what is saved, what greets you, what is scheduled.",
             ["You", "Loci", "Palace"])
s.divider("SESSION N")
s.msg("You", "Loci", "dump, organize, arrange")
s.msg("Loci", "Palace", "save: layout + strengths + history snapshot")
s.msg("You", "Loci", "close the app")
s.divider("TIME PASSES")
s.msg("You", "Loci", "reopen")
s.msg("Loci", "Palace", "load — restore exactly as left", dashed=True)
s.msg("Loci", "You", "welcome back — last here N ago, N due", dashed=True, bold=True)
s.msg("Loci", "You", "Recall: weakest / never-seen first")
s.alt("CORRECT", "You", "Loci", "strength +1 → returns less often (green, rising ping)")
s.alt("MISS", "You", "Loci", "strength → 0 → resurfaces first (soft tone)", dashed=True)
s.msg("Loci", "Palace", "autosave — tomorrow's session is scheduled")
s.save("retention-loop-sequence.svg")

# 5 — first five minutes sequence
s = Sequence("First Five Minutes — measured", "Real timings from the built app (desktop; XR adds physical time only).",
             ["Visitor", "App", "Sage", "Storage"])
s.msg("Visitor", "App", "open — interactive in 1.5s")
s.msg("App", "Visitor", "guide panel + orb row + seed cards", dashed=True)
s.msg("Visitor", "App", "first touch: seed card spills 5 thoughts")
s.msg("App", "App", "auto-organize fires 2.2s after capture")
s.alt("SAGE WARM", "App", "Sage", "clusters in 6-11s (thinking beat covers it)")
s.msg("App", "Visitor", "THE SNAP — the payoff, before minute two", bold=True)
s.msg("Visitor", "App", "first drag — zero instructions")
s.msg("Visitor", "App", "violet orb → quiz opens in 1.1s")
s.msg("App", "Storage", "autosave — the palace already remembers them")
s.save("first-five-minutes-sequence.svg")

# 6 — accessibility sequence
s = Sequence("Accessibility — channels converge", "Every input works alone; every output is redundant.",
             ["User", "Loci", "Sage"])
s.alt("VOICE ALONE", "User", "Loci", "mic orb → speak the thought (desktop)")
s.alt("HANDS ALONE", "User", "Loci", "type orb → spatial keyboard → done")
s.alt("ONE FINGER", "User", "Loci", "seed card → five thoughts, one touch")
s.selfmsg("Loci", "same distress gate + same pipeline for all channels")
s.msg("Loci", "Sage", "organize (or instant local fallback)")
s.msg("Loci", "User", "color (CVD-verified) + glyphs + audio + Aa text scale", dashed=True)
s.save("accessibility-channels-sequence.svg")

# 7 — retention growth flow (vertical)
f = Flow("Reason to Come Back — the loop", "What is saved, what greets you, what is scheduled — across sessions.", VIOLET)
f.node("SESSION N — build the palace", [
    "Dump, organize, arrange. Autosave writes notes, layout,",
    "per-note strength (0–5), and a history snapshot.",
], detail=("persisted", ["localStorage — survives close,", "refresh, and browser restarts"]), tag="SAVE")
f.node("TIME PASSES — nothing nags", [
    "No streaks, no push, no guilt. The waypoint waits.",
], detail=("by design", ["missing a day never punishes"]), accent=MINT)
f.node("SESSION N+1 — the greeting", [
    "Restore exactly as left, then:",
    "Welcome back — last here N ago. N thoughts due for Recall.",
], detail=("the hook", ["fires at the exact moment", "the criteria measure: re-entry"]), tag="RETURN", accent=GOLD)
f.node("RECALL — the schedule is the science", [
    "Weakest / never-seen notes first. Correct: strength +1,",
    "comes back less often. Miss: strength 0, resurfaces first.",
], detail=("spaced repetition", ["SM-2-lite; thresholds tunable", "in palace-store.ts"]), accent=SKY)
f.node("THE PALACE GREW — and Rewind proves it", [
    "Drag the dial: days of growth replay with the snap motion.",
], detail=("visible growth", ["'two weeks ago this was three", "scattered thoughts'"]), accent=VIOLET)
f.note("The loop closes: today's session schedules tomorrow's — longevity by mechanics, not by notification.")
f.save("retention-loop-flow.svg")

# 8 — accessibility channels flow (vertical)
f = Flow("Accessibility — inclusive by default", "Four input channels converge on one pipeline; four redundant output signals leave it.", MINT)
f.node("INPUT CHANNELS — each works alone", [
    "Voice (mic orb, desktop) · Hands (pinch-grab, touch)",
    "Typed (spatial keyboard, everywhere) · One finger (seed cards)",
], detail=("no setup, no mode", ["any single channel completes", "the entire experience"]), tag="4 CHANNELS")
f.node("ONE PIPELINE", [
    "Same distress gate, same organizer, same palace —",
    "the channel you chose changes nothing downstream.",
], detail=("equal first-class", ["typed is never a degraded", "fallback (fairness note in docs)"]))
f.node("OUTPUT SIGNALS — every one redundant", [
    "Color: CVD-verified palette (worst pair 72)",
    "Glyphs: + and ? marks · Audio: pings and calm tone",
    "Scale: Aa orb, 100–150% live",
], detail=("verification", ["Viénot simulation over deutan,", "protan, tritan — see palette.ts"]), tag="4 SIGNALS", accent=GOLD)
f.node("CRISIS SURFACE — reaches everyone", [
    "3D panel + calm audio cue: safety not depending on vision.",
], detail=("safety", ["the one moment that must", "land for every user"]), accent=RED)
f.save("accessibility-channels-flow.svg")

# 9 — boldest contrast (vertical)
f = Flow("Boldest Original Concept — the collapse test", "Take away VR and the loop falls apart. Take away Loci and nothing fills the gap.", GOLD)
f.node("ON A FLAT SCREEN — what every rival is", [
    "A notes app is a list · Anki is a schedule",
    "A mind map is a diagram · A changelog is text",
], detail=("the ceiling", ["no presence, no depth, no body"]), tag="THEM", color=GRAY)
f.node("IN VR — what only Loci can be", [
    "Thoughts have a PLACE around you",
    "Understanding is physical: grab and move meaning",
    "Memory has a ROOM: the palace persists and grows",
    "History has a DIAL: scrub your own mind's past",
], detail=("the claim", ["each step needs presence,", "depth, or hands — the three", "things monitors cannot give"]), tag="US", accent=GOLD)
f.note("The 2,000-year-old method of loci always needed an imagined place. VR is the first medium where the place is real.")
f.save("boldest-collapse-flow.svg")

print("done.")


def architecture_technical():
    """Proper technical architecture chart: two layer bands (headset runtime /
    GPU server), file names on every component, protocol-labeled arrows."""
    import html as _h
    W, H = 1240, 1330
    e = _h.escape

    def box(x, y, w, h, accent, tag, title, lines, title_size=15.5):
        s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#131a30" stroke="{accent}" stroke-width="1.4"/>']
        ty = y + 22
        if tag:
            s.append(f'<text x="{x+14}" y="{ty}" font-size="10" font-weight="800" fill="{accent}" letter-spacing="1">{e(tag)}</text>')
            ty += 17
        s.append(f'<text x="{x+14}" y="{ty}" font-size="{title_size}" font-weight="700" fill="#EDF1FA">{e(title)}</text>')
        ty += 17
        for line in lines:
            s.append(f'<text x="{x+14}" y="{ty}" font-size="11.5" fill="#aeb9d9">{e(line)}</text>')
            ty += 15.5
        return "".join(s), h

    def arrow_v(x, y1, y2, label=None):
        s = [f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2-7}" stroke="#6f7fb8" stroke-width="1.8" marker-end="url(#arr)"/>']
        if label:
            s.append(f'<text x="{x+8}" y="{(y1+y2)/2+4}" font-size="11" fill="#7f8ec4">{e(label)}</text>')
        return "".join(s)

    def arrow_h(x1, x2, y, label=None, dashed=False, above=True):
        d = ' stroke-dasharray="6 5"' if dashed else ""
        s = [f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#6f7fb8" stroke-width="1.8"{d} marker-end="url(#arr)"/>']
        if label:
            ly = y - 7 if above else y + 15
            s.append(f'<text x="{(x1+x2)/2}" y="{ly}" font-size="11" fill="#7f8ec4" text-anchor="middle">{e(label)}</text>')
        return "".join(s)

    def elbow(pts, label=None, dashed=False):
        d = ' stroke-dasharray="6 5"' if dashed else ""
        pts_s = " ".join(f"{x},{yy}" for x, yy in pts)
        s = [f'<polyline points="{pts_s}" fill="none" stroke="#6f7fb8" stroke-width="1.8"{d} marker-end="url(#arr)"/>']
        if label:
            mx = (pts[0][0] + pts[-1][0]) / 2
            my = pts[-1][1] - 7
            s.append(f'<text x="{mx}" y="{my}" font-size="11" fill="#7f8ec4" text-anchor="middle">{e(label)}</text>')
        return "".join(s)

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Inter, system-ui, sans-serif">',
         ARROW_DEFS, f'<rect width="{W}" height="{H}" fill="#0b101f"/>',
         f'<text x="40" y="46" font-size="23" font-weight="800" fill="#EDF1FA">Loci — technical architecture</text>',
         f'<text x="40" y="70" font-size="13" fill="#8fa3d8">One client runtime in the headset browser · one external dependency (Sage) behind a tunnel · persistence in the browser</text>']

    # Layer bands
    p.append(f'<rect x="30" y="92" width="760" height="1180" rx="14" fill="#0d1226" stroke="#232c4d"/>')
    p.append(f'<text x="48" y="120" font-size="12" font-weight="800" fill="#5b78e0" letter-spacing="1.2">HEADSET BROWSER — IWSDK WEBXR · 100% CLIENT-SIDE · NO DOM IN VR</text>')
    p.append(f'<rect x="830" y="92" width="380" height="640" rx="14" fill="#0d1226" stroke="#232c4d"/>')
    p.append(f'<text x="848" y="120" font-size="12" font-weight="800" fill="#e8b34b" letter-spacing="1.2">GPU SERVER — VIA CLOUDFLARE TUNNEL</text>')

    # INPUT row (4 channels)
    ch_w, ch_h, ch_y = 172, 74, 150
    channels = [
        ("MIC ORB", "Web Speech API", "desktop browsers"),
        ("TYPE ORB", "spatial QWERTY", "capture-keyboard.ts"),
        ("SEED CARDS", "1 touch = 5 thoughts", "curated sets"),
        ("DESKTOP BAR", "typed + Enter", "mouse path"),
    ]
    for i, (tag, l1, l2) in enumerate(channels):
        x = 50 + i * (ch_w + 12)
        b, _ = box(x, ch_y, ch_w, ch_h, "#5b78e0", tag, "capture", [l1, l2], title_size=13)
        p.append(b)

    # arrows into gate
    for i in range(4):
        x = 50 + i * (ch_w + 12) + ch_w / 2
        p.append(arrow_v(x, ch_y + ch_h, 268))

    # GATE
    b, h = box(50, 268, 340, 96, "#ea4a4a", "RUNS FIRST — EVERY CAPTURE", "Distress gate", [
        "distress-gate.ts · 16 reviewed trigger patterns",
        "before palace entry · before any model call",
        "fail direction: toward resources",
    ])
    p.append(b)

    # CRISIS branch
    p.append(arrow_h(390, 452, 316, label="flagged", above=True))
    b, _ = box(452, 268, 320, 96, "#ea4a4a", "SAFETY", "3D crisis panel", [
        "crisis-panel.ts · world-space · calm tone",
        "real resources: 988 · findahelpline.com",
        "crisActive blocks organize/recall/capture",
    ])
    p.append(b)

    # clear arrow down to organize
    p.append(arrow_v(220, 364, 396, label="clear"))

    # ORGANIZE: two parallel organizers
    b, _ = box(50, 396, 345, 118, "#8a93a8", "PATH A — INSTANT", "Heuristic organizer", [
        "clusterer.ts · overlap coefficient + union-find",
        "deterministic · zero network · always up",
        "result computed before the request is sent",
    ])
    p.append(b)
    b, _ = box(415, 396, 345, 118, GOLD, "PATH B — MODEL", "Model client", [
        "model-client.ts · schema-bound /api/chat call",
        "retry ×1 @1.5s · 30s timeout · warmup @boot",
        "sanitize: unknown ids dropped, leftovers swept",
    ])
    p.append(b)

    # server interaction: model client <-> ollama
    p.append(elbow([(760, 440), (805, 440), (805, 208), (840, 208)], label=None))
    p.append(arrow_h(840, 1180 - 20, 208, label=None) if False else "")
    p.append(f'<text x="808" y="330" font-size="10.5" fill="#7f8ec4" transform="rotate(90 808 330)" text-anchor="middle">POST /api/chat · JSON schema · GET /api/tags</text>')
    b, _ = box(848, 150, 340, 130, GOLD, "SAGE", "Ollama on the GPU box", [
        "qwen3:14b · 9.3 GB · pinned in model-client.ts",
        "also: gpt-oss:20b · qwen3.5:9b · bge-m3",
        "boot warmup: 1-token call, keep_alive 30 min",
    ])
    p.append(b)
    # response back
    p.append(elbow([(1018, 280), (1060, 280), (1060, 470), (760, 470)], label="clusters · edges · suggestions (JSON)", dashed=True))
    # sanitize box under ollama
    b, _ = box(848, 380, 340, 130, GOLD, "RESPONSE PIPELINE", "Sanitize + arbitrate", [
        "JSON parse or discard · unknown ids dropped",
        "coverage >= 60% -> model wins, else local",
        "leftover notes -> 'Loose threads' cluster",
        "suggestions capped: 1 expand + 1 challenge",
    ])
    p.append(b)
    p.append(arrow_h(848, 760, 470, label="sanitized result", dashed=True, above=False))

    # arbitration bar
    b, _ = box(50, 540, 710, 54, GOLD, "ARBITRATION", "≥60% coverage → model wins (orb GOLD) · else local stands (orb GRAY) — the orb records who shaped the layout", [], title_size=13.5)
    p.append(b)

    p.append(arrow_v(220, 594, 630))
    b, _ = box(50, 630, 710, 96, "#2fbf9a", "THE PAYOFF", "SnapSystem — the snap", [
        "flights: eased arcs with particle trails (additive blending)",
        "connection lines draw in · synthesized resolving chord",
        "canvas type at 1536 px/m · faux-bold · zero font assets",
    ])
    p.append(b)

    p.append(arrow_v(220, 726, 756))
    b, _ = box(50, 756, 710, 96, "#5b78e0", "HUMAN AUTHORITY", "Arrange — cards you own", [
        "OneHandGrabbable / pinch · drag on desktop · webcam hands optional",
        "userPlaced = true on release → agent never reorganizes them",
        "declump: targets relax ≥0.185 m around placements (obstacles, not victims)",
    ])
    p.append(b)

    p.append(arrow_v(220, 852, 882))
    b, _ = box(50, 882, 710, 108, SKY, "PERSISTENCE", "palace-store.ts — loci.palace.v1", [
        "localStorage: notes[] · edges[] · clusterLabels[] · recall{strength,seen}",
        "history: ≤30 snapshots {at, notes, edges} — Rewind's raw material",
        "debounced 600ms/1800ms · beforeunload flush · skipped during scrubs · JSON export",
    ])
    p.append(b)

    p.append(arrow_v(220, 990, 1022, label="next visit"))
    b, _ = box(50, 1022, 340, 120, VIOLET, "RETURN + RECALL", "RecallSystem", [
        "greeting: 'last here N ago · N thoughts due'",
        "quiz: weakest/never-seen first · touch or voice",
        "grading: strength 0–5 · misses resurface first",
    ])
    p.append(b)
    b, _ = box(420, 1022, 340, 120, VIOLET, "REWIND", "Spatial dial", [
        "OneHandGrabbable knob on a track",
        "30 snapshots replay with the snap motion",
        "scrubs never recorded as history",
    ])
    p.append(b)

    # legend strip
    b, _ = box(50, 1180, 710, 76, "#56639a", "LEGEND + MEASURED", "", [
        "GOLD orb = model shaped the layout · GRAY = local fallback ran",
        "measured: boot→interactive 1.5s · capture→organize 2.2s · snap <1s local / 6–11s warm · recall 1.1s",
    ], title_size=13)
    p.append(b)

    svg = "".join(p) + "</svg>\n"
    import os
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "master-system.svg"), "w") as f:
        f.write(svg)
    print(f"  wrote diagrams/master-system.svg ({H}px tall, technical layout)")


architecture_technical()
