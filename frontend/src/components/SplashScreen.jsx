import { useEffect, useState } from "react";
import "../styles/SplashScreen.css";

function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Dynamic progress simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }

        let inc = 1;
        if (prev < 25) {
          inc = Math.floor(Math.random() * 4) + 3; // Fast initial load
        } else if (prev >= 25 && prev < 65) {
          inc = Math.floor(Math.random() * 2) + 1; // Average load
        } else if (prev >= 65 && prev < 88) {
          inc = Math.random() > 0.65 ? 1 : 0; // Simulate pausing for heavy AI modules
        } else {
          inc = Math.floor(Math.random() * 5) + 3; // Finishing burst
        }

        const next = Math.min(100, prev + inc);
        if (next === 100) {
          clearInterval(interval);
          // Trigger exit sequence
          setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => {
              onComplete();
            }, 600); // Match CSS fadeout duration
          }, 500);
        }
        return next;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete]);

  // Dynamic status messages corresponding to load progress
  const getStatusMessage = () => {
    if (progress < 25) return "Initializing HireSense Core Engine...";
    if (progress < 55) return "Establishing Secure PostgreSQL Tunnel...";
    if (progress < 85) return "Syncing Qwen3 AI & Resume Analysis Models...";
    if (progress < 98) return "Optimizing Client Dashboard Environment...";
    return "Core Systems Online. Redirecting...";
  };

  return (
    <div className={`splash-container ${isFadingOut ? "fade-out" : ""}`}>
      {/* Blueprint grid overlay and ambient orbs */}
      <div className="splash-background">
        <div className="tech-grid"></div>
        <div className="animated-gradient"></div>
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>

      <div className="splash-content">
        {/* Holographic scanning container */}
        <div className="hologram-card">
          <div className="scanner-line"></div>

          <div className="logo-section">
            <div className="reactor-container">
              <svg className="hologram-reactor" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="reactorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                {/* Outer scanning rings */}
                <circle className="reactor-ring ring-outer" cx="50" cy="50" r="44" />
                <circle className="reactor-ring ring-mid" cx="50" cy="50" r="34" strokeDasharray="12 6" />
                <circle className="reactor-ring ring-inner" cx="50" cy="50" r="24" strokeDasharray="6 12" />
                {/* Reactor Core Structure */}
                <polygon className="reactor-core" points="50,30 67,40 60,60 40,60 33,40" fill="url(#reactorGrad)" />
                <circle className="reactor-pulse-node" cx="50" cy="50" r="5" />
              </svg>
            </div>
            <h1 className="splash-title">HIRESENSE</h1>
            <p className="splash-subtitle">AI-POWERED RECRUITMENT SUITE</p>
          </div>

          <div className="loader-section">
            {/* Numeric loading counter */}
            <div className="progress-percentage-wrapper">
              <span className="progress-percentage">{progress}</span>
              <span className="progress-percentage-symbol">%</span>
            </div>

            {/* Glowing progress bar */}
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              >
                <div className="progress-bar-glow"></div>
              </div>
            </div>

            {/* Simulated terminal logging info */}
            <div className="status-logging">
              <span className="terminal-prompt">&gt;</span>
              <p className="loading-text">{getStatusMessage()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
