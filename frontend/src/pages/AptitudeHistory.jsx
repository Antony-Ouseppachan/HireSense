import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeHistory, reattemptAssessment, deleteAssessment } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GradeBadge({ grade }) {
  const tone = grade === "A+"
    ? "#10b981" : grade === "A" ? "#34d399" : grade === "B+" ? "#38bdf8"
    : grade === "B" ? "#fbbf24" : grade === "C" ? "#f97316" : "#f87171";
  return <span className="apt-grade-badge" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>{grade || "—"}</span>;
}

function StatusBadge({ terminated, score, status }) {
  if (status && status !== "completed") {
    if (status === "cancelled") return <span className="apt-status-badge apt-status-failed">Cancelled</span>;
    if (status === "in_progress") return <span className="apt-status-badge apt-status-passed">In Progress</span>;
    return <span className="apt-status-badge apt-status-passed">{(status.charAt(0).toUpperCase() + status.slice(1)).replace(/-/g, " ")}</span>;
  }
  if (terminated) return <span className="apt-status-badge apt-status-disqualified">Disqualified</span>;
  if (score >= 40) return <span className="apt-status-badge apt-status-passed">Passed</span>;
  return <span className="apt-status-badge apt-status-failed">Failed</span>;
}

function formatDuration(secs) {
  const s = secs || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default function AptitudeHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0 });
  const [reattemptingId, setReattemptingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchPage = useCallback(async (offset, append) => {
    try {
      const res = await getAptitudeHistory({ limit: pagination.limit || 10, offset });
      const list = res?.history || [];
      setHistory((prev) => (append ? [...prev, ...list] : list));
      setPagination(res?.pagination || { total: list.length, limit: 10, offset });
    } catch {
      setError("Failed to load history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchPage(pagination.offset + pagination.limit, true);
  };

  const handleReattempt = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (reattemptingId) return;
    setReattemptingId(id);
    try {
      const res = await reattemptAssessment(id);
      navigate(`/aptitude/test?id=${res.assessmentId}`, { replace: true });
    } catch {
      setError("Failed to create reattempt");
      setReattemptingId(null);
    }
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId || deletingId) return;
    setDeletingId(confirmDeleteId);
    try {
      await deleteAssessment(confirmDeleteId);
      setHistory((prev) => prev.filter((h) => h.id !== confirmDeleteId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setConfirmDeleteId(null);
    } catch {
      setError("Failed to delete assessment");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="apt-page"><div className="apt-loading"><LoadingSpinner label="Loading history..." /></div></div>;

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        <motion.div className="apt-header" variants={item}>
          <button className="apt-back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}>← Back</button>
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
          <>
            <motion.div className="apt-history-list" variants={item}>
              {history.map((h, idx) => {
                const completed = h.status === "completed";
                const CardInner = (
                  <>
                    <div className="apt-hc-left">
                      <div className="apt-hc-score">{completed ? `${h.score ?? 0}%` : "—"}</div>
                      {completed && <GradeBadge grade={h.grade} />}
                    </div>
                    <div className="apt-hc-mid">
                      <div className="apt-hc-top">
                        <span className="apt-hc-difficulty">{(h.difficulty || "").charAt(0).toUpperCase() + (h.difficulty || "").slice(1)}</span>
                        <span className="apt-hc-attempt">Attempt #{pagination.total - (pagination.offset + idx)}</span>
                      </div>
                      <div className="apt-hc-detail">
                        {completed ? `${h.correct_count ?? 0}/${h.total_questions ?? 0} correct` : `${h.total_questions ?? 0} questions`}
                      </div>
                      <div className="apt-hc-meta">
                        {completed && <span className="apt-hc-accuracy">{h.accuracy ?? 0}% acc</span>}
                        <span className="apt-hc-time">{completed && h.time_taken != null ? `${formatDuration(h.time_taken)} · ` : ""}{formatDateTime(h.completed_at || h.created_at)}</span>
                      </div>
                    </div>
                    <div className="apt-hc-right">
                      <StatusBadge terminated={h.terminated} score={h.score} status={h.status} />
                      <div className="apt-hc-actions">
                        {(completed || h.status === "cancelled" || h.status === "in_progress") && <button className="apt-hc-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/aptitude/results/${h.id}`); }}>Analysis</button>}
                        {(completed || h.status === "cancelled" || h.status === "in_progress") && <button className="apt-hc-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/aptitude/review/${h.id}`); }}>Review</button>}
                        {h.status === "ready" && <button className="apt-hc-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/aptitude/test?id=${h.id}`); }}>Start Test</button>}
                        <button className="apt-hc-btn primary" onClick={(e) => handleReattempt(e, h.id)} disabled={reattemptingId === h.id}>
                          {reattemptingId === h.id ? "Creating..." : "Reattempt"}
                        </button>
                        <button className="apt-hc-btn danger" onClick={(e) => handleDelete(e, h.id)} disabled={deletingId === h.id}>
                          {deletingId === h.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </>
                );
                return completed ? (
                  <Link key={h.id} to={`/aptitude/results/${h.id}`} className="apt-history-card" style={{ textDecoration: "none" }}>{CardInner}</Link>
                ) : (
                  <div key={h.id} className="apt-history-card">{CardInner}</div>
                );
              })}
            </motion.div>

            {pagination.total > history.length && (
              <div className="apt-history-more" style={{ textAlign: "center", marginTop: 24 }}>
                <button className="apt-start-btn" onClick={loadMore} disabled={loadingMore} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-primary)", cursor: "pointer" }}>
                  {loadingMore ? "Loading..." : `Load More (${history.length} of ${pagination.total})`}
                </button>
              </div>
            )}
          </>
        )}

        <motion.div className="apt-start-btn-wrap" variants={item} style={{ marginTop: 32 }}>
          <Link to="/aptitude" className="apt-start-btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Take Another Assessment
          </Link>
        </motion.div>
      </div>

      {confirmDeleteId && createPortal(
        <div className="apt-confirm-overlay" onClick={() => { if (!deletingId) setConfirmDeleteId(null); }}>
          <motion.div className="apt-confirm-modal" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}>
            <div className="apt-confirm-icon">!</div>
            <h3 className="apt-confirm-title">Delete this assessment?</h3>
            <p className="apt-confirm-body">This will permanently remove the assessment and all of its answers. This action cannot be undone.</p>
            <div className="apt-confirm-actions">
              <button className="apt-hc-btn" onClick={() => setConfirmDeleteId(null)} disabled={deletingId}>Cancel</button>
              <button className="apt-hc-btn danger" onClick={confirmDelete} disabled={deletingId}>
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>, document.body)}
    </motion.div>
  );
}