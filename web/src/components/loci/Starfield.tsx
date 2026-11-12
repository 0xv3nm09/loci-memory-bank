import { useEffect, useRef } from "react";
import { nebulaTint } from "@/lib/palette";

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2, p: Math.random() * Math.PI * 2,
    }));
    const resize = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; };
    resize();
    addEventListener("resize", resize);
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const { r, g, b } = nebulaTint(t);
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);
      const neb = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.7);
      neb.addColorStop(0, `rgba(${r * 255},${g * 255},${b * 255},0.10)`);
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.p));
        const x = ((s.x + t * 0.003 * s.z) % 1) * w;
        ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${tw * s.z * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, s.y * h, s.z * 1.4 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />;
}
