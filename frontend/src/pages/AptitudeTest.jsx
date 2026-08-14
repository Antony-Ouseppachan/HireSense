import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
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
import { useHonesty } from "../context/HonestyContext";
import "../styles/Aptitude.css";

const TIME_MAP = { easy: 1200, medium: 2100, hard: 3000 };

const STEPS = [
  { key: "loading", label: "Loading questions" },
  { key: "fullscreen", label: "Entering secure mode" },
  { key: "starting", label: "Initializing timer" },
];

const EVAL_STEPS = [
  "Checking answers",
  "Calculating score",
  "Generating analytics",
  "AI evaluating strengths",
  "Preparing recommendations",
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

function EvalOverlay({ stepIndex }) {
  return (
    <div className="apt-eval-overlay">
      <div className="apt-eval-card">
        <div className="apt-eval-ring">
          <div className="apt-eval-ring-inner">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
              <path d="M8 12.5l3 3 5.5-6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <h3 className="apt-eval-title">Evaluating your performance...</h3>
        <p className="apt-eval-est">Estimated time: 2–5 seconds</p>
        <div className="apt-eval-list">
          {EVAL_STEPS.map((label, i) => (
            <div key={label} className={`apt-eval-step ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}`}>
              <span className="apt-eval-step-icon">
                {i < stepIndex && <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>}
                {i === stepIndex && <div className="apt-loading-spinner" />}
                {i > stepIndex && <div className="apt-eval-step-dot" />}
              </span>
              <span className="apt-eval-step-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AptitudeTest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get("id");
  const hasSubmitted = useRef(false);
  const saveTimerRef = useRef(null);
  const timerRef = useRef(null);
  const timesRef = useRef({});
  const questionStartRef = useRef(Date.now());

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState(new Set());
  const [visited, setVisited] = useState(new Set());
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [evalStep, setEvalStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [showWarning, setShowWarning] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [maxTime, setMaxTime] = useState(TIME_MAP.medium);
  const [loadingStep, setLoadingStep] = useState(null);
  const [loadingError, setLoadingError] = useState(null);
  const [fullscreenDenied, setFullscreenDenied] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(""); // "" | "saving" | "saved"
  const savedTimeoutRef = useRef(null);
  const warningViolationRef = useRef(null);
  const { enableExamMode, disableExamMode } = useExam();
  const { refresh: refreshHonesty } = useHonesty();
  const pendingFullscreenRef = useRef(false);
  const beginCalledRef = useRef(false);

  useEffect(() => {
    enableExamMode();
    return () => disableExamMode();
  }, [enableExamMode, disableExamMode]);

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

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* ignore */
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
        setDifficulty(diff);
        const timeLimit = TIME_MAP[diff] || TIME_MAP.medium;
        setMaxTime(timeLimit);
        timerRef.current = timeLimit;

        const restored = {};
        const restoredTimes = {};
        for (const sa of savedAnswers) {
          if (sa.status === "answered" || sa.status === "reviewed") {
            let val = sa.answer;
            try { const p = JSON.parse(val); if (Array.isArray(p)) val = p; } catch {}
            restored[sa.questionNumber - 1] = val;
          }
          if (sa.timeSpent) restoredTimes[sa.questionNumber - 1] = sa.timeSpent;
        }

        // Crash-restore: overlay any newer localStorage backup
        try {
          const backup = JSON.parse(localStorage.getItem(`apt_backup_${assessmentId}`) || "null");
          if (backup && backup.answers) {
            for (const [k, v] of Object.entries(backup.answers)) restored[k] = v;
            if (backup.review) setReview(new Set(backup.review));
            if (backup.times) {
              for (const [k, v] of Object.entries(backup.times)) restoredTimes[k] = v;
            }
            localStorage.removeItem(`apt_backup_${assessmentId}`);
          }
        } catch {}

        timesRef.current = restoredTimes;

        setQuestions(qs);
        setAnswers(restored);

        const restoredVisited = new Set();
        savedAnswers.forEach((sa) => restoredVisited.add(sa.questionNumber - 1));
        Object.keys(restored).forEach((k) => restoredVisited.add(Number(k)));
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

  // ── Per-question elapsed time ─────────────────────────────────────────
  const recordElapsed = useCallback((fromIndex) => {
    const elapsed = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));
    questionStartRef.current = Date.now();
    if (fromIndex == null) return;
    timesRef.current[fromIndex] = (timesRef.current[fromIndex] || 0) + elapsed;
  }, []);

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
  const syncAnswersToServer = useCallback(async (targetIndex = null) => {
    if (!assessmentId || !questions.length) return;
    const idx = targetIndex != null ? targetIndex : current;
    const question = questions[idx];
    if (!question) return;
    const val = answers[idx];
    if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) return;
    setSavedIndicator("saving");
    try {
      await saveAnswer(assessmentId, {
        questionId: question.id,
        answer: Array.isArray(val) ? JSON.stringify(val) : String(val ?? ""),
        timeSpent: timesRef.current[idx] || 0,
        status: review.has(idx) ? "reviewed" : "answered",
      });
      setSavedIndicator("saved");
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSavedIndicator(""), 2500);
    } catch {
      setSavedIndicator("");
    }
  }, [assessmentId, questions, answers, current, review]);

  // ── Save current answer on navigation ─────────────────────────────────
  const saveCurrentAnswer = useCallback(() => {
    syncAnswersToServer(current);
  }, [syncAnswersToServer, current]);

  // ── Anti-cheat ─────────────────────────────────────────────────────────
  const onViolation = useCallback((violation, count) => {
    warningViolationRef.current = violation;

    // Once submitted, the intentional fullscreen exit (and any other events
    // fired during the redirect) must not count as violations or re-enter
    // fullscreen.
    if (hasSubmitted.current) return;

    if (violation.type === "fullscreen-exit") {
      pendingFullscreenRef.current = true;
      requestFullscreen();
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
      handleFinalSubmit(true);
    } else {
      setShowWarning(count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, current]);

  const { warnings } = useAntiCheat({
    onViolation,
    maxWarnings: 3,
    enabled: started,
    currentQuestion: current,
  });

  const handleDismissWarning = useCallback(() => {
    if (pendingFullscreenRef.current) {
      pendingFullscreenRef.current = false;
      requestFullscreen();
    }
    setShowWarning(null);
  }, [requestFullscreen]);

  const handleAnswer = useCallback((index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
    setVisited((prev) => new Set(prev).add(index));
    const question = questions[index];
    if (question && assessmentId) {
      saveAnswer(assessmentId, {
        questionId: question.id,
        answer: Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""),
        timeSpent: timesRef.current[index] || 0,
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

  // ── localStorage crash backup ─────────────────────────────────────────
  useEffect(() => {
    if (!started || !assessmentId) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `apt_backup_${assessmentId}`,
          JSON.stringify({ answers, review: [...review], times: timesRef.current })
        );
      } catch {}
    }, 800);
    return () => clearTimeout(timer);
  }, [answers, review, started, assessmentId]);

  // ── Timer persistence ──────────────────────────────────────────────────
  useEffect(() => {
    if (!started || questions.length === 0) return;
    const id = setInterval(() => {
      timerRef.current = Math.max(0, timerRef.current - 1);
      if (assessmentId) sessionStorage.setItem(`apt_remaining_${assessmentId}`, String(timerRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [started, questions, assessmentId]);

  // ── Keyboard navigation (arrow keys + number shortcuts) ───────────────
  useEffect(() => {
    if (!started || submitting || showSubmitModal) return;
    const goTo = (i) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, i));
      recordElapsed(current);
      saveCurrentAnswer();
      setCurrent(clamped);
      setVisited((prev) => new Set(prev).add(clamped));
    };
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
      else if (e.key >= "1" && e.key <= "9") { goTo(Number(e.key) - 1); }
      else if (e.key === "0") { goTo(9); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, submitting, showSubmitModal, questions.length, current, recordElapsed, saveCurrentAnswer]);

  // ── Submit flow ────────────────────────────────────────────────────────
  const handleFinalSubmit = useCallback(async (isTerminated = false) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setSubmitting(true);
    setEvalStep(0);

    // Record elapsed on the final question
    recordElapsed(current);
    await syncAnswersToServer(current);

    // Animated evaluation steps while the backend evaluates
    const stepTimers = EVAL_STEPS.map((_, i) =>
      setTimeout(() => setEvalStep(i + 1), (i + 1) * 900)
    );

    try {
      const res = await completeAssessment(assessmentId);
      const id = res?.id || assessmentId;
      sessionStorage.removeItem(`apt_remaining_${assessmentId}`);
      stepTimers.forEach(clearTimeout);
      exitFullscreen();
      refreshHonesty().catch(() => {});
      navigate(`/aptitude/results/${id}`, {
        replace: true,
        state: { result: res?.result || res, difficulty, terminated: isTerminated },
      });
    } catch {
      stepTimers.forEach(clearTimeout);
      exitFullscreen();
      navigate("/aptitude", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }, [assessmentId, difficulty, syncAnswersToServer, navigate, recordElapsed, current]);

  const openSubmitModal = useCallback(() => {
    if (submitting) return;
    recordElapsed(current);
    saveCurrentAnswer();
    setShowSubmitModal(true);
  }, [submitting, current, recordElapsed, saveCurrentAnswer]);

  const confirmSubmit = useCallback(() => {
    setShowSubmitModal(false);
    handleFinalSubmit(false);
  }, [handleFinalSubmit]);

  const cancelSubmit = useCallback(() => {
    setShowSubmitModal(false);
    questionStartRef.current = Date.now();
  }, []);

  const handleTimeUp = useCallback(() => {
    handleFinalSubmit(false);
  }, [handleFinalSubmit]);

  // ── Render states ──────────────────────────────────────────────────────

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
            <h2 className="apt-loading-title">Preparing Your Assessment</h2>
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
      <button className="apt-retry-btn" onClick={() => navigate(`/aptitude/test?id=${assessmentId}`, { replace: true })}>Try Again</button>
    </div></div></div>);

  if (!started || questions.length === 0) return null;

  const answeredCount = Object.keys(answers).filter((k) => answers[k] != null && answers[k] !== "" && !(Array.isArray(answers[k]) && answers[k].length === 0)).length;
  const remaining = questions.length - answeredCount;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const q = questions[current] || {};
  const warningData = showWarning ? WARNING_MESSAGES[showWarning] : null;

  return (
    <div className="apt-test-root" role="main" aria-label="Aptitude Assessment">
      {/* Evaluation overlay */}
      {submitting && <EvalOverlay stepIndex={evalStep} />}

      {/* Top Bar */}
      <div className="apt-topbar">
        <div className="apt-topbar-left">
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
          <span className={`apt-saved-indicator ${savedIndicator === "saved" ? "visible" : ""} ${savedIndicator === "saving" ? "saving" : ""}`} aria-live="polite">
            {savedIndicator === "saving" ? "Saving..." : savedIndicator === "saved" ? "Saved ✓" : ""}
          </span>
          <div className={`apt-warning-badge ${warnings > 0 ? "has-warnings" : ""}`} title="Integrity warnings">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            {warnings}/3
          </div>
          <button className="apt-submit-top-btn" onClick={openSubmitModal} disabled={submitting}>Submit</button>
        </div>
      </div>

      {/* Body */}
      <div className="apt-test-body">
        <div className="apt-question-panel" aria-live="polite">
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

        <div className="apt-navigator" aria-label="Question navigator">
          <div className="apt-nav-title">Question Navigator</div>
          <div className="apt-nav-grid">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`apt-nav-btn ${i === current ? "current" : ""} ${answers[i] != null && answers[i] !== "" && !(Array.isArray(answers[i]) && answers[i].length === 0) ? "answered" : ""} ${review.has(i) ? "review" : ""}`}
                onClick={() => { recordElapsed(current); saveCurrentAnswer(); setCurrent(i); setVisited((prev) => new Set(prev).add(i)); }}
                aria-label={`Question ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
              >
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
          <button className="apt-btn" disabled={current === 0} onClick={() => { recordElapsed(current); saveCurrentAnswer(); setCurrent((p) => Math.max(0, p - 1)); }}>Previous</button>
          <button className="apt-btn" disabled={current >= questions.length - 1} onClick={() => { recordElapsed(current); saveCurrentAnswer(); setCurrent((p) => Math.min(questions.length - 1, p + 1)); }}>Next</button>
        </div>
        <div className="apt-bottom-right">
          <button className={`apt-btn review ${review.has(current) ? "active" : ""}`} onClick={toggleReview}>Mark for Review</button>
          <button className="apt-btn" onClick={() => { setAnswers((prev) => { const next = { ...prev }; delete next[current]; return next; }); }}>Clear</button>
          <button className="apt-btn primary" onClick={openSubmitModal} disabled={submitting}>{submitting ? "Submitting..." : "Submit Test"}</button>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && createPortal(
        <div className="apt-modal-overlay" role="dialog" aria-modal="true" aria-label="Submit assessment confirmation">
          <motion.div className="apt-submit-modal" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            <div className="apt-submit-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" width="30" height="30">
                <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
                <path d="M12 7v5l3 2" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="apt-submit-modal-title">Finish Assessment?</h3>
            <div className="apt-submit-summary">
              <div className="apt-submit-stat">
                <span className="apt-submit-stat-value">{answeredCount} / {questions.length}</span>
                <span className="apt-submit-stat-label">Questions Answered</span>
              </div>
              <div className="apt-submit-stat">
                <span className="apt-submit-stat-value">{remaining}</span>
                <span className="apt-submit-stat-label">Remaining</span>
              </div>
            </div>
            <p className="apt-submit-note">Once submitted you cannot edit this attempt. Are you sure you want to finish?</p>
            <div className="apt-submit-actions">
              <button className="apt-btn" onClick={cancelSubmit} autoFocus>Cancel</button>
              <button className="apt-btn primary" onClick={confirmSubmit}>Submit Assessment</button>
            </div>
          </motion.div>
        </div>, document.body)}

      {/* Progressive Warning Modals */}
      {showWarning && showWarning < 3 && warningData && createPortal(
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
        </div>, document.body)}

      {/* Termination Modal */}
      {terminated && createPortal(
        <div className="apt-modal-overlay" role="dialog" aria-modal="true" aria-label="Assessment terminated">
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
        </div>, document.body)}
    </div>
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
      <div className="apt-boolean-grid" role="radiogroup" aria-label="True or false">
        {["True", "False"].map((opt) => (
          <button key={opt} role="radio" aria-checked={val === opt} className={`apt-boolean-btn ${val === opt ? "selected" : ""}`} onClick={() => onAnswer(index, opt)}>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "numerical") {
    return (
      <input className="apt-numerical-input" type="number" value={val || ""} onChange={(e) => onAnswer(index, e.target.value)} placeholder="Enter your answer" autoComplete="off" aria-label="Numerical answer" />
    );
  }

  if (question.type === "multiple") {
    const selected = val || [];
    return (
      <div className="apt-options" role="group" aria-label="Select all that apply">
        {(question.options || []).map((opt, oi) => {
          const isSelected = selected.includes(oi);
          return (
            <div key={oi} role="checkbox" aria-checked={isSelected} tabIndex="0" className={`apt-option ${isSelected ? "selected" : ""}`} onClick={() => {
              const next = isSelected ? selected.filter((s) => s !== oi) : [...selected, oi];
              onAnswer(index, next);
            }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const next = isSelected ? selected.filter((s) => s !== oi) : [...selected, oi]; onAnswer(index, next); } }}>
              <div className="apt-option-checkbox">{isSelected && <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><polyline points="20 6 9 17 4 12"/></svg>}</div>
              <span className="apt-option-label">{opt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="apt-options" role="radiogroup" aria-label="Choose one answer">
      {(question.options || []).map((opt, oi) => (
        <div key={oi} role="radio" aria-checked={val === oi} tabIndex="0" className={`apt-option ${val === oi ? "selected" : ""}`} onClick={() => onAnswer(index, oi)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAnswer(index, oi); } }}>
          <div className="apt-option-radio" />
          <span className="apt-option-label">{opt}</span>
        </div>
      ))}
    </div>
  );
}
