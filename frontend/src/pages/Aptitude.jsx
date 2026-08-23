import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getProfile, generateAssessment, getAssessmentStatus } from "../services/apiService";
import "../styles/Aptitude.css";

/* ─── Module meta ──────────────────────────────────────────────────── */

const APTITUDE_DIFFICULTIES = [
  { id: "easy", label: "Easy", badge: "Beginner", color: "#4ADE80", title: "Campus Placement", questions: 20, minutes: 20, timePerQ: "~1 min/question", desc: "Perfect for beginners preparing for campus recruitment drives.", topics: ["Percentages", "Time & Work", "Coding-Decoding", "Basic Reasoning"], stars: 2, companies: "Infosys · Capgemini · Wipro · Cognizant" },
  { id: "medium", label: "Medium", badge: "Intermediate", color: "#FBBF24", title: "Industry Standard", questions: 25, minutes: 35, timePerQ: "~1-2 min/question", desc: "Designed for Amazon, Oracle, Deloitte, Cisco and similar company hiring.", topics: ["Quantitative Aptitude", "Logical Reasoning", "Data Interpretation", "Analytical Reasoning"], stars: 3, companies: "Amazon · Accenture · Deloitte · Oracle · TCS Digital · Cisco" },
  { id: "hard", label: "Hard", badge: "Advanced", color: "#F87171", title: "Top Product Companies", questions: 30, minutes: 50, timePerQ: "~2-5 min/question", desc: "Designed for Microsoft, Google, NVIDIA, Adobe and product-based companies.", topics: ["Advanced Quant", "Complex Reasoning", "Case Studies", "Pattern Analysis"], stars: 5, companies: "Google · Microsoft · Adobe · Atlassian · Goldman Sachs · NVIDIA" },
];

const GK_DIFFICULTIES = [
  { id: "easy", label: "Easy", badge: "Basic Awareness", color: "#4ADE80", title: "Foundations", questions: 20, minutes: 15, timePerQ: "~30-45s/question", desc: "Basic but meaningful general awareness across everyday subjects.", topics: ["Common Science", "Basic Geography", "Major Organizations", "Basic Economics"], stars: 2, companies: "School Exams · SSC · RRB · NTPC" },
  { id: "medium", label: "Medium", badge: "Placement Level", color: "#FBBF24", title: "Competitive Standard", questions: 25, minutes: 20, timePerQ: "~40-45s/question", desc: "Placement-test level general knowledge requiring recall with conceptual understanding.", topics: ["Institutions", "Science & Tech", "Economy", "Geography"], stars: 3, companies: "SSC CGL · IBPS · MNC Placement · State PSC" },
  { id: "hard", label: "Hard", badge: "Advanced", color: "#F87171", title: "Strong Competitive", questions: 30, minutes: 30, timePerQ: "~50-60s/question", desc: "Deep, cross-domain general knowledge with highly plausible distractors.", topics: ["Current Affairs", "Computing/IT", "Space & Environment", "Corporate Awareness"], stars: 5, companies: "UPSC · IIM Interviews · Air Force · NDA" },
];

const MODULES = {
  aptitude: {
    key: "aptitude",
    label: "AI Aptitude Assessment",
    short: "Aptitude",
    accent: "#38bdf8",
    tagline: "Placement-level reasoning, quantitative and logical aptitude generated specifically for your profile.",
    icon: "brain",
    difficulties: APTITUDE_DIFFICULTIES,
    instructions: [
      { icon: "brain", title: "Reasoning First", desc: "Every question evaluates reasoning and analytical ability rather than memorization.", highlights: ["Logical puzzles", "Data sufficiency", "Critical thinking"] },
      { icon: "clock", title: "Timed Assessment", desc: "Complete within the allocated time. Every question contributes equally to your score.", highlights: ["Per-question tracking", "Auto-submit", "Real-time progress"] },
      { icon: "shield", title: "AI Proctored", desc: "Full session integrity monitoring with real-time violation detection and logging.", highlights: ["Tab monitoring", "Fullscreen lock", "Fraud detection"] },
      { icon: "bar-chart", title: "Detailed Report", desc: "Comprehensive performance analysis with AI feedback and improvement recommendations.", highlights: ["Topic analysis", "AI feedback", "Weakness detection"] },
    ],
    terms: [
      { title: "Assessment Rules", content: "You must complete the assessment within the allotted time. Answers are auto-saved. Closing the browser will resume from where you left off." },
      { title: "Academic Integrity", content: "Any attempt to switch tabs, open external applications, copy/paste content, or use unauthorized resources will be logged. Three or more violations will result in automatic disqualification." },
      { title: "Fullscreen Requirement", content: "The assessment must be taken in fullscreen mode. Exiting fullscreen will be recorded as a violation. You must re-enter fullscreen to continue." },
      { title: "Scoring", content: "Correct answers earn marks. There is no negative marking for incorrect answers. Skipped questions receive zero marks." },
      { title: "AI Evaluation", content: "Your performance is evaluated by an AI system that analyzes topic-wise strengths and weaknesses, providing personalized feedback and recommendations." },
      { title: "Question Bank", content: "Questions are pre-generated before the test starts. The LLM is never called during the test for zero latency." },
      { title: "No Trivia", content: "All questions are placement-oriented. No general knowledge, history, or school-level questions appear." },
      { title: "Company Benchmarking", content: "Medium-level questions match Amazon, Deloitte, Oracle, TCS Digital. Hard-level questions match Google, Microsoft, Goldman Sachs." },
      { title: "Profile Adaptation", content: "Questions are tailored to your degree, target role, skills, and weak areas for personalized preparation." },
      { title: "Fraud Detection", content: "Mouse leave events, keyboard shortcuts, right-click, and developer tools are monitored in real time." },
    ],
  },
  general_knowledge: {
    key: "general_knowledge",
    label: "General Knowledge Assessment",
    short: "General Knowledge",
    accent: "#34d399",
    tagline: "Competitive placement-level general knowledge across current affairs, science, economics, business, geography and more — generated fresh by AI.",
    icon: "globe",
    difficulties: GK_DIFFICULTIES,
    instructions: [
      { icon: "globe", title: "Knowledge-Driven", desc: "Every question tests established, verifiable knowledge — not trivia guessing. Difficulty genuinely matches the level you select.", highlights: ["Exact facts", "One clear answer", "Cross-domain"] },
      { icon: "clock", title: "Fast-Paced Assessment", desc: "Shorter per-question timings that mirror competitive exams. Every question counts equally to your score.", highlights: ["Quick-fire rounds", "Auto-submit", "Real-time progress"] },
      { icon: "shield", title: "AI Proctored", desc: "The same full session integrity monitoring with real-time violation detection and logging.", highlights: ["Tab monitoring", "Fullscreen lock", "Fraud detection"] },
      { icon: "bar-chart", title: "Detailed Report", desc: "Comprehensive category-wise analysis with AI feedback and a personalized study roadmap.", highlights: ["Category analysis", "AI feedback", "Weakness detection"] },
    ],
    terms: [
      { title: "Assessment Rules", content: "You must complete the assessment within the allotted time. Answers are auto-saved. Closing the browser will resume from where you left off." },
      { title: "Academic Integrity", content: "Any attempt to switch tabs, open external applications, copy/paste content, or use unauthorized resources will be logged. Three or more violations will result in automatic disqualification." },
      { title: "Fullscreen Requirement", content: "The assessment must be taken in fullscreen mode. Exiting fullscreen will be recorded as a violation. You must re-enter fullscreen to continue." },
      { title: "Scoring", content: "Correct answers earn marks. There is no negative marking for incorrect answers. Skipped questions receive zero marks." },
      { title: "Factual Content", content: "All questions are based on stable, verifiable facts. Political persuasion, opinions, and volatile current events are excluded." },
      { title: "AI Evaluation", content: "Your performance is evaluated by an AI system that analyzes category-wise strengths and weaknesses and suggests a study roadmap." },
      { title: "Question Bank", content: "Questions are pre-generated one at a time before the test starts. The LLM is never called during the test for zero latency." },
      { title: "Difficulty Calibration", content: "Easy covers basic awareness. Medium is placement-test level with plausible distractors. Hard is strong competitive level combining multiple facts." },
      { title: "Fraud Detection", content: "Mouse leave events, keyboard shortcuts, right-click, and developer tools are monitored in real time." },
    ],
  },
};

function TermsModal({ open, onClose, terms, accent }) {
  const [accepted, setAccepted] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) { setAccepted(false); return; }
    const handler = (e) => { if (e.key === "Escape" && !accepted) onClose(); };
    window.addEventListener("keydown", handler);
    modalRef.current?.focus();
    return () => window.removeEventListener("keydown", handler);
  }, [open, accepted, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="apt-modal-overlay" onClick={() => { if (!accepted) onClose(); }}>
      <div className="apt-tnc-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="apt-tnc-header">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          <h2>Terms &amp; Conditions</h2>
          <p>Please review the assessment policies before proceeding.</p>
        </div>
        <div className="apt-tnc-body">
          {(terms || []).map((section, i) => (
            <div key={i} className="apt-tnc-section">
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </div>
          ))}
        </div>
        <div className="apt-tnc-footer">
          <label
            className={`apt-tnc-agree ${accepted ? "checked" : ""}`}
            style={{ "--apt-accent": accent, "--apt-accent-30": `${accent}4D`, "--apt-accent-50": `${accent}80` }}
          >
            <input type="checkbox" className="apt-agree-input" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span className="apt-agree-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <span>I have read and agree to the terms and conditions</span>
          </label>
          <div className="apt-tnc-actions">
            <button className="apt-tnc-btn apt-tnc-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FeatureIcon({ name }) {
  if (name === "brain") return <><path d="M12 2a4 4 0 0 1 4 4c0 2-1 3-4 5-3-2-4-3-4-5a4 4 0 0 1 4-4z"/><path d="M8 12a4 4 0 0 0 8 0"/></>;
  if (name === "globe") return <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>;
  if (name === "clock") return <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>;
  if (name === "shield") return <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>;
  if (name === "bar-chart") return <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>;
  return null;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Aptitude() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [moduleKey] = useState(() =>
    searchParams.get("type") === "general_knowledge" ? "general_knowledge" : "aptitude"
  );
  const [agreed, setAgreed] = useState(false);
  const [selected, setSelected] = useState("medium");
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tncOpen, setTncOpen] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [assessmentId, setAssessmentId] = useState(null);
  const [genProgress, setGenProgress] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [genStatus, setGenStatus] = useState("idle"); // idle | generating | ready | failed
  const [genError, setGenError] = useState(null);
  const pollRef = useRef(null);

  const module = MODULES[moduleKey] || MODULES.aptitude;
  const accent = module.accent;
  const diff = module.difficulties.find((d) => d.id === selected) || module.difficulties[1];
  const canGenerate = agreed && selected && !profileLoading && !generating;

  useEffect(() => {
    (async () => {
      try {
        const res = await getProfile();
        setProfile(res?.profile || {});
      } catch { /* ignore */ }
      setProfileLoading(false);
    })();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenStatus("generating");
    setGenProgress(0);
    setGenError(null);

    try {
      const res = await generateAssessment(profile, selected, moduleKey);
      const id = res?.assessmentId;
      if (!id) throw new Error("No assessment ID returned");
      setAssessmentId(id);
      setGenTotal(diff.questions);

      // Poll for status every 1 second
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await getAssessmentStatus(id);
          const s = statusRes?.assessment;
          if (s) {
            setGenProgress(s.questions_generated || 0);
            if (s.status === "ready") {
              setGenStatus("ready");
              clearInterval(pollRef.current);
              pollRef.current = null;
            } else if (s.status === "failed" || s.status === "cancelled") {
              setGenStatus("failed");
              setGenError("Question generation failed. Please try again.");
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch { /* poll silently */ }
      }, 1000);
    } catch (err) {
      setGenStatus("failed");
      setGenError(err.message || "Failed to generate assessment");
      setGenerating(false);
    }
  };

  const handleStart = () => {
    if (genStatus !== "ready" || !assessmentId) return;
    navigate(`/aptitude/test?id=${assessmentId}`);
  };

  const handleRetry = () => {
    setGenerating(false);
    setAssessmentId(null);
    setGenProgress(0);
    setGenStatus("idle");
    setGenError(null);
  };

  const progressPct = genTotal > 0 ? Math.round((genProgress / genTotal) * 100) : 0;

  return (
    <motion.div className="apt-page" variants={container} initial="hidden" animate="show">
      <div className="apt-container">
        <button
          className="cat-back-btn"
          onClick={() => navigate("/interviews")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Studio
        </button>

        <motion.div className="apt-header" variants={item}>
          <h1>{module.label}</h1>
          <p>{module.tagline}</p>
        </motion.div>

        <motion.div className="apt-features-grid" variants={item}>
          {module.instructions.map((inst, i) => (
            <div key={i} className="apt-feature-card">
              <div className="apt-feature-icon-wrap">
                <svg className="apt-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <FeatureIcon name={inst.icon} />
                </svg>
              </div>
              <div className="apt-feature-body">
                <h3 className="apt-feature-title">{inst.title}</h3>
                <p className="apt-feature-desc">{inst.desc}</p>
                <div className="apt-feature-highlights">
                  {inst.highlights.map((h, hi) => (
                    <span key={hi} className="apt-feature-chip">{h}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div className="apt-difficulty-section" variants={item}>
          <h2>Select Difficulty</h2>
          <div className="apt-diff-grid">
            {module.difficulties.map((d) => (
              <motion.button
                key={d.id}
                className={`apt-diff-card ${selected === d.id ? "selected" : ""}`}
                onClick={() => { if (!generating && genStatus !== "ready") setSelected(d.id); }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                disabled={generating || genStatus === "ready"}
              >
                <div className="apt-diff-top">
                  <span className="apt-diff-badge-new" style={{ borderColor: d.color, color: d.color }}>
                    <span className="apt-diff-dot" style={{ background: d.color }} />
                    {d.label}
                  </span>
                  <span className="apt-diff-badge-level">{d.badge}</span>
                </div>
                <h3 className="apt-diff-title">{d.title}</h3>
                <div className="apt-diff-meta">
                  <div className="apt-diff-meta-item">
                    <svg className="apt-diff-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    <span>{d.questions}</span>
                  </div>
                  <span className="apt-diff-meta-divider" />
                  <div className="apt-diff-meta-item">
                    <svg className="apt-diff-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{d.minutes}m</span>
                  </div>
                  <span className="apt-diff-meta-divider" />
                  <div className="apt-diff-meta-item">
                    <span>{d.timePerQ}</span>
                  </div>
                </div>
                <p className="apt-diff-desc">{d.desc}</p>
                <div className="apt-diff-topics">
                  {d.topics.map((t, ti) => (
                    <span key={ti} className="apt-diff-topic">{t}</span>
                  ))}
                </div>
                <div className="apt-diff-stars">
                  {Array.from({ length: 5 }, (_, si) => (
                    <svg key={si} className={`apt-diff-star ${si < d.stars ? "filled" : ""}`} viewBox="0 0 24 24" fill={si < d.stars ? d.color : "none"} stroke={si < d.stars ? d.color : "rgba(255,255,255,0.15)"} strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <p className="apt-diff-companies">{d.companies}</p>
                {selected === d.id && (
                  <motion.div className="apt-diff-selected-check" layoutId="diffCheck" transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Generation / Start Area */}
        <motion.div
          className="apt-start-section"
          variants={item}
          style={{ "--apt-accent": accent, "--apt-accent-08": `${accent}14`, "--apt-accent-14": `${accent}24`, "--apt-accent-20": `${accent}33`, "--apt-accent-30": `${accent}4D`, "--apt-accent-50": `${accent}80` }}
        >
          {/* Terms agreement */}
          <div
            className={`apt-agreement ${agreed ? "checked" : ""} ${generating || genStatus === "ready" ? "disabled" : ""}`}
          >
            <label className="apt-agree-label">
              <input
                type="checkbox"
                className="apt-agree-input"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={generating || genStatus === "ready"}
              />
              <span className="apt-agree-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <span className="apt-agree-text">
                <span className="apt-agree-title">I accept the Terms &amp; Conditions</span>
                <span className="apt-agree-sub">Proctored exam rules, academic integrity policy and scoring terms apply to this assessment.</span>
              </span>
            </label>
            <button type="button" className="apt-agree-view" onClick={() => setTncOpen(true)}>
              View Terms
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>

          {/* Generate Button */}
          {genStatus === "idle" && (
            <button className="apt-start-btn" onClick={handleGenerate} disabled={!canGenerate}>
              {profileLoading ? (
                <>
                  <span className="apt-cta-spinner" aria-hidden="true" />
                  <span>Loading Profile...</span>
                </>
              ) : (
                <>
                  <svg className="apt-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  <span>Generate {module.short} Assessment</span>
                  <span className="apt-cta-meta">{diff.questions} Q · {diff.minutes} min</span>
                </>
              )}
            </button>
          )}
          {!canGenerate && genStatus === "idle" && !profileLoading && (
            <p className="apt-start-hint">Agree to the terms above to generate your assessment.</p>
          )}

          {/* Generation Progress */}
          {genStatus === "generating" && (
            <div className="apt-gen-progress">
              <div className="apt-gen-progress-bar-track">
                <motion.div className="apt-gen-progress-bar-fill" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5 }} />
              </div>
              <p className="apt-gen-progress-text">
                Generating {module.short.toLowerCase()} questions... {genProgress}/{genTotal} ({progressPct}%)
              </p>
              <p className="apt-gen-progress-sub">
                {moduleKey === "general_knowledge"
                  ? "Questions are being generated one at a time. This keeps generation fast and resilient."
                  : "Questions are being created in batches of 5. This usually takes 30-60 seconds."}
              </p>
            </div>
          )}

          {/* Ready - Start Test */}
          {genStatus === "ready" && (
            <div className="apt-ready-section">
              <div className="apt-ready-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="apt-ready-text">{module.short} assessment ready! {genProgress} questions generated.</p>
              <button className="apt-start-btn apt-start-btn-ready" onClick={handleStart}>
                <svg className="apt-cta-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                <span>Start Test</span>
              </button>
            </div>
          )}

          {/* Failed */}
          {genStatus === "failed" && (
            <div className="apt-ready-section">
              <p className="apt-error-text">{genError || "Generation failed."}</p>
              <button className="apt-start-btn" onClick={handleRetry}>Try Again</button>
            </div>
          )}
        </motion.div>
      </div>

      <TermsModal open={tncOpen} onClose={() => setTncOpen(false)} terms={module.terms} accent={accent} />
    </motion.div>
  );
}