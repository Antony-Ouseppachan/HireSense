import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import ParticleBackground from "../components/ParticleBackground";
import "../styles/Home.css";

function CountUp({ to, duration = 2000, suffix = "" }) {
  const ref = useRef(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.floor(eased * to);
      if (ref.current) ref.current.textContent = `${val}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [to, duration, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const FEATURES = [
  { num: "01", title: "AI-Powered Practice", desc: "Smart questions tailored to your role, experience, and skill gaps generated in real-time.", icon: "layers" },
  { num: "02", title: "Instant Feedback", desc: "Get detailed analysis and actionable insights immediately after each session.", icon: "zap" },
  { num: "03", title: "Track Progress", desc: "Monitor your improvement with detailed analytics and performance trends over time.", icon: "trending" },
  { num: "04", title: "Resume Analysis", desc: "Upload your resume and let AI identify strengths and improvement areas.", icon: "file" },
  { num: "05", title: "Multiple Domains", desc: "Practice across technical, behavioral, aptitude, and domain-specific categories.", icon: "grid" },
  { num: "06", title: "Adaptive Learning", desc: "Each session adapts to your performance, focusing on what needs improvement.", icon: "activity" },
];

const MARQUEE_ITEMS = [
  "Software Engineer", "Data Scientist", "Product Manager",
  "Frontend Developer", "Backend Engineer", "ML Engineer",
  "DevOps Engineer", "UX Designer", "Cloud Architect",
  "Full Stack Developer", "AI Engineer", "Security Analyst",
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

function Home() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="home-root">
      {/* ─── Hero ─── */}
      <section className="hero">
        {/* Mouse-reactive particle background */}
        <ParticleBackground />
        {/* Floating background elements */}
        <div className="hero-floating-shapes">
          <div className="hero-float-shape" style={{ top: "20%", left: "8%", width: 60, height: 60, animationDelay: "0s" }} />
          <div className="hero-float-shape" style={{ top: "60%", right: "10%", width: 40, height: 40, animationDelay: "-5s", animationDuration: "18s" }} />
          <div className="hero-float-shape" style={{ top: "30%", right: "20%", width: 24, height: 24, animationDelay: "-10s", animationDuration: "15s" }} />
          <div className="hero-float-shape" style={{ bottom: "25%", left: "15%", width: 32, height: 32, animationDelay: "-7s", animationDuration: "20s" }} />
        </div>

        <motion.div className="hero-content" variants={container} initial="hidden" animate="show">
          <motion.div className="hero-badge" variants={itemAnim}>
            <span className="hero-badge-dot" />
            AI-Powered Interview Platform
          </motion.div>

          <motion.h1 className="hero-title" variants={itemAnim}>
            <span className="hero-title-line">Master Every</span>
            <span className="hero-title-line hero-title-accent">Interview</span>
          </motion.h1>

          <motion.p className="hero-desc" variants={itemAnim}>
            Practice real-world interviews with AI feedback. Track your progress.
            Land your dream role.
          </motion.p>

          <motion.div className="hero-actions" variants={itemAnim}>
            <Link to="/register" className={`hero-btn hero-btn-primary ${isLight ? "light" : ""}`}>
              <span>Get Started</span>
              <svg className="hero-btn-arrow" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link to="/login" className="hero-btn hero-btn-secondary">
              Sign In
            </Link>
          </motion.div>

          {/* Stats bar */}
          <motion.div className="hero-stats" variants={itemAnim}>
            <div className="hero-stat">
              <span className="hero-stat-value"><CountUp to={5000} suffix="+" /></span>
              <span className="hero-stat-label">Questions Generated</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value"><CountUp to={98} suffix="%" /></span>
              <span className="hero-stat-label">Satisfaction Rate</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value"><CountUp to={100} suffix="%" /></span>
              <span className="hero-stat-label">Free to Start</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Marquee ─── */}
      <section className="marquee-section">
        <div className="marquee-track">
          <div className="marquee-content">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="marquee-item">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="features">
        <motion.div
          className="features-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="features-eyebrow">CAPABILITIES</span>
          <h2 className="features-title">Everything you need to succeed</h2>
          <p className="features-subtitle">From AI-powered practice to detailed analytics, we've got you covered.</p>
        </motion.div>

        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
            >
              <div className="feature-icon-wrap">
                <span className="feature-icon-num">{f.num}</span>
                <FeatureIcon name={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta">
        <motion.div
          className="cta-glass"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cta-glow" />
          <h2 className="cta-title">Ready to launch your career?</h2>
          <p className="cta-desc">Join thousands of candidates using HireSense to prepare for their interviews.</p>
          <Link to="/register" className={`hero-btn hero-btn-primary ${isLight ? "light" : ""}`}>
            <span>Get Started Free</span>
            <svg className="hero-btn-arrow" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}

function FeatureIcon({ name }) {
  const paths = {
    layers: <><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" /></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" className="feature-icon-svg">{paths[name]}</svg>;
}

export default Home;
