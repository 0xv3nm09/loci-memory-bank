import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { CLUSTER_ACCENTS } from "@/lib/palette";
import { sfx, startDrone } from "@/lib/audio";

// Opening story: stars -> Sage -> scattered notes -> snap -> recall -> modes.
const NOTES = [
  { t: "Call mom", g: 0 }, { t: "Book idea", g: 1 }, { t: "Gym 3x", g: 2 },
  { t: "Birthday gift", g: 0 }, { t: "Plot twist", g: 1 }, { t: "Sleep by 11", g: 2 },
  { t: "Dinner Sunday", g: 0 }, { t: "Hero's name", g: 1 }, { t: "Drink water", g: 2 },
];
const SCATTER = [[18, 15], [75, 10], [45, 75], [78, 52], [22, 48], [52, 35], [18, 87], [50, 6], [78, 88]];
const CENTERS = [[20, 42], [50, 25], [80, 42]];
const LABELS = ["Family", "Story", "Health"];
const LINES = ["Let's give your thoughts a home.", "A busy mind scatters…", "…Loci gathers what belongs together.", "And helps you remember it.", "Choose where to begin."];
const AT = [0, 1800, 4200, 6800, 9800, 12800]; // phase start times (ms)

export function Intro({ onDone }: { onDone: () => void }) {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!started) return;
    const ts = AT.map((ms, i) => setTimeout(() => {
      setPhase(i);
      if (i === 1) sfx.welcome();
      if (i === 3) sfx.snap();
      if (i === 4) setTimeout(() => sfx.correct(), 1400);
      if (i === 5) sfx.connect();
    }, ms));
    return () => ts.forEach(clearTimeout);
  }, [started]);

  const finish = () => { setLeaving(true); setTimeout(onDone, 700); };
  const begin = () => { try { startDrone(); } catch {} setStarted(true); };
  const grouped = phase >= 3;
  const line = phase >= 1 ? LINES[Math.min(phase - 1, LINES.length - 1)] : "";

  return (
    <div role="dialog" aria-label="Welcome to Loci" className={`fixed inset-0 z-[150] overflow-hidden bg-background transition-opacity duration-700 ${leaving ? "opacity-0" : "opacity-100"}`}>
      {!started ? (
        <Button variant="bare" size="natural" onClick={begin} className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <div className="splash-orb h-14 w-14 rounded-full" />
          <span className="text-gradient-splash text-3xl font-bold tracking-[0.06em]">Loci</span>
          <span className="intro-breathe text-sm text-ink-muted">Tap to begin · sound on</span>
        </Button>
      ) : (<>
        {/* Sage */}
        <div className={`absolute left-1/2 top-[14%] -translate-x-1/2 transition-all duration-1000 ${phase >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}>
          <div className="intro-sage h-16 w-16 rounded-full" style={{ background: "radial-gradient(circle, #ffe2b0 0%, #f0b24f88 40%, transparent 70%)", boxShadow: "0 0 60px #f0b24f66" }} />
        </div>
        <p key={line} className="intro-line absolute left-1/2 top-[26%] w-[90%] -translate-x-1/2 text-center text-lg text-foreground sm:text-xl">{line}</p>

        <div className="intro-stage absolute inset-x-4 top-[34%] bottom-[8%]">
        {/* Notes */}
        {phase >= 2 && phase < 5 && NOTES.map((n, i) => {
          const [cx = 0, cy = 0] = (CENTERS[n.g] ?? [50, 50]); const k = NOTES.filter((m, j) => m.g === n.g && j < i).length;
          const [x = 0, y = 0] = grouped ? [cx + 0, cy + k * 13] : (SCATTER[i] ?? [50, 50]);
          const hidden = phase === 4 && i === 1;
          return (
            <div key={i} className="intro-note absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border px-2 py-1.5 text-[10px] sm:px-3 sm:text-sm"
              style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 90}ms`, borderColor: grouped ? CLUSTER_ACCENTS[n.g] : "var(--border)", boxShadow: grouped ? `0 0 18px ${CLUSTER_ACCENTS[n.g]}55` : "none", opacity: grouped ? 1 : 0.55, filter: hidden ? "blur(5px)" : "none", transition: "all 900ms cubic-bezier(.2,1.4,.4,1)" }}>
              {n.t}
            </div>
          );
        })}
        {phase >= 3 && phase < 5 && (<>
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {([[0, 1], [1, 2]] as const).map(([a, b]) => <line key={a} className="intro-link" x1={`${(CENTERS[a]?.[0] ?? 50)}%`} y1={`${(CENTERS[a]?.[1] ?? 50)}%`} x2={`${(CENTERS[b]?.[0] ?? 50)}%`} y2={`${(CENTERS[b]?.[1] ?? 50)}%`} stroke="var(--accent)" strokeWidth={1.5} />)}
          </svg>
          {LABELS.map((l, g) => <div key={l} className="intro-line absolute -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ left: `${(CENTERS[g]?.[0] ?? 50)}%`, top: `${(CENTERS[g]?.[1] ?? 50) - 9}%`, color: CLUSTER_ACCENTS[g] }}>{l}</div>)}
          <div className="bloom-flash pointer-events-none absolute inset-0" />
        </>)}

        </div>
        {/* Modes */}
        {phase >= 5 && (
          <div className="absolute inset-x-0 top-[42%] flex justify-center gap-6 sm:gap-12">
            {["Think", "Grow", "Imagine"].map((m, i) => (
              <div key={m} className="intro-pop flex flex-col items-center gap-2" style={{ animationDelay: `${i * 200}ms` }}>
                <div className="intro-sage h-12 w-12 rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, #fff8, ${CLUSTER_ACCENTS[i]} 60%)`, boxShadow: `0 0 30px ${CLUSTER_ACCENTS[i]}` }} />
                <span className="text-sm text-secondary-foreground">{m}</span>
              </div>
            ))}
          </div>
        )}
        {phase >= 5 && <div className="absolute inset-x-0 bottom-[18%] flex justify-center"><Button variant="bare" size="natural" className="loci-btn intro-pop px-8 py-3 text-sm" onClick={finish}>Enter your palace</Button></div>}
        <Button variant="bare" size="natural" className="absolute right-4 top-4 px-3 py-1.5 text-xs text-ink-muted hover:text-ink-dim" onClick={finish}>Skip</Button>
      </>)}
    </div>
  );
}
