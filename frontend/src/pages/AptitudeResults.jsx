import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeResult } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

function ScoreRing({ pct, size = 120 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="apt-score-ring-wrap" style={{ width: size, height: size }}>
      <svg className="apt-score-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="apt-score-value">{Math.round(pct)}%</span>
    </div>
  );
}

function AnimatedBar({ name, pct, className = "" }) {
  return (
    <div className={`apt-topic-row ${className}`}>
      <span className="apt-topic-name">{name}</span>
      <div className="apt-topic-bar-track">
        <motion.div className="apt-topic-bar-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <span className="apt-topic-pct">{Math.round(pct)}%</span>
    </div>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function AptitudeResults() {
  const { id } = useParams();
  const location = useLocation();
  const stateResult = location.state?.result;

  const [result, setResult] = useState(stateResult || null);
  const [loading, setLoading] = useState(!stateResult);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (stateResult) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getAptitudeResult(id);
        setResult(res?.result || res);
      } catch {
        setError("Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, stateResult]);

  if (loading) return <div className="apt-page"><div className="apt-loading"><LoadingSpinner label="Loading results..." /></div></div>;
  if (error) return (
    <div className="apt-page"><div className="apt-container"><div className="apt-error">
      <svg className="apt-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
      <h3>Results not found</h3><p>{error}</p>
      <Link to="/aptitude" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Take Another Test</Link>
    </div></div></div>);
  if (!result) return null;

  const r = result;
  const score = r.score ?? r.percentage ?? 0;
  const correct = r.correct ?? r.correctAnswers ?? 0;
  const total = r.total ?? r.questions?.length ?? 0;
  const incorrect = r.incorrect ?? r.incorrectAnswers ?? 0;
  const skipped = total - correct - incorrect;
  const accuracy = correct > 0 ? (correct / (correct + incorrect)) * 100 : 0;
  const status = r.terminated ? "disqualified" : score >= 40 ? "passed" : "failed";
  const difficulty = r.difficulty || "medium";
  const timeTaken = r.timeTaken || r.duration || 0;
  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;
  const violated = (r.violations || []).length;
  const riskLevel = violated === 0 ? "low" : violated <= 2 ? "medium" : violated <= 4 ? "high" : "critical";

  const topicPct = {};
  if (r.topicPerformance) {
    Object.entries(r.topicPerformance).forEach(([topic, pct]) => { topicPct[topic] = pct; });
  }
  const diffPct = {};
  if (r.difficultyPerformance) {
    Object.entries(r.difficultyPerformance).forEach(([d, pct]) => { diffPct[d] = pct; });
  }

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        {/* Header */}
        <motion.div className="apt-results-header" variants={itemAnim}>
          <ScoreRing pct={score} />
          <div className={`apt-status-badge apt-status-${status}`}>{status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Disqualified"}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: "4px 0 0", letterSpacing: "-0.02em" }}>Assessment Complete</h1>
          <div className="apt-results-meta">
            <span>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Difficulty</span>
            <span>{mins}m {secs}s</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div className="apt-results-stats" variants={itemAnim}>
          {[
            { value: correct, label: "Correct" },
            { value: incorrect, label: "Incorrect" },
            { value: skipped, label: "Skipped" },
            { value: Math.round(accuracy), suffix: "%", label: "Accuracy" },
          ].map((s, i) => (
            <div key={i} className="apt-result-stat">
              <div className="apt-rs-value">{s.value}{s.suffix || ""}</div>
              <div className="apt-rs-label">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Topic Performance */}
        {Object.keys(topicPct).length > 0 && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Topic Performance</h2>
            <div className="apt-topic-list">
              {Object.entries(topicPct).map(([topic, pct]) => (
                <AnimatedBar key={topic} name={topic.charAt(0).toUpperCase() + topic.slice(1)} pct={pct} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Difficulty Performance */}
        {Object.keys(diffPct).length > 0 && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Difficulty Breakdown</h2>
            <div className="apt-topic-list">
              {Object.entries(diffPct).map(([d, pct]) => (
                <AnimatedBar key={d} name={d.charAt(0).toUpperCase() + d.slice(1)} pct={pct} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Weak/Strong Areas */}
        {(r.weakTopics?.length > 0 || r.strongTopics?.length > 0) && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Performance Areas</h2>
            {r.strongTopics?.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Strong Areas</p>
                <div className="apt-skill-tags" style={{ marginBottom: 16 }}>
                  {r.strongTopics.map((t, i) => <span key={i} className="apt-skill-tag">{t}</span>)}
                </div>
              </>
            )}
            {r.weakTopics?.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Weak Areas</p>
                <div className="apt-skill-tags">
                  {r.weakTopics.map((t, i) => <span key={i} className="apt-skill-tag">{t}</span>)}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* AI Feedback */}
        {r.feedback && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">AI Feedback</h2>
            <p className="apt-feedback-text">{r.feedback}</p>
            {r.improvementPlan?.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Improvement Plan</p>
                <ul className="apt-plan-list">
                  {r.improvementPlan.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </>
            )}
            {r.learningRoadmap?.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Learning Roadmap</p>
                <ul className="apt-plan-list">
                  {r.learningRoadmap.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </>
            )}
          </motion.div>
        )}

        {/* Malpractice Report */}
        {violated > 0 && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Malpractice Report</h2>
            <div className="apt-malpractice-summary">
              <div className="apt-mp-item"><span className="apt-mp-value">{r.warnings || 0}</span><span className="apt-mp-label">Warnings</span></div>
              <div className="apt-mp-item"><span className="apt-mp-value">{violated}</span><span className="apt-mp-label">Violations</span></div>
            </div>
            <div className={`apt-mp-risk apt-risk-${riskLevel}`}>Risk Level: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}</div>
            <div className="apt-violation-list">
              {(r.violations || []).map((v, i) => (
                <div key={i} className="apt-violation-item">
                  <span className="apt-v-time">{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ""}</span>
                  <span className="apt-v-type">{v.type?.replace(/-/g, " ") || ""}</span>
                  <span className={`apt-v-severity`} style={{ color: v.severity === "critical" ? "var(--text-primary)" : v.severity === "high" ? "var(--text-secondary)" : "var(--text-muted)" }}>{v.severity || ""}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div className="apt-results-actions" variants={itemAnim}>
          <Link to="/aptitude/history" className="apt-action-btn">View Assessment History</Link>
          <Link to="/aptitude" className="apt-action-btn">Take Another Test</Link>
          <Link to="/dashboard" className="apt-action-btn">Back to Dashboard</Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
