import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeResult, reattemptAssessment } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Aptitude.css";

// Lazy-loaded Recharts bundle (perf: charts load on demand)
const ChartBundle = lazy(() => import("./ChartBundle"));

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

function CountUp({ value, suffix = "", duration = 1000 }) {
  const [n, setN] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{n}{suffix}</>;
}

function ordinalSuffix(n) {
  const v = Math.round(n);
  const rem100 = v % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  const rem10 = v % 10;
  if (rem10 === 1) return "st";
  if (rem10 === 2) return "nd";
  if (rem10 === 3) return "rd";
  return "th";
}

function GradeBadge({ grade }) {
  const tone = grade === "A+"
    ? "#10b981" : grade === "A" ? "#34d399" : grade === "B+" ? "#38bdf8"
    : grade === "B" ? "#fbbf24" : grade === "C" ? "#f97316" : "#f87171";
  return <span className="apt-grade-badge" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>{grade}</span>;
}

function ScoreRing({ pct }) {
  const size = 168;
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="apt-score-ring-wrap" style={{ width: size, height: size }}>
      <svg className="apt-score-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#scoreGrad)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <div className="apt-score-value"><CountUp value={Math.round(pct)} suffix="%" /></div>
      <div className="apt-score-caption">Overall Score</div>
    </div>
  );
}

function AnimatedBar({ name, pct }) {
  return (
    <div className="apt-topic-row">
      <span className="apt-topic-name">{name}</span>
      <div className="apt-topic-bar-track">
        <motion.div className="apt-topic-bar-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <span className="apt-topic-pct">{Math.round(pct)}%</span>
    </div>
  );
}

function IntegrityWidget({ integrityScore, violations }) {
  const clean = integrityScore >= 90;
  const warn = integrityScore < 90 && integrityScore >= 70;
  const risky = integrityScore < 70;
  const cls = clean ? "clean" : warn ? "warn" : "risky";
  const label = clean ? "Excellent" : warn ? "Warning" : "Flagged";
  return (
    <div className={`apt-integrity-card ${cls}`}>
      <div className="apt-integrity-head">
        <div className="apt-integrity-score">
          <CountUp value={integrityScore} suffix="%" />
        </div>
        <div>
          <div className="apt-integrity-title">Assessment Integrity</div>
          <div className="apt-integrity-badge">{label}</div>
        </div>
      </div>
      {violations > 0 && (
        <p className="apt-integrity-detail">
          Detected: {violations.map((v) => `${v.count} ${v.label.toLowerCase()}`).join(", ")}. This attempt may be flagged.
        </p>
      )}
    </div>
  );
}

export default function AptitudeResults() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateResult = location.state?.result;
  const [result, setResult] = useState(stateResult || null);
  const [loading, setLoading] = useState(!stateResult);
  const [error, setError] = useState(null);
  const [reattempting, setReattempting] = useState(false);

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

  const handleReattempt = useCallback(async () => {
    if (!id || reattempting) return;
    setReattempting(true);
    try {
      const res = await reattemptAssessment(id);
      navigate(`/aptitude/test?id=${res.assessmentId}`, { replace: true });
    } catch {
      setError("Failed to create reattempt");
      setReattempting(false);
    }
  }, [id, reattempting, navigate]);

  if (loading) return <div className="apt-page"><div className="apt-loading"><LoadingSpinner label="Generating your report..." /></div></div>;
  if (error) return (
    <div className="apt-page"><div className="apt-container"><div className="apt-error">
      <svg className="apt-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
      <h3>Results not found</h3><p>{error}</p>
      <Link to="/aptitude" className="apt-retry-btn" style={{ textDecoration: "none", display: "inline-block", padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>Take Another Test</Link>
    </div></div></div>);
  if (!result) return null;

  const r = result;
  const score = r.score ?? r.percentage ?? 0;
  const correct = r.correct ?? 0;
  const total = r.total ?? r.questions?.length ?? 0;
  const incorrect = r.incorrect ?? 0;
  const skipped = r.skipped ?? (total - correct - incorrect);
  const accuracy = r.accuracy ?? (correct > 0 ? (correct / (correct + incorrect)) * 100 : 0);
  const finished = r.status === "completed";
  const status = !finished ? "inprogress" : r.terminated ? "disqualified" : score >= 40 ? "passed" : "failed";
  const difficulty = r.difficulty || "medium";
  const timeTaken = r.timeTaken ?? 0;
  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;
  const grade = r.grade || (score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C" : "Needs Improvement");
  const integrity = r.integrityScore ?? Math.max(0, 100 - (r.violations?.length || 0) * 10);
  const violations = r.malpracticeSummary ? Object.entries(r.malpracticeSummary).map(([k, v]) => ({ key: k, label: v.label, count: v.count })) : [];
  const violated = (r.violations || []).length;

  const topicData = Object.entries(r.topicPerformance || {}).map(([name, pct]) => ({ name, pct: Math.round(pct) }));
  const pieData = [
    { name: "Correct", value: correct, color: "#34d399" },
    { name: "Wrong", value: incorrect, color: "#f87171" },
    { name: "Skipped", value: skipped, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const radarData = [
    { subject: "Reasoning", value: r.difficultyPerformance?.hard ?? r.score, fullMark: 100 },
    { subject: "Math", value: r.topicPerformance?.Percentages ?? r.score },
    { subject: "Verbal", value: r.topicPerformance?.English ?? r.score },
    { subject: "Data Interp.", value: r.topicPerformance?.Data ?? r.score },
    { subject: "Logic", value: r.topicPerformance?.Logical ?? r.score },
  ];

  const quickStats = [
    { value: <><CountUp value={score} suffix="%" /></>, label: "Score" },
    { value: <CountUp value={correct} />, label: "Correct" },
    { value: <CountUp value={incorrect} />, label: "Wrong" },
    { value: <CountUp value={skipped} />, label: "Skipped" },
    { value: <>{mins}m {secs}s</>, label: "Time Taken" },
    { value: <>{Math.round((r.avgTimePerQuestion ?? 0) / 60) > 0 ? `${Math.round((r.avgTimePerQuestion ?? 0) / 60)}m` : `${r.avgTimePerQuestion ?? 0}s`}</>, label: "Avg Time" },
    { value: <><CountUp value={Math.round(accuracy)} suffix="%" /></>, label: "Accuracy" },
    { value: <GradeBadge grade={grade} />, label: "Grade" },
  ];

  const strengths = r.strengths?.length ? r.strengths : r.strongTopics?.length ? r.strongTopics : [];
  const weaknesses = r.weaknesses?.length ? r.weaknesses : r.weakTopics?.length ? r.weakTopics : [];

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        {/* Header */}
        <motion.div className="apt-results-header" variants={itemAnim}>
          <div className="apt-success-icon">
            <svg viewBox="0 0 24 24" fill="none" width="52" height="52">
              <motion.circle cx="12" cy="12" r="11" stroke="#34d399" strokeWidth="1.5" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} />
              <motion.path d="M7.5 12.5l3 3 6-6" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.3 }} />
            </svg>
          </div>
          <h1 className="apt-results-heading">{finished ? "Assessment Complete" : "Performance Analysis"}</h1>
          {!finished && <p className="apt-results-subnote">AI analysis based on the answers you submitted so far. Finish the test for your final report.</p>}
          <div className="apt-results-meta">
            <span>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Difficulty</span>
            <span>{mins}m {secs}s</span>
            <span>{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            {location.state?.attemptNumber && <span className="apt-attempt-chip">Attempt #{location.state.attemptNumber}</span>}
            <div className={`apt-status-badge apt-status-${status}`}>{status === "passed" ? "Passed" : status === "failed" ? "Failed" : status === "disqualified" ? "Disqualified" : "In Progress"}</div>
          </div>
        </motion.div>

        {/* Score Gauge */}
        <motion.div className="apt-results-hero" variants={itemAnim}>
          <ScoreRing pct={score} />
          <div className="apt-results-hero-side">
            <div className="apt-results-hero-grade">
              <span className="apt-hero-label">Performance Grade</span>
              <GradeBadge grade={grade} />
            </div>
            {r.percentile != null && (
              <div className="apt-results-hero-percentile">
                <span className="apt-hero-value"><CountUp value={Math.round(r.percentile)} suffix={ordinalSuffix(r.percentile)} /></span>
                <span className="apt-hero-label">Percentile (est.)</span>
              </div>
            )}
            {r.estimatedInterviewReadiness != null && (
              <div className="apt-results-hero-readiness">
                <span className="apt-hero-value"><CountUp value={r.estimatedInterviewReadiness} suffix="%" /></span>
                <span className="apt-hero-label">Interview Readiness</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div className="apt-result-stats-grid" variants={itemAnim}>
          {quickStats.map((s, i) => (
            <div key={i} className="apt-result-stat">
              <div className="apt-rs-value">{s.value}</div>
              <div className="apt-rs-label">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Charts */}
        <motion.div className="apt-charts-grid" variants={itemAnim}>
          {pieData.length > 0 && (
            <div className="apt-section-card apt-chart-card">
              <h2 className="apt-section-title">Answer Distribution</h2>
              <Suspense fallback={<div className="apt-chart-skeleton" />}>
                <ChartBundle type="pie" data={pieData} />
              </Suspense>
            </div>
          )}
          {topicData.length > 0 && (
            <div className="apt-section-card apt-chart-card">
              <h2 className="apt-section-title">Performance by Topic</h2>
              <Suspense fallback={<div className="apt-chart-skeleton" />}>
                <ChartBundle type="bar" data={topicData} />
              </Suspense>
            </div>
          )}
          {radarData.length > 0 && (
            <div className="apt-section-card apt-chart-card">
              <h2 className="apt-section-title">Skill Radar</h2>
              <Suspense fallback={<div className="apt-chart-skeleton" />}>
                <ChartBundle type="radar" data={radarData} />
              </Suspense>
            </div>
          )}
        </motion.div>

        {/* Topic Performance bars */}
        {topicData.length > 0 && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Topic Performance</h2>
            <div className="apt-topic-list">
              {topicData.map((t) => <AnimatedBar key={t.name} name={t.name.charAt(0).toUpperCase() + t.name.slice(1)} pct={t.pct} />)}
            </div>
          </motion.div>
        )}

        {/* Strengths & Weaknesses */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <motion.div className="apt-section-card" variants={itemAnim}>
            <h2 className="apt-section-title">Performance Areas</h2>
            {strengths.length > 0 && (
              <>
                <p className="apt-area-label">Strengths</p>
                <div className="apt-skill-tags" style={{ marginBottom: 16 }}>
                  {strengths.map((t, i) => <span key={i} className="apt-skill-tag strong">{t}</span>)}
                </div>
              </>
            )}
            {weaknesses.length > 0 && (
              <>
                <p className="apt-area-label">Weak Areas</p>
                <div className="apt-skill-tags">
                  {weaknesses.map((t, i) => <span key={i} className="apt-skill-tag weak">{t}</span>)}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* AI Recommendations */}
        <motion.div className="apt-section-card" variants={itemAnim}>
          <h2 className="apt-section-title">AI Recommendations</h2>
          {r.motivationalSummary && <p className="apt-motivational">{r.motivationalSummary}</p>}
          {r.feedback && (
            <>
              <p className="apt-area-label">Summary</p>
              <p className="apt-feedback-text">{r.feedback}</p>
            </>
          )}
          {r.topicsToStudy?.length > 0 && (
            <>
              <p className="apt-area-label">Topics to Study</p>
              <div className="apt-skill-tags">
                {r.topicsToStudy.map((t, i) => <span key={i} className="apt-skill-tag study">{t}</span>)}
              </div>
            </>
          )}
          {r.recommendedPracticeFrequency && (
            <p className="apt-practice-freq">Practice: <strong>{r.recommendedPracticeFrequency}</strong></p>
          )}
          {r.improvementPlan?.length > 0 && (
            <>
              <p className="apt-area-label">Improvement Plan</p>
              <ul className="apt-plan-list">
                {r.improvementPlan.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </>
          )}
          {r.learningRoadmap?.length > 0 && (
            <>
              <p className="apt-area-label">Learning Roadmap</p>
              <ul className="apt-plan-list">
                {r.learningRoadmap.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </>
          )}
        </motion.div>

        {/* Performance Insights */}
        <motion.div className="apt-section-card" variants={itemAnim}>
          <h2 className="apt-section-title">Performance Insights</h2>
          <div className="apt-insight-grid">
            <div className="apt-insight"><span className="apt-insight-value"><CountUp value={r.completionRate ?? Math.round((correct + incorrect) / Math.max(total, 1) * 100)} suffix="%" /></span><span className="apt-insight-label">Completion Rate</span></div>
            {r.thinkingEfficiency != null && <div className="apt-insight"><span className="apt-insight-value"><CountUp value={r.thinkingEfficiency} suffix="%" /></span><span className="apt-insight-label">Thinking Efficiency</span></div>}
            {r.timeManagement != null && <div className="apt-insight"><span className="apt-insight-value"><CountUp value={r.timeManagement} suffix="%" /></span><span className="apt-insight-label">Time Management</span></div>}
            {r.fastestAnswer > 0 && <div className="apt-insight"><span className="apt-insight-value">{r.fastestAnswer}s</span><span className="apt-insight-label">Fastest Answer</span></div>}
            {r.slowestAnswer > 0 && <div className="apt-insight"><span className="apt-insight-value">{r.slowestAnswer}s</span><span className="apt-insight-label">Slowest Answer</span></div>}
            {r.avgTimePerQuestion > 0 && <div className="apt-insight"><span className="apt-insight-value">{r.avgTimePerQuestion}s</span><span className="apt-insight-label">Avg / Question</span></div>}
          </div>
        </motion.div>

        {/* Integrity / Malpractice */}
        <motion.div className="apt-section-card" variants={itemAnim}>
          <h2 className="apt-section-title">Assessment Integrity</h2>
          <IntegrityWidget integrityScore={integrity} violations={violations} />
          {violated > 0 && (
            <div className="apt-malpractice-summary">
              <div className="apt-mp-item"><span className="apt-mp-value">{r.warnings || 0}</span><span className="apt-mp-label">Warnings</span></div>
              <div className="apt-mp-item"><span className="apt-mp-value">{violated}</span><span className="apt-mp-label">Violations</span></div>
              <div className={`apt-mp-risk apt-risk-${r.riskLevel || "low"}`}>Risk Level: {((r.riskLevel || "low")).charAt(0).toUpperCase() + (r.riskLevel || "low").slice(1)}</div>
            </div>
          )}
          {violated > 0 && (
            <div className="apt-violation-list">
              {(r.violations || []).map((v, i) => (
                <div key={i} className="apt-violation-item">
                  <span className="apt-v-time">{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ""}</span>
                  <span className="apt-v-type">{v.type?.replace(/-/g, " ") || ""}</span>
                  <span className="apt-v-severity">{v.severity || ""}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div className="apt-results-actions" variants={itemAnim}>
          <button className="apt-action-btn" onClick={() => navigate("/dashboard")}>Return Dashboard</button>
          <Link to={`/aptitude/review/${id}`} className="apt-action-btn">Review Questions</Link>
          <button className="apt-action-btn disabled" title="Coming soon" disabled>Download Report</button>
          <button className="apt-action-btn" onClick={handleReattempt} disabled={reattempting}>{reattempting ? "Creating..." : "Restart Test"}</button>
        </motion.div>
      </div>
    </motion.div>
  );
}