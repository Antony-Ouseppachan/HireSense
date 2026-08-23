export default function Logo({ size = 32, variant = "mono", className }) {
  const glow = variant === "glow";
  const dim = typeof size === "number" ? size : undefined;

  return (
    <svg
      {...(dim ? { width: dim, height: dim } : {})}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
    >
      {/* Outer orbit ring */}
      <circle
        cx="50" cy="50" r="43"
        stroke={glow ? "url(#lg)" : "currentColor"}
        strokeWidth="2"
        opacity={glow ? 0.5 : 0.3}
      />

      {/* Inner orbit ring */}
      <circle
        cx="50" cy="50" r="33"
        stroke={glow ? "url(#lg)" : "currentColor"}
        strokeWidth="1"
        opacity={glow ? 0.3 : 0.15}
        strokeDasharray="4 8"
      />

      {/* Crosshair axis lines */}
      <line x1="50" y1="8" x2="50" y2="22" stroke="currentColor" strokeWidth="1.2" opacity={glow ? 0.4 : 0.2} />
      <line x1="50" y1="78" x2="50" y2="92" stroke="currentColor" strokeWidth="1.2" opacity={glow ? 0.4 : 0.2} />
      <line x1="8" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="1.2" opacity={glow ? 0.4 : 0.2} />
      <line x1="78" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="1.2" opacity={glow ? 0.4 : 0.2} />

      {/* Core satellite ring */}
      <circle
        cx="50" cy="50" r="16"
        stroke={glow ? "url(#lg)" : "currentColor"}
        strokeWidth="1.5"
        opacity={glow ? 0.6 : 0.25}
      />

      {/* Center node */}
      {glow ? (
        <circle cx="50" cy="50" r="6" fill="currentColor" filter="url(#lf)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" begin="1s" />
        </circle>
      ) : (
        <circle cx="50" cy="50" r="6" fill="currentColor" opacity="0.7" />
      )}

      {/* Orbital node indicators */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 50 + 33 * Math.sin(rad);
        const cy = 50 - 33 * Math.cos(rad);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="2.5"
            fill="currentColor"
            opacity={glow ? 0.5 : 0.2}
          />
        );
      })}

      {glow && (
        <defs>
          <radialGradient id="lg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C9CED8" stopOpacity="0.3" />
          </radialGradient>
          <filter id="lf" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ffffff" floodOpacity="0.4" />
          </filter>
        </defs>
      )}
    </svg>
  );
}
