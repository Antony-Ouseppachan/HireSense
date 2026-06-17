import { useEffect } from "react";
import "../styles/SplashScreen.css";

function SplashScreen({ onComplete }) {
  useEffect(() => {
    // Show splash for 3 seconds then load the app
    const timer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-container">
      <div className="splash-background">
        <div className="animated-gradient"></div>
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
      </div>

      <div className="splash-content">
        <div className="flashcard">
          <div className="card-inner">
            <div className="card-front">
              <div className="logo-container">
                <div className="logo-icon"></div>
              </div>
              <h1 className="splash-title">HireSense</h1>
              <p className="splash-subtitle">AI-Powered Interview Platform</p>
              <p className="splash-tagline">Master Your Career Potential</p>
            </div>
          </div>
        </div>

        <div className="loading-container">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p className="loading-text">Initializing Platform</p>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
