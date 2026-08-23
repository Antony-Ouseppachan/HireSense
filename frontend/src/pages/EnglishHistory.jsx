import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeHistory } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

const MODULE_LABELS = { aptitude: "Aptitude", general_knowledge: "General Knowledge", english_communication: "English & Communication" };

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
  const parsedScore = parseFloat(score) || 0;
  if (terminated) return <span className="apt-status-badge apt-status-disqualified">Disqualified</span>;
  if (parsedScore >= 40) return <span className="apt-status-badge apt-status-passed">Passed</span>;
  return <span className="apt-status-badge apt-status-failed">Failed</span>;
}

export default function EnglishHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering & Sorting States
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sortOption, setSortOption] = useState("latest");

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAptitudeHistory({ type: "english_communication" });
        if (!cancelled) setHistory(res?.history || []);
      } catch {
        if (!cancelled) setError("Failed to load assessment history logs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Global parsed stats computation to prevent NaN%
  const stats = useMemo(() => {
    if (history.length === 0) return { total: 0, avgScore: 0, avgAccuracy: 0, passed: 0 };
    const total = history.length;
    const avgScore = Math.round(history.reduce((acc, h) => acc + (parseFloat(h.score) || 0), 0) / total);
    const avgAccuracy = Math.round(history.reduce((acc, h) => acc + (parseFloat(h.accuracy) || 0), 0) / total);
    const passed = history.filter(h => !h.terminated && (parseFloat(h.score) || 0) >= 40).length;
    return { total, avgScore, avgAccuracy, passed };
  }, [history]);

  // Client-side filtering & sorting
  const filteredAndSortedHistory = useMemo(() => {
    let result = [...history];

    // Filter by english_communication only (already filtered from API, but ensure)
    result = result.filter((h) => (h.assessment_type || "english_communication") === "english_communication");

    // Apply difficulty filter
    if (difficultyFilter !== "all") {
      result = result.filter((h) => (h.difficulty || "").toLowerCase() === difficultyFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortOption === "latest") {
        return new Date(b.created_at || b.completed_at) - new Date(a.created_at || a.completed_at);
      }
      if (sortOption === "score_desc") {
        return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
      }
      if (sortOption === "score_asc") {
        return (parseFloat(a.score) || 0) - (parseFloat(b.score) || 0);
      }
      if (sortOption === "accuracy_desc") {
        return (parseFloat(b.accuracy) || 0) - (parseFloat(a.accuracy) || 0);
      }
      return 0;
    });

    return result;
  }, [history, difficultyFilter, sortOption]);

  if (loading) {
    return (
      <div className="apt-page">
        <div className="apt-loading">
          <LoadingSpinner label="Loading telemetry logs..." />
        </div>
      </div>
    );
  }

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        <motion.div className="apt-header" variants={item}>
          <div className="apt-header-module" style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)" }}>
            <span className="apt-header-module-dot" style={{ backgroundColor: "#fbbf24" }} />
            Telemetry Deck
          </div>
          <h1>English & Communication History</h1>
          <p>Your past English & Communication assessment results and performance metrics.</p>
        </motion.div>

        {/* Telemetry Stats Deck */}
        {!error && history.length > 0 && (
          <motion.div className="apt-history-stats-deck" variants={item}>
            <div className="history-stat-card">
              <span className="stat-label">Total Logs</span>
              <span className="stat-value">{stats.total}</span>
              <span className="stat-sub">Assessments completed</span>
            </div>
            <div className="history-stat-card">
              <span className="stat-label">Avg Score</span>
              <span className="stat-value" style={{ color: '#fbbf24' }}>{stats.avgScore}%</span>
              <span className="stat-sub">Performance index</span>
            </div>
            <div className="history-stat-card">
              <span className="stat-label">Avg Accuracy</span>
              <span className="stat-value" style={{ color: '#34d399' }}>{stats.avgAccuracy}%</span>
              <span className="stat-sub">Precision index</span>
            </div>
            <div className="history-stat-card">
              <span className="stat-label">Passing Rate</span>
              <span className="stat-value" style={{ color: '#a78bfa' }}>
                {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%
              </span>
              <span className="stat-sub">Success checkpoint</span>
            </div>
          </motion.div>
        )}

        {/* Dedicated Filters & Sort Control Row */}
        {!error && history.length > 0 && (
          <motion.div className="apt-history-controls" variants={item}>
            <div className="control-group">
              <label htmlFor="filter-difficulty">Difficulty</label>
              <select
                id="filter-difficulty"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="control-select"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="sort-option">Sort By</label>
              <select
                id="sort-option"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="control-select"
              >
                <option value="latest">Latest Completed</option>
                <option value="score_desc">Highest Score</option>
                <option value="score_asc">Lowest Score</option>
                <option value="accuracy_desc">Highest Accuracy</option>
              </select>
            </div>
          </motion.div>
        )}

        {error ? (
          <motion.div className="apt-error" variants={item}>
            <p>{error}</p>
            <Link to="/english" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Take a Test</Link>
          </motion.div>
        ) : filteredAndSortedHistory.length === 0 ? (
          <motion.div className="apt-empty" variants={item} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <p>No assessment records registered on this filter.</p>
            <Link to="/english" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", marginTop: 16, padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Start Your First Test</Link>
          </motion.div>
        ) : (
          <motion.div className="apt-history-list" variants={item}>
            {filteredAndSortedHistory.map((h) => {
              const type = h.assessment_type || "english_communication";
              const scoreNum = Math.round(parseFloat(h.score) || 0);
              const accuracyNum = Math.round(parseFloat(h.accuracy) || 0);
              return (
                <div key={h.id} className="apt-history-card" onClick={() => navigate(`/english/results/${h.id}`)} style={{ cursor: "pointer" }}>
                  <div className="apt-hc-left">
                    <div className="apt-hc-score-wrapper">
                      <svg width="44" height="44" viewBox="0 0 36 36" className="score-ring">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={h.terminated ? "#f87171" : scoreNum >= 40 ? "#34d399" : "#fbbf24"}
                          strokeWidth="3"
                          strokeDasharray="88"
                          strokeDashoffset={88 - (88 * Math.min(Math.max(scoreNum, 0), 100)) / 100}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      </svg>
                      <span className="score-text-inner">{scoreNum}%</span>
                    </div>
                    <StatusBadge terminated={h.terminated} score={h.score} />
                  </div>
                  <div className="apt-hc-mid">
                    <div className="apt-hc-meta-row">
                      <span className={`apt-hc-module apt-hc-module-${type}`}>{MODULE_LABELS[type] || "English"}</span>
                      <span className="apt-hc-difficulty-tag">{(h.difficulty || "medium").toUpperCase()}</span>
                    </div>
                    <div className="apt-hc-detail">{h.correct_count ?? 0} of {h.total_questions ?? 0} answers correct</div>
                  </div>
                  <div className="apt-hc-right">
                    <div className="apt-hc-telemetry">
                      <span className="apt-hc-accuracy">{accuracyNum}% accuracy</span>
                      <span className="apt-hc-time"><TimeAgo date={h.created_at || h.completed_at} /></span>
                    </div>
                    <div className="apt-hc-chevron">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        <motion.div className="apt-start-btn-wrap" variants={item} style={{ marginTop: 32, textAlign: "center" }}>
          <Link to="/english" className="apt-start-btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Take Another Assessment
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
