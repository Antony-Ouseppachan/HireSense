import { useEffect, useRef, useState } from "react";
import "../styles/SplashScreen.css";
import Logo from "./Logo";

const PARTICLE_COUNT = 120;
const PHASE = { ENTER: "enter", HOLD: "hold", EXIT: "exit" };

// Monochromatic white/silver space dust particles
const PARTICLE_COLORS = [
  "255, 255, 255",
  "230, 232, 240",
  "210, 212, 220",
  "190, 192, 200",
];

function createParticles(width, height) {
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const depth = Math.random();
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.6 + depth * 1.8,
      baseOpacity: 0.15 + depth * 0.6,
      depth,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      vx: (Math.random() - 0.5) * 0.06 * (0.4 + depth),
      vy: (Math.random() - 0.5) * 0.06 * (0.4 + depth),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.4 + Math.random() * 0.8,
      burstVx: 0,
      burstVy: 0,
    });
  }
  return particles;
}

export default function SplashScreen({
  onComplete,
  ready = true,
  minDurationMs = 2200,
  maxHoldMs = 6000,
  exitDurationMs = 950,
  tagline = "AI-Powered Mock Interview Platform",
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const phaseRef = useRef(PHASE.ENTER);
  const exitStartRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const readyRef = useRef(ready);
  const exitTriggeredRef = useRef(false);

  const [phase, setPhase] = useState(PHASE.ENTER);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const triggerExit = () => {
    if (exitTriggeredRef.current) return;
    exitTriggeredRef.current = true;

    exitStartRef.current = performance.now();
    const w = canvasRef.current?.width || 0;
    const h = canvasRef.current?.height || 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cx = w / dpr / 2;
    const cy = h / dpr / 2;

    particlesRef.current.forEach((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const speed = 2.5 + p.depth * 6 + Math.random() * 2;
      p.burstVx = (dx / dist) * speed;
      p.burstVy = (dy / dist) * speed;
    });

    setPhase(PHASE.EXIT);
  };

  // ---------- Lifecycle timing ----------
  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase(PHASE.HOLD), 150);

    // Poll every 100ms after minDurationMs: exit as soon as `ready` flips true,
    // capped by maxHoldMs so the splash never hangs forever.
    let pollInterval;
    const minTimer = setTimeout(() => {
      if (readyRef.current) {
        triggerExit();
        return;
      }
      pollInterval = setInterval(() => {
        if (readyRef.current) {
          clearInterval(pollInterval);
          triggerExit();
        }
      }, 100);
    }, minDurationMs);

    const hardCapTimer = setTimeout(() => {
      triggerExit();
    }, maxHoldMs);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(minTimer);
      clearTimeout(hardCapTimer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [minDurationMs, maxHoldMs]);

  // Fire onComplete once the exit CSS animation has had time to finish
  useEffect(() => {
    if (phase !== PHASE.EXIT) return;
    const t = setTimeout(() => onComplete?.(), exitDurationMs);
    return () => clearTimeout(t);
  }, [phase, exitDurationMs, onComplete]);

  // ---------- Canvas particle system ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = createParticles(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    const handlePointerMove = (e) => {
      pointerRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", handlePointerMove);

    let lastTime = performance.now();

    const draw = (now) => {
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const currentPhase = phaseRef.current;

      ctx.clearRect(0, 0, w, h);

      let exitProgress = 0;
      if (currentPhase === PHASE.EXIT && exitStartRef.current) {
        exitProgress = Math.min(1, (now - exitStartRef.current) / exitDurationMs);
      }

      const parallaxX = pointerRef.current.x;
      const parallaxY = pointerRef.current.y;

      particlesRef.current.forEach((p) => {
        p.twinklePhase += p.twinkleSpeed * (dt / 1000);
        const twinkle = 0.75 + 0.25 * Math.sin(p.twinklePhase);

        if (currentPhase === PHASE.EXIT) {
          p.x += p.burstVx * (dt / 16);
          p.y += p.burstVy * (dt / 16);
        } else {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }

        const px = p.x + parallaxX * p.depth * 14;
        const py = p.y + parallaxY * p.depth * 14;

        const fadeOut = currentPhase === PHASE.EXIT ? 1 - exitProgress : 1;
        const opacity = p.baseOpacity * twinkle * fadeOut;
        if (opacity <= 0.01) return;

        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color}, ${opacity})`;
        ctx.shadowColor = `rgba(255, 255, 255, ${Math.min(opacity + 0.1, 0.5)})`;
        ctx.shadowBlur = p.depth > 0.7 ? 5 : 0;
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [exitDurationMs]);

  return (
    <div className={`splash-root splash-${phase}`} style={{ "--splash-exit-duration": `${exitDurationMs}ms` }}>
      <canvas ref={canvasRef} className="splash-canvas" />

      <div className="splash-glow" />

      <div className="splash-content">
        <div className="splash-mark-wrapper">
          <Logo size="100%" variant="glow" className="splash-mark" />
        </div>

        <h1 className="splash-wordmark">HIRESENSE</h1>
        <p className="splash-tagline">{tagline}</p>
      </div>
    </div>
  );
}
