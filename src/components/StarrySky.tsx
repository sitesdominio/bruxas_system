import { useEffect, useRef } from "react";

/** Céu noturno: estrelas cintilando, paralaxe com o mouse e estrelas cadentes. */
export function StarrySky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    type Star = { x: number; y: number; r: number; d: number; p: number; s: number };
    let stars: Star[] = [];
    const shooting: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      w = c.width = window.innerWidth; h = c.height = window.innerHeight;
      stars = Array.from({ length: Math.floor((w * h) / 2600) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.2,
        d: Math.random() * 3 + 0.5, p: Math.random() * Math.PI * 2, s: Math.random() * 0.02 + 0.005,
      }));
    };
    const onMove = (e: MouseEvent) => { mouse.tx = (e.clientX / w - 0.5) * 2; mouse.ty = (e.clientY / h - 0.5) * 2; };
    const onClick = (e: MouseEvent) => shooting.push({ x: e.clientX, y: e.clientY, vx: 7, vy: 3, life: 1 });

    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.p += s.s;
        const a = 0.35 + Math.sin(s.p) * 0.35 + 0.3;
        const x = (s.x - mouse.x * s.d * 8 + w) % w, y = (s.y - mouse.y * s.d * 8 + h) % h;
        ctx.globalAlpha = a; ctx.fillStyle = s.r > 1.2 ? "#f3e3ff" : "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.r > 1.3) { ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(x, y, s.r * 4, 0, Math.PI * 2); ctx.fill(); }
      }
      if (!reduce && Math.random() < 0.004) shooting.push({ x: Math.random() * w * 0.7, y: Math.random() * h * 0.4, vx: 8, vy: 3.5, life: 1 });
      for (let i = shooting.length - 1; i >= 0; i--) {
        const m = shooting[i]!;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        g.addColorStop(0, `rgba(255,255,255,${m.life})`); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12); ctx.stroke();
        m.x += m.vx; m.y += m.vy; m.life -= 0.015;
        if (m.life <= 0) shooting.splice(i, 1);
      }
      raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); window.removeEventListener("click", onClick); };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
