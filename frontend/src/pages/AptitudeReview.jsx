import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getAptitudeReview } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

function diffTone(difficulty) {
  const d = (difficulty || "").toLowerCase();
  if (d.includes("hard")) return "#f87171";
  if (d.includes("medium") || d.includes("moderate")) return "#fbbf24";
  return "#34d399";
}

function optionsLabel(idx) {
  return String.fromCharCode(65 + idx);
}

function CollapsibleCard({ q, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const state = q.isCorrect ? "correct" : q.status === "skipped" || !q.userAnswer ? "skipped" : "wrong";
  const stateLabel = state === "correct" ? "Correct" : state === "skipped" ? "Skipped" : "Wrong";
  const stateColor = state === "correct" ? "#34d399" : state === "skipped" ? "#fbbf24" : "#f87171";
  const isMultiple = q.type === "multiple";
  const userSel = isMultiple && q.userAnswer ? (Array.isArray(q.userAnswer) ? q.userAnswer : JSON.parse(q.userAnswer)) : null;
  const correctSel = isMultiple ? q.correctAnswer : q.correctAnswer;
  const time = q.timeSpent || 0;

  const expl = useMemo(() => {
    let e = q.explanation || q.solution || "";
    if (typeof e === "string") {
      const trimmed = e.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try { e = JSON.parse(trimmed); } catch { /* keep as string */ }
      }
    }
    if (e && typeof e === "object" && !Array.isArray(e)) return e;
    return typeof e === "string" && e ? { correct: e } : null;
  }, [q.explanation, q.solution]);

  const optionExplain = (i) => (expl && typeof expl === "object" ? expl["option" + i] : null);

  return (
    <motion.div className={`apt-review-card apt-review-${state}`} variants={item}>
      <button className="apt-review-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Question ${q.number}`}>
        <div className="apt-review-qno" style={{ color: stateColor, borderColor: `${stateColor}55`, background: `${stateColor}12` }}>{q.number}</div>
        <div className="apt-review-head-mid">
          <div className="apt-review-topic">{q.topic}</div>
          <div className="apt-review-qtext">{q.question}</div>
        </div>
        <div className="apt-review-head-right">
          <span className="apt-review-chip" style={{ color: diffTone(q.difficulty), borderColor: `${diffTone(q.difficulty)}55` }}>{q.difficulty || "Medium"}</span>
          <span className="apt-review-chip" style={{ color: stateColor, borderColor: `${stateColor}55` }}>{stateLabel}</span>
          <span className="apt-review-chip apt-review-time">{Math.floor(time / 60)}m {time % 60}s</span>
          <motion.svg className="apt-chev" width="18" height="18" viewBox="0 0 24 24" animate={{ rotate: open ? 180 : 0 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="apt-review-card-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {q.passage && <div className="apt-review-passage">{q.passage}</div>}
            <div className="apt-review-options">
              {(q.options || []).map((opt, i) => {
                const optVal = isMultiple ? i : opt;
                const isUser = isMultiple ? (userSel || []).includes(i) : String(q.userAnswer) === String(opt);
                const isCorrectOpt = isMultiple ? (correctSel || []).includes(i) : String(q.correctAnswer) === String(opt);
                let cls = "apt-review-opt";
                if (isCorrectOpt) cls += " opt-correct";
                else if (isUser) cls += " opt-user-wrong";
                return (
                  <div key={i} className={cls}>
                    <span className="apt-opt-letter">{optionsLabel(i)}</span>
                    <span className="apt-opt-text">{opt}</span>
                    {isCorrectOpt && <span className="apt-opt-flag ok">Correct Answer</span>}
                    {isUser && !isCorrectOpt && <span className="apt-opt-flag bad">Your Answer</span>}
                    {optionExplain(i) && (
                      <div className="apt-review-opt-explain">
                        <span className="apt-review-opt-explain-label">Why {optionsLabel(i)}:</span> {optionExplain(i)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {expl && expl.correct && (
              <div className="apt-review-explain">
                <div className="apt-review-explain-title">Explanation</div>
                <p>{expl.correct}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AptitudeReview() {
  const { id } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await getAptitudeReview(id);
        setReview(res?.review || res);
      } catch {
        setError("Failed to load question review");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const { counts, filtered, total } = useMemo(() => {
    const qs = review?.questions || [];
    const counts = { all: qs.length, correct: 0, wrong: 0, skipped: 0 };
    const states = qs.map((q) => {
      if (q.isCorrect) return "correct";
      if (q.status === "skipped" || !q.userAnswer) return "skipped";
      return "wrong";
    });
    states.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
    const filtered = qs.filter((_, i) => filter === "all" || states[i] === filter);
    return { counts, filtered, total: qs.length };
  }, [review, filter]);

  const filters = [
    { key: "all", label: "All" },
    { key: "correct", label: "Correct" },
    { key: "wrong", label: "Wrong" },
    { key: "skipped", label: "Skipped" },
  ];

  if (loading) return <div className="apt-page"><div className="apt-loading"><LoadingSpinner label="Loading review..." /></div></div>;
  if (error) return (
    <div className="apt-page"><div className="apt-container"><div className="apt-error">
      <h3>Review not available</h3><p>{error}</p>
      <Link to="/aptitude/history" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Back to History</Link>
    </div></div></div>
  );
  if (!review) return null;

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        <motion.div className="apt-header" variants={item}>
          <h1>Question Review</h1>
          <p>Every question, your answer, the correct answer and the explanation.</p>
        </motion.div>

        <motion.div className="apt-review-summary" variants={item}>
          <div className="apt-review-summary-card">
            <span className="apt-rsv">{review.score ?? 0}%</span>
            <span className="apt-rsl">Score</span>
          </div>
          <div className="apt-review-summary-card">
            <span className="apt-rsv apt-green">{counts.correct}</span>
            <span className="apt-rsl">Correct</span>
          </div>
          <div className="apt-review-summary-card">
            <span className="apt-rsv apt-red">{counts.wrong}</span>
            <span className="apt-rsl">Wrong</span>
          </div>
          <div className="apt-review-summary-card">
            <span className="apt-rsv apt-yellow">{counts.skipped}</span>
            <span className="apt-rsl">Skipped</span>
          </div>
          <div className="apt-review-summary-card">
            <span className="apt-rsv">{total}</span>
            <span className="apt-rsl">Total</span>
          </div>
        </motion.div>

        <motion.div className="apt-review-filters" variants={item} role="tablist" aria-label="Filter questions">
          {filters.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className={`apt-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label} <span className="apt-filter-count">{counts[f.key]}</span>
            </button>
          ))}
        </motion.div>

        <motion.div className="apt-review-list" variants={item}>
          {filtered.length === 0 ? (
            <div className="apt-empty" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
              <p>No questions in this filter.</p>
            </div>
          ) : (
            filtered.map((q) => <CollapsibleCard key={q.id} q={q} defaultOpen={filter !== "all" || q.isCorrect === false} />)
          )}
        </motion.div>

        <motion.div className="apt-start-btn-wrap" variants={item} style={{ marginTop: 32 }}>
          <Link to={`/aptitude/results/${id}`} className="apt-start-btn" style={{ textDecoration: "none", display: "inline-block" }}>Back to Results</Link>
        </motion.div>
      </div>
    </motion.div>
  );
}