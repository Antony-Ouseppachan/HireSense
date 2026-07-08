import { Link } from "react-router-dom";
import "../styles/Home.css";

function Home({ user }) {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Master Your <span className="gradient-text">Interviews</span> with AI
          </h1>
          <p className="hero-subtitle">
            Practice real-world interviews, get instant feedback, and boost your confidence with HireSense
          </p>
          <div className="hero-buttons">
            <Link to="/interviews" className="btn-primary">
              Get Started
            </Link>
            <Link to="/dashboard" className="btn-secondary">
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-content">
              <div className="icon icon-speak"></div>
              <p>Answer Questions</p>
            </div>
          </div>
          <div className="floating-card card-2">
            <div className="card-content">
              <div className="icon icon-analysis"></div>
              <p>Get Analysis</p>
            </div>
          </div>
          <div className="floating-card card-3">
            <div className="card-content">
              <div className="icon icon-improve"></div>
              <p>Improve Score</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Why HireSense?</h2>
        <div className="features-grid">
          <div className="feature-card feature-ai">
            <div className="feature-icon icon-ai"></div>
            <h3>AI-Powered Feedback</h3>
            <p>Get detailed analysis of your performance with actionable insights</p>
          </div>
          <div className="feature-card feature-scenario">
            <div className="feature-icon icon-scenario"></div>
            <h3>Realistic Scenarios</h3>
            <p>Practice with industry-standard questions and real interview patterns</p>
          </div>
          <div className="feature-card feature-track">
            <div className="feature-icon icon-track"></div>
            <h3>Track Progress</h3>
            <p>Monitor your improvement over time with detailed analytics</p>
          </div>
          <div className="feature-card feature-resume">
            <div className="feature-icon icon-resume"></div>
            <h3>Resume Analysis</h3>
            <p>Optimize your resume with AI-powered suggestions</p>
          </div>
          <div className="feature-card feature-tips">
            <div className="feature-icon icon-tips"></div>
            <h3>Expert Tips</h3>
            <p>Learn from industry experts and best practices</p>
          </div>
          <div className="feature-card feature-ready">
            <div className="feature-icon icon-ready-feature"></div>
            <h3>Interview Ready</h3>
            <p>Be fully prepared and confident for your next interview</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Ace Your Interview?</h2>
          <p>Join thousands of candidates who've improved their interview skills</p>
          <Link to="/dashboard" className="btn-primary btn-large">
            Get Started Now
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Home;
