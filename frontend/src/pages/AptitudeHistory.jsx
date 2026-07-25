import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeHistory } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

function TimeAgo({ date }) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function StatusBadge({ terminated, score }) {
  if (terminated) return <span className="apt-status-badge apt-status-disqualified" style={{ fontSize: 11, padding: "2px 10px" }}>Disqualified</span>;
  if (score >= 40) return <span className="apt-status-badge apt-status-passed" style={{ fontSize: 11, padding: "2px 10px" }}>Passed</span>;
  return <span className="apt-status-badge apt-status-failed" style={{ fontSize: 11, padding: "2px 10px" }}>Failed</span>;
}

export default function AptitudeHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAptitudeHistory();
        setHistory(res?.history || []);
      } catch {
        setError("Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="apt-page"><div className="apt-loading"><LoadingSpinner label="Loading history..." /></div></div>;

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        <motion.div className="apt-header" variants={item}>
          <h1>Assessment History</h1>
          <p>Your past aptitude assessment results and performance.</p>
        </motion.div>

        {error ? (
          <motion.div className="apt-error" variants={item}>
            <p>{error}</p>
            <Link to="/aptitude" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Take a Test</Link>
          </motion.div>
        ) : history.length === 0 ? (
          <motion.div className="apt-empty" variants={item} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <p>No assessments taken yet.</p>
            <Link to="/aptitude" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", marginTop: 16, padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Start Your First Test</Link>
          </motion.div>
        ) : (
          <motion.div className="apt-history-list" variants={item}>
            {history.map((h) => (
              <Link key={h.id} to={`/aptitude/results/${h.id}`} className="apt-history-card" style={{ textDecoration: "none" }}>
                <div className="apt-hc-left">
                  <div className="apt-hc-score">{h.score ?? 0}%</div>
                  <StatusBadge terminated={h.terminated} score={h.score} />
                </div>
                <div className="apt-hc-mid">
                  <div className="apt-hc-difficulty">{(h.difficulty || "").charAt(0).toUpperCase() + (h.difficulty || "").slice(1)}</div>
                  <div className="apt-hc-detail">{h.correct_count ?? 0}/{h.total_questions ?? 0} correct</div>
                </div>
                <div className="apt-hc-right">
                  <span className="apt-hc-accuracy">{h.accuracy ?? 0}% acc</span>
                  <span className="apt-hc-time"><TimeAgo date={h.created_at || h.completed_at} /></span>
                </div>
              </Link>
            ))}
          </motion.div>
        )}

        <motion.div className="apt-start-btn-wrap" variants={item} style={{ marginTop: 32 }}>
          <Link to="/aptitude" className="apt-start-btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Take Another Assessment
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
