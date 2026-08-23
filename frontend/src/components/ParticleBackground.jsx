import { useEffect, useRef } from "react";

/**
 * ParticleBackground
 * A static field of small dashes spread across the whole hero area (like
 * Antigravity's background). Dots don't stream or chase the cursor — they sit
 * in place, and any dot near the cursor eases smoothly outward to the edge of
 * a radius, leaving a calm gap around the pointer. Move the mouse away and
 * they ease back home just as smoothly.
 *
 * Usage: mount inside a `position: relative` hero section, before your content:
 *
 *   <section className="hero" style={{ position: "relative", overflow: "hidden" }}>
 *     <ParticleBackground />
 *     <div style={{ position: "relative", zIndex: 2 }}>...hero content...</div>
 *   </section>
 */

const COLORS = [
  "#3d5af1", "#4c5fd6", "#5468e0", "#6674e8", // blues (majority)
  "#7c5cff", "#8b6cf9", // purple accent (occasional)
];
const DUST_COLOR = "#64748b"; // tiny neutral flecks for texture

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export default function ParticleBackground({
  density = 1250, // lower = more dots. area(px) / density = dot count
  repelRadius = 120, // gap radius kept clear around the cursor
  ease = 0.1, // how smoothly dots move to/from their pushed position (lower = smoother/slower)
  breezeStrength = 32, // how far (px) the wind can carry a dot from its home position
  breezeSpeed = 8, // multiplier on how fast the gusts shift (1 = default pace)
  className = "",
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;

    class Dot {
      constructor(x, y) {
        this.homeX = x;
        this.homeY = y;
        this.x = x;
        this.y = y;
        const isDust = Math.random() < 0.25;
        this.isDust = isDust;
        this.color = isDust ? DUST_COLOR : COLORS[Math.floor(Math.random() * COLORS.length)];
        this.length = isDust ? rand(1, 1.8) : rand(3, 8);
        this.thickness = isDust ? rand(1, 1.4) : rand(1, 1.8);
        this.rotation = rand(0, Math.PI * 2);
        this.alpha = isDust ? rand(0.35, 0.6) : rand(0.75, 1);
        // gentle idle jitter so the field feels alive without racing around
        this.jitterPhase = rand(0, Math.PI * 2);
        this.jitterSpeed = rand(0.003, 0.008);
        this.jitterAmount = rand(0.6, 1.6);
        // per-dot variation on the shared breeze, so the field doesn't move in lockstep
        this.breezePhase = rand(0, Math.PI * 2);
        this.breezeScale = rand(0.6, 1.4);
      }

      step(mx, my, time) {
        this.jitterPhase += this.jitterSpeed;
        const jx = Math.cos(this.jitterPhase) * this.jitterAmount;
        const jy = Math.sin(this.jitterPhase * 1.3) * this.jitterAmount;

        // shared breeze: a slowly rotating wind direction with gust-like strength,
        // individualized per dot via breezePhase/breezeScale
        const windAngle = -0.15 + Math.sin(time * 0.00015) * 0.4;
        const gust = (Math.sin(time * 0.00012 + this.breezePhase) * 0.5 + 0.5) * breezeStrength * this.breezeScale;
        const windX = Math.cos(windAngle) * gust;
        const windY = Math.sin(windAngle) * gust * 0.35;

        let targetX = this.homeX + windX + jx;
        let targetY = this.homeY + windY + jy;

        const dx = this.homeX - mx;
        const dy = this.homeY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < repelRadius && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;
          targetX = mx + nx * repelRadius + jx;
          targetY = my + ny * repelRadius + jy;
        }

        this.x += (targetX - this.x) * ease;
        this.y += (targetY - this.y) * ease;
      }

      draw() {
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = "round";
        const dx = Math.cos(this.rotation) * (this.length / 2);
        const dy = Math.sin(this.rotation) * (this.length / 2);
        ctx.beginPath();
        ctx.moveTo(this.x - dx, this.y - dy);
        ctx.lineTo(this.x + dx, this.y + dy);
        ctx.stroke();
      }
    }

    function buildField() {
      const count = Math.round((width * height) / density);
      particlesRef.current = Array.from({ length: count }, () => new Dot(rand(0, width), rand(0, height)));
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField();
    }

    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function handleMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    function loop() {
      timeRef.current += 16 * breezeSpeed;
      const { x: mx, y: my } = mouseRef.current;
      ctx.clearRect(0, 0, width, height);
      particlesRef.current.forEach((p) => {
        p.step(mx, my, timeRef.current);
        p.draw();
      });
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [density, repelRadius, ease, breezeStrength, breezeSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}