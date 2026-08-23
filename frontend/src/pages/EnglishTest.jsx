import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  startAssessment,
  beginAssessment,
  saveAnswer,
  logMalpractice as logMalpracticeApi,
  completeAssessment,
} from "../services/apiService";
import LiveTimer from "../components/LiveTimer";
import useAntiCheat from "../hooks/useAntiCheat";
import { useExam } from "../context/ExamContext";
import "../styles/Aptitude.css";

const TYPE_TIME_MAP = {
  aptitude: { easy: 1200, medium: 2100, hard: 3000 },
  general_knowledge: { easy: 1200, medium: 1500, hard: 2100 },
  english_communication: { easy: 1200, medium: 1800, hard: 2400 },
};

const MODULE_LABELS = { aptitude: "Aptitude", general_knowledge: "General Knowledge", english_communication: "English" };

const PROCTOR_OVERLAY_MS = 1500;

const STEPS = [
  { key: "loading", label: "Loading questions" },
  { key: "fullscreen", label: "Entering secure mode" },
  { key: "starting", label: "Initializing timer" },
];

function StepIndicator({ steps, currentKey, error }) {
  const statuses = {};
  let found = false;
  for (const s of steps) {
    if (!found && s.key === currentKey) { statuses[s.key] = "active"; found = true; }
    else if (found) statuses[s.key] = "pending";
    else statuses[s.key] = "done";
  }
  if (error) statuses[currentKey] = "error";

  return (
    <div className="apt-loading-steps">
      {steps.map((s) => (
        <div key={s.key} className={`apt-loading-step ${statuses[s.key]}`}>
          <div className="apt-loading-step-icon">
            {statuses[s.key] === "done" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            )}
            {statuses[s.key] === "error" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/></svg>
            )}
            {statuses[s.key] === "active" && (
              <div className="apt-loading-spinner" />
            )}
            {statuses[s.key] === "pending" && (
              <div className="apt-loading-step-dot" />
            )}
          </div>
          <span className="apt-loading-step-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function EnglishTest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get("id");
  const hasSubmitted = useRef(false);
  const saveTimerRef = useRef(null);
  const timerRef = useRef(null);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState(new Set());
  const [visited, setVisited] = useState(new Set());
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [showWarning, setShowWarning] = useState(null);
  const [terminated, setTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [type, setType] = useState("english_communication");
  const [maxTime, setMaxTime] = useState(TYPE_TIME_MAP.english_communication.medium);
  const [loadingStep, setLoadingStep] = useState(null);
  const [loadingError, setLoadingError] = useState(null);
  const [fullscreenDenied, setFullscreenDenied] = useState(false);
  const [proctorOverlay, setProctorOverlay] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const warningViolationRef = useRef(null);
  const { enableExamMode, disableExamMode } = useExam();
  const pendingFullscreenRef = useRef(false);
  const beginCalledRef = useRef(false);

  useEffect(() => {
    enableExamMode();
    return () => disableExamMode();
  }, [enableExamMode, disableExamMode]);

  // ─── Proctoring enabled splash (shown once the exam starts) ──────────
  useEffect(() => {
    if (!started) return;
    setProctorOverlay("enabled");
    const t = setTimeout(() => setProctorOverlay(null), PROCTOR_OVERLAY_MS);
    return () => clearTimeout(t);
  }, [started]);

  const requestFullscreen = useCallback(() => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        return el.requestFullscreen().then(
          () => { pendingFullscreenRef.current = false; return true; },
          () => { pendingFullscreenRef.current = false; return false; }
        );
      }
      return Promise.resolve(true);
    } catch {
      pendingFullscreenRef.current = false;
      return Promise.resolve(false);
    }
  }, []);

  // ─── Step 1: Load questions ──────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId) {
      setError("No assessment ID provided.");
      return;
    }
    if (beginCalledRef.current) return;

    let cancelled = false;

    (async () => {
      setLoadingStep("loading");
      try {
        const res = await startAssessment(assessmentId);
        if (cancelled) return;

        const qs = res?.questions || [];
        const savedAnswers = res?.answers || [];
        if (qs.length === 0) throw new Error("No questions available.");

        const diff = res?.difficulty || "medium";
        const testType = res?.type || "english_communication";
        setDifficulty(diff);
        setType(testType);
        const timeLimit = (TYPE_TIME_MAP[testType] || TYPE_TIME_MAP.english_communication)[diff] || TYPE_TIME_MAP.english_communication.medium;
        setMaxTime(timeLimit);
        timerRef.current = timeLimit;

        const restored = {};
        for (const sa of savedAnswers) {
          if (sa.status === "answered" || sa.status === "reviewed") {
            let val = sa.answer;
            try { const p = JSON.parse(val); if (Array.isArray(p)) val = p; } catch {}
            restored[sa.questionNumber - 1] = val;
          }
        }

        setQuestions(qs);
        setAnswers(restored);

        const restoredVisited = new Set();
        savedAnswers.forEach((sa) => restoredVisited.add(sa.questionNumber - 1));
        if (restoredVisited.size > 0) setVisited(restoredVisited);

        const saved = sessionStorage.getItem(`apt_remaining_${assessmentId}`);
        if (saved) timerRef.current = Math.min(parseInt(saved, 10), timeLimit);

        // If already in_progress (resume), skip fullscreen/begin steps
        if (res.status === "in_progress") {
          setStarted(true);
          beginCalledRef.current = true;
          setLoadingStep(null);
          return;
        }

        // Step 2: Request fullscreen
        setLoadingStep("fullscreen");
        const fsOk = await requestFullscreen();
        if (cancelled) return;

        if (!fsOk) {
          setFullscreenDenied(true);
          return;
        }

        // Step 3: Begin assessment
        setLoadingStep("starting");
        await beginAssessment(assessmentId);
        if (cancelled) return;

        beginCalledRef.current = true;
        setStarted(true);
        setLoadingStep(null);
      } catch (e) {
        if (!cancelled) {
          setLoadingError(e.message || "Failed to load assessment");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [assessmentId, requestFullscreen]);

  // ─── Fullscreen retry on denial ─────────────────────────────────────
  const handleFullscreenRetry = useCallback(async () => {
    setFullscreenDenied(false);
    setLoadingStep("fullscreen");
    setLoadingError(null);
    const fsOk = await requestFullscreen();
    if (!fsOk) {
      setFullscreenDenied(true);
      return;
    }
    // Step 3: Begin assessment
    setLoadingStep("starting");
    try {
      await beginAssessment(assessmentId);
      beginCalledRef.current = true;
      setStarted(true);
      setLoadingStep(null);
    } catch (e) {
      setLoadingError(e.message || "Failed to begin assessment");
    }
  }, [assessmentId, requestFullscreen]);

  // ── Periodic save (every 15s) ─────────────────────────────────────────
  useEffect(() => {
    if (!started || questions.length === 0) return;
    saveTimerRef.current = setInterval(() => {
      syncAnswersToServer();
    }, 15000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, questions, answers, current]);

  // ── Sync answers to server ─────────────────────────────────────────────
  const syncAnswersToServer = useCallback(async () => {
    if (!assessmentId || !questions.length) return;
    const question = questions[current];
    if (!question) return;
    const val = answers[current];
    if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) return;
    try {
      await saveAnswer(assessmentId, {
        questionId: question.id,
        answer: Array.isArray(val) ? JSON.stringify(val) : String(val ?? ""),
        timeSpent: 0,
        status: review.has(current) ? "reviewed" : "answered",
      });
    } catch { /* ignore */ }
  }, [assessmentId, questions, answers, current, review]);

  // ── Save on question change ────────────────────────────────────────────
  const saveCurrentAnswer = useCallback(() => {
    syncAnswersToServer();
  }, [syncAnswersToServer]);

  // ── Anti-cheat ─────────────────────────────────────────────────────────
  const restoreFullscreen = useCallback(async () => {
    pendingFullscreenRef.current = true;
    let fsOk = false;
    try {
      fsOk = await requestFullscreen();
      if (!fsOk) {
        // Browser blocked fullscreen - try again after a brief delay
        await new Promise(r => setTimeout(r, 500));
        fsOk = await requestFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen restore failed:", e);
    } finally {
      // Only clear ref after successful attempt
      pendingFullscreenRef.current = !fsOk;
    }
    return fsOk;
  }, [requestFullscreen]);

  const onViolation = useCallback((violation, count) => {
    warningViolationRef.current = violation;

    if (violation.type === "fullscreen-exit") {
      // Attempt to restore fullscreen automatically when violation detected
      restoreFullscreen().catch(() => {
        // If auto-restore fails, will be re-attempted on warning dismiss
      });
    }

    if (assessmentId) {
      logMalpracticeApi(assessmentId, {
        type: violation.type,
        severity: violation.severity || "medium",
        detail: violation.detail || "",
        browserInfo: { userAgent: navigator.userAgent, language: navigator.language },
        questionNumber: current + 1,
      }).catch(() => {});
    }

    if (count >= 3) {
      setTerminationReason("Repeated Examination Rule Violations");
      setTerminated(true);
      handleFinalSubmit(true, count);
    } else {
      setShowWarning(count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, current, restoreFullscreen]);

  const { warnings } = useAntiCheat({
    onViolation,
    maxWarnings: 3,
    enabled: started && !submitting,
    currentQuestion: current,
  });

  const handleDismissWarning = useCallback(async () => {
    // Always attempt to restore fullscreen when user returns from warning
    const fsOk = await restoreFullscreen();
    if (!fsOk) {
      // Keep the exam blocked until fullscreen is restored.
      setFullscreenDenied(true);
      return;
    }
    setShowWarning(null);
  }, [restoreFullscreen]);

  const handleAnswer = useCallback((index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
    setVisited((prev) => new Set(prev).add(index));
    const question = questions[index];
    if (question && assessmentId) {
      saveAnswer(assessmentId, {
        questionId: question.id,
        answer: Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""),
        timeSpent: 0,
        status: "answered",
      }).catch(() => {});
    }
  }, [questions, assessmentId]);

  const toggleReview = useCallback(() => {
    setReview((prev) => {
      const next = new Set(prev);
      if (next.has(current)) next.delete(current); else next.add(current);
      return next;
    });
  }, [current]);

  // ── Timer persistence ──────────────────────────────────────────────────
  useEffect(() => {
    if (!started || questions.length === 0) return;
    const id = setInterval(() => {
      timerRef.current = Math.max(0, timerRef.current - 1);
      if (assessmentId) sessionStorage.setItem(`apt_remaining_${assessmentId}`, String(timerRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [started, questions, assessmentId]);

  // ── Submit / Complete ──────────────────────────────────────────────────
  const handleFinalSubmit = useCallback(async (isTerminated = false) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setSubmitting(true);

    // End proctoring: stop monitoring and leave fullscreen
    setProctorOverlay("disabled");
    const overlayStart = Date.now();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignore */ }

    await syncAnswersToServer();

    const holdOverlay = async () => {
      const elapsed = Date.now() - overlayStart;
      if (elapsed < PROCTOR_OVERLAY_MS) await new Promise((r) => setTimeout(r, PROCTOR_OVERLAY_MS - elapsed));
    };

    try {
      const res = await completeAssessment(assessmentId);
      const id = res?.id || assessmentId;
      sessionStorage.removeItem(`apt_remaining_${assessmentId}`);
      await holdOverlay();
      navigate(`/english/results/${id}`, {
        replace: true,
        state: { result: res?.result || res, difficulty, terminated: isTerminated },
      });
    } catch {
      await holdOverlay();
      navigate("/english", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }, [assessmentId, difficulty, syncAnswersToServer, navigate]);

  const handleSubmit = useCallback(() => {
    const unanswered = questions.filter((_, i) => answers[i] == null || answers[i] === "" || (Array.isArray(answers[i]) && answers[i].length === 0));
    if (unanswered.length > 0) {
      setShowSubmitConfirm(true);
      return;
    }
    handleFinalSubmit(false);
  }, [questions, answers, handleFinalSubmit]);

  const handleConfirmSubmit = useCallback(() => {
    setShowSubmitConfirm(false);
    handleFinalSubmit(false);
  }, [handleFinalSubmit]);

  const handleTimeUp = useCallback(() => {
    handleFinalSubmit(false);
  }, [handleFinalSubmit]);

  // ── Render states ──────────────────────────────────────────────────────

  // Loading screen with step indicators
  if (loadingStep && !fullscreenDenied) {
    return (
      <div className="apt-page">
        <div className="apt-loading-screen">
          <div className="apt-loading-glow" />
          <div className="apt-loading-content">
            <div className="apt-loading-logo">
              <svg viewBox="0 0 40 40" fill="none" width="48" height="48">
                <circle cx="20" cy="20" r="18" stroke="var(--accent)" strokeWidth="2" />
                <path d="M14 20l4 4 8-8" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="apt-loading-title">Preparing Your {MODULE_LABELS[type] || "English"} Assessment</h2>
            <StepIndicator steps={STEPS} currentKey={loadingStep} error={loadingError} />
            {loadingError && (
              <button className="apt-loading-retry-btn" onClick={() => window.location.reload()}>
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen denial dialog
  if (fullscreenDenied) {
    return (
      <div className="apt-page">
        <div className="apt-loading-screen">
          <div className="apt-loading-content">
            <div className="apt-loading-icon-warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" width="48" height="48">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            </div>
            <h2 className="apt-loading-title">Fullscreen Required</h2>
            <p className="apt-loading-desc">
              This assessment requires fullscreen mode to maintain a secure testing environment.
            </p>
            <button className="apt-start-btn" onClick={handleFullscreenRetry}>
              Enter Fullscreen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="apt-page"><div className="apt-container"><div className="apt-error">
      <svg className="apt-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
      <h3>Failed to load assessment</h3><p>{error}</p>
      <button className="apt-retry-btn" onClick={() => navigate(`/english/test?id=${assessmentId}`, { replace: true })}>Try Again</button>
    </div></div></div>);

  if (terminated) {
    return (
      <div className="apt-test-root">
        <AnimatePresence>
          {proctorOverlay && <ProctoringOverlay key="proctor" state={proctorOverlay} />}
        </AnimatePresence>
      </div>
    );
  }

  if (!started || questions.length === 0) return null;

  const answeredCount = Object.keys(answers).filter((k) => answers[k] != null && answers[k] !== "" && !(Array.isArray(answers[k]) && answers[k].length === 0)).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const q = questions[current] || {};
  const warningData = showWarning ? WARNING_MESSAGES[showWarning] : null;

  return (
    <div className="apt-test-root">
      {/* Top Bar */}
      <div className="apt-topbar">
        <div className="apt-topbar-left">
          <span className={`apt-test-module apt-test-module-${type}`}>{MODULE_LABELS[type] || "English"}</span>
          <LiveTimer initialSeconds={timerRef.current} onTimeUp={handleTimeUp} running={started && !submitting} />
          <div className="apt-topbar-progress">
            <span className="apt-progress-text">Q{current + 1}/{questions.length}</span>
            <div className="apt-progress-bar-track">
              <div className="apt-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className="apt-topbar-center">
          <span className="apt-progress-text">{answeredCount}/{questions.length} Answered</span>
          <div className={`apt-warning-badge ${warnings > 0 ? "has-warnings" : ""}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            {warnings}/3
          </div>
          <button className="apt-submit-top-btn" onClick={handleSubmit} disabled={submitting}>Submit</button>
        </div>
      </div>

      {/* Body */}
      <div className="apt-test-body">
        <div className="apt-question-panel">
          <div className="apt-question-number">Question {current + 1} of {questions.length}</div>
          <div className="apt-q-meta">
            <span className="apt-q-difficulty">{q.difficulty || "Medium"}</span>
            <span style={{ marginLeft: 8 }}>{q.marks || 1} mark{q.marks !== 1 ? "s" : ""}</span>
            <span style={{ marginLeft: 8 }}>{q.topic || ""}</span>
          </div>
          <p className="apt-question-text">{q.question || ""}</p>
          {q.passage && (
            <div className="apt-section-card" style={{ marginBottom: 20, padding: 16 }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>{q.passage}</p>
            </div>
          )}
          <QuestionRenderer question={q} index={current} answers={answers} onAnswer={handleAnswer} />
        </div>

        <div className="apt-navigator">
          <div className="apt-nav-title">Question Navigator</div>
          <div className="apt-nav-grid">
            {questions.map((_, i) => (
              <button key={i} className={`apt-nav-btn ${i === current ? "current" : ""} ${answers[i] != null && answers[i] !== "" && !(Array.isArray(answers[i]) && answers[i].length === 0) ? "answered" : ""} ${review.has(i) ? "review" : ""}`} onClick={() => { saveCurrentAnswer(); setCurrent(i); setVisited((prev) => new Set(prev).add(i)); }}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="apt-nav-legend">
            <div className="apt-nav-legend-item"><div className="apt-legend-dot answered" /> Answered</div>
            <div className="apt-nav-legend-item"><div className="apt-legend-dot current" /> Current</div>
            <div className="apt-nav-legend-item"><div className="apt-legend-dot review" /> Review</div>
            <div className="apt-nav-legend-item"><div className="apt-legend-dot unvisited" /> Not visited</div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="apt-bottombar">
        <div className="apt-bottom-left">
          <button className="apt-btn" disabled={current === 0} onClick={() => { saveCurrentAnswer(); setCurrent((p) => Math.max(0, p - 1)); }}>Previous</button>
          <button className="apt-btn" disabled={current >= questions.length - 1} onClick={() => { saveCurrentAnswer(); setCurrent((p) => Math.min(questions.length - 1, p + 1)); }}>Next</button>
        </div>
        <div className="apt-bottom-right">
          <button className={`apt-btn review ${review.has(current) ? "active" : ""}`} onClick={toggleReview}>Mark for Review</button>
          <button className="apt-btn" onClick={() => { setAnswers((prev) => { const next = { ...prev }; delete next[current]; return next; }); }}>Clear</button>
          <button className="apt-btn primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Test"}</button>
        </div>
      </div>

      {/* Progressive Warning Modals */}
      {showWarning && showWarning < 3 && warningData && (
        <div className="apt-modal-overlay">
          <motion.div className="apt-warning-modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <div className="apt-warning-icon-wrap">
              <svg className="apt-warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h3 className="apt-warning-title">{warningData.title}</h3>
            <p className="apt-warning-message">{warningData.message.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</p>
            <div className="apt-warning-counter">{showWarning} / 3</div>
            <button className="apt-warning-btn" onClick={handleDismissWarning}>Return to Exam</button>
          </motion.div>
        </div>
      )}

      {/* Termination Modal */}
      {terminated && (
        <div className="apt-modal-overlay">
          <motion.div className="apt-termination-modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="apt-termination-icon-wrap">
              <svg className="apt-termination-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/>
              </svg>
            </div>
            <h3 className="apt-termination-title">Assessment Terminated</h3>
            <p className="apt-termination-reason">{terminationReason}</p>
            <div className="apt-termination-badge">Disqualified</div>
          </motion.div>
        </div>
      )}

      {/* Proctoring status overlay */}
      <AnimatePresence>
        {proctorOverlay && <ProctoringOverlay key="proctor" state={proctorOverlay} />}
      </AnimatePresence>

      {/* Submit Confirmation Modal */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <SubmitConfirmModal
            questions={questions}
            answers={answers}
            review={review}
            onConfirm={handleConfirmSubmit}
            onCancel={() => setShowSubmitConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SubmitConfirmModal({ questions, answers, review, onConfirm, onCancel }) {
  const total = questions.length;
  const answered = Object.keys(answers).filter((k) => answers[k] != null && answers[k] !== "" && !(Array.isArray(answers[k]) && answers[k].length === 0)).length;
  const unanswered = total - answered;
  const marked = review.size;
  const hasUnanswered = unanswered > 0;

  return (
    <motion.div className="apt-modal-overlay apt-submit-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onCancel}>
      <motion.div className="apt-submit-modal" initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 10, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="apt-submit-glow" />
        <div className="apt-submit-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" />
            <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" />
            <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2.2" />
          </svg>
        </div>
        <h3 className="apt-submit-title">{hasUnanswered ? "Submit with unanswered questions?" : "Ready to submit?"}</h3>
        <p className="apt-submit-desc">
          {hasUnanswered
            ? `You still have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""} out of ${total}. You can return to complete them or submit now.`
            : `You have answered all ${total} questions. Review once more before final submission.`}
        </p>

        <div className="apt-submit-stats">
          <div className="apt-submit-stat answered">
            <span className="apt-submit-stat-val">{answered}</span>
            <span className="apt-submit-stat-label">Answered</span>
          </div>
          <div className="apt-submit-stat unanswered">
            <span className="apt-submit-stat-val">{unanswered}</span>
            <span className="apt-submit-stat-label">Unanswered</span>
          </div>
          <div className="apt-submit-stat marked">
            <span className="apt-submit-stat-val">{marked}</span>
            <span className="apt-submit-stat-label">Marked</span>
          </div>
        </div>

        {hasUnanswered && (
          <div className="apt-submit-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
            Unanswered questions will be marked as skipped and scored as 0.
          </div>
        )}

        <div className="apt-submit-actions">
          <button className="apt-submit-btn apt-submit-btn-secondary" onClick={onCancel}>Continue Exam</button>
          <button className="apt-submit-btn apt-submit-btn-primary" onClick={onConfirm}>
            <span>{hasUnanswered ? "Submit Anyway" : "Submit Assessment"}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Proctoring status overlay ───────────────────────────────────────────

function ProctoringOverlay({ state }) {
  const enabled = state === "enabled";
  return (
    <motion.div className="apt-proctor-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div className={`apt-proctor-glow ${enabled ? "on" : "off"}`} />
      <motion.div
        className="apt-proctor-card"
        initial={{ scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: -16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <div className={`apt-proctor-shield ${enabled ? "on" : "off"}`}>
          <span className="apt-proctor-ring r1" />
          <span className="apt-proctor-ring r2" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {enabled
              ? <polyline points="8.5 11.5 11 14 15.5 9.5" />
              : <line x1="8" y1="12" x2="16" y2="12" />}
          </svg>
        </div>

        <div className={`apt-proctor-status ${enabled ? "on" : "off"}`}>
          <span className="apt-proctor-pulse" />
          {enabled ? "PROCTORING ENABLED" : "PROCTORING DISABLED"}
        </div>

        <h3 className="apt-proctor-title">{enabled ? "Secure Exam Mode Active" : "Monitoring Ended"}</h3>
        <p className="apt-proctor-sub">
          {enabled
            ? "This session is monitored to keep the assessment fair for everyone."
            : "All monitoring has stopped. Preparing your results…"}
        </p>

        {enabled && (
          <div className="apt-proctor-tips">
            <div className="apt-proctor-tip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
              Stay in fullscreen for the whole test
            </div>
            <div className="apt-proctor-tip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 8h20" /></svg>
              Don't switch tabs, apps or windows
            </div>
            <div className="apt-proctor-tip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4m0 4h.01" /></svg>
              3 violations automatically end the exam
            </div>
          </div>
        )}

        <div className="apt-proctor-timer">
          <motion.div
            className={`apt-proctor-timer-fill ${enabled ? "on" : "off"}`}
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 3, ease: "linear" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Question sub-components ──────────────────────────────────────────────

const WARNING_MESSAGES = {
  1: {
    title: "Academic Integrity Warning",
    message: "You left the examination window.\n\nThis activity has been recorded.\n\nPlease return to the examination immediately.\n\nRepeated violations will result in automatic disqualification.",
  },
  2: {
    title: "Academic Integrity Warning",
    message: "This is your second warning.\n\nOne more violation will automatically terminate your assessment.",
  },
};

function QuestionRenderer({ question, index, answers, onAnswer }) {
  const val = answers[index];

  if (question.type === "boolean") {
    return (
      <div className="apt-boolean-grid">
        {["True", "False"].map((opt) => (
          <button key={opt} className={`apt-boolean-btn ${val === opt ? "selected" : ""}`} onClick={() => onAnswer(index, opt)}>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "numerical") {
    return (
      <input className="apt-numerical-input" type="number" value={val || ""} onChange={(e) => onAnswer(index, e.target.value)} placeholder="Enter your answer" autoComplete="off" />
    );
  }

  if (question.type === "multiple") {
    const selected = val || [];
    return (
      <div className="apt-options">
        {(question.options || []).map((opt, oi) => {
          const isSelected = selected.includes(oi);
          return (
            <div key={oi} className={`apt-option ${isSelected ? "selected" : ""}`} onClick={() => {
              const next = isSelected ? selected.filter((s) => s !== oi) : [...selected, oi];
              onAnswer(index, next);
            }}>
              <div className="apt-option-checkbox">{isSelected && <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><polyline points="20 6 9 17 4 12"/></svg>}</div>
              <span className="apt-option-label">{opt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Descriptive / situational / professional / text types -> textarea with 2000 char limit
  const descriptiveTypes = ["descriptive", "situational", "professional", "long_answer", "text", "essay"];
  if (descriptiveTypes.includes((question.type || "").toLowerCase())) {
    const textVal = typeof val === "string" ? val : (val != null ? String(val) : "");
    const charCount = textVal.length;
    const wordCount = textVal.trim() ? textVal.trim().split(/\s+/).filter(Boolean).length : 0;
    const maxChars = 2000;
    return (
      <div className="apt-descriptive-wrap">
        <textarea
          className="apt-descriptive-input"
          value={textVal}
          onChange={(e) => {
            let v = e.target.value;
            if (v.length > maxChars) v = v.slice(0, maxChars);
            onAnswer(index, v);
          }}
          maxLength={maxChars}
          rows={6}
          placeholder={question.placeholder || "Write your response here. Be coherent, concise and professional."}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 120, outline: "none" }}
        />
        <div className="apt-descriptive-meta" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <span>{wordCount} words</span>
          <span>{charCount}/{maxChars} characters</span>
        </div>
      </div>
    );
  }

  return (
    <div className="apt-options">
      {(question.options || []).map((opt, oi) => (
        <div key={oi} className={`apt-option ${val === oi ? "selected" : ""}`} onClick={() => onAnswer(index, oi)}>
          <div className="apt-option-radio" />
          <span className="apt-option-label">{opt}</span>
        </div>
      ))}
    </div>
  );
}
