import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useHonesty } from "../context/HonestyContext";
import { getProfile, generateAssessment, getAssessmentStatus } from "../services/apiService";
import "../styles/Aptitude.css";

const DIFFICULTIES = [
  { id: "easy", label: "Easy", badge: "Beginner", color: "#4ADE80", title: "Campus Placement", questions: 20, minutes: 20, timePerQ: "~1 min/question", desc: "Perfect for beginners preparing for campus recruitment drives.", topics: ["Percentages", "Time & Work", "Coding-Decoding", "Basic Reasoning"], stars: 2, companies: "Infosys · Capgemini · Wipro · Cognizant" },
  { id: "medium", label: "Medium", badge: "Intermediate", color: "#FBBF24", title: "Industry Standard", questions: 25, minutes: 35, timePerQ: "~1-2 min/question", desc: "Designed for Amazon, Oracle, Deloitte, Cisco and similar company hiring.", topics: ["Quantitative Aptitude", "Logical Reasoning", "Data Interpretation", "Analytical Reasoning"], stars: 3, companies: "Amazon · Accenture · Deloitte · Oracle · TCS Digital · Cisco" },
  { id: "hard", label: "Hard", badge: "Advanced", color: "#F87171", title: "Top Product Companies", questions: 30, minutes: 50, timePerQ: "~2-5 min/question", desc: "Designed for Microsoft, Google, NVIDIA, Adobe and product-based companies.", topics: ["Advanced Quant", "Complex Reasoning", "Case Studies", "Pattern Analysis"], stars: 5, companies: "Google · Microsoft · Adobe · Atlassian · Goldman Sachs · NVIDIA" },
];

const INSTRUCTIONS = [
  { icon: "brain", title: "Reasoning First", desc: "Every question evaluates reasoning and analytical ability rather than memorization.", highlights: ["Logical puzzles", "Data sufficiency", "Critical thinking"] },
  { icon: "clock", title: "Timed Assessment", desc: "Complete within the allocated time. Every question contributes equally to your score.", highlights: ["Per-question tracking", "Auto-submit", "Real-time progress"] },
  { icon: "shield", title: "AI Proctored", desc: "Full session integrity monitoring with real-time violation detection and logging.", highlights: ["Tab monitoring", "Fullscreen lock", "Fraud detection"] },
  { icon: "bar-chart", title: "Detailed Report", desc: "Comprehensive performance analysis with AI feedback and improvement recommendations.", highlights: ["Topic analysis", "AI feedback", "Weakness detection"] },
];

const TERMS_SECTIONS = [
  { title: "Assessment Rules", content: "You must complete the assessment within the allotted time. Answers are auto-saved. Closing the browser will resume from where you left off." },
  { title: "Academic Integrity", content: "Any attempt to switch tabs, open external applications, copy/paste content, or use unauthorized resources will be logged. Three or more violations will result in automatic disqualification." },
  { title: "Fullscreen Requirement", content: "The assessment must be taken in fullscreen mode. Exiting fullscreen will be recorded as a violation. You must re-enter fullscreen to continue." },
  { title: "Scoring", content: "Correct answers earn marks. There is no negative marking for incorrect answers. Skipped questions receive zero marks." },
  { title: "AI Evaluation", content: "Your performance is evaluated by an AI system that analyzes topic-wise strengths and weaknesses, providing personalized feedback and recommendations." },
  { title: "Data Usage", content: "Assessment data is used solely for performance analytics and improving your placement preparation. Results are stored securely." },
  { title: "Resume Option", content: "If you close the browser mid-assessment, you can resume from the last saved answer." },
  { title: "Question Bank", content: "Questions are pre-generated before the test starts. The LLM is never called during the test for zero latency." },
  { title: "No Internet Required (After Load)", content: "Once loaded, questions are served from the database. Intermittent connectivity will not interrupt the test." },
  { title: "Dynamic Difficulty", content: "Questions are distributed across quantitative aptitude, logical reasoning, analytical reasoning, and data interpretation based on placement test standards." },
  { title: "No Trivia", content: "All questions are placement-oriented. No general knowledge, history, or school-level questions appear." },
  { title: "Company Benchmarking", content: "Medium-level questions match Amazon, Deloitte, Oracle, TCS Digital. Hard-level questions match Google, Microsoft, Goldman Sachs." },
  { title: "Fraud Detection", content: "Mouse leave events, keyboard shortcuts, right-click, and developer tools are monitored in real time." },
  { title: "Profile Adaptation", content: "Questions are tailored to your degree, target role, skills, and weak areas for personalized preparation." },
];

function TermsModal({ open, onClose }) {
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
          <h2>Terms & Conditions</h2>
          <p>Please review the assessment policies before proceeding.</p>
        </div>
        <div className="apt-tnc-body">
          {TERMS_SECTIONS.map((section, i) => (
            <div key={i} className="apt-tnc-section">
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </div>
          ))}
        </div>
        <div className="apt-tnc-footer">
          <label className="apt-tnc-agree">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>I have read and agree to the terms and conditions</span>
          </label>
          <div className="apt-tnc-actions">
            <button className="apt-tnc-btn apt-tnc-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>, document.body
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Aptitude() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { honesty } = useHonesty();
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

  const diff = DIFFICULTIES.find((d) => d.id === selected) || DIFFICULTIES[1];
  const canGenerate = agreed && selected && !profileLoading && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenStatus("generating");
    setGenProgress(0);
    setGenError(null);

    try {
      const res = await generateAssessment(profile, selected);
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
        <motion.div className="apt-header" variants={item}>
          <h1>AI Aptitude Assessment</h1>
          <p>Your personalized placement-level assessment generated specifically for your profile.</p>
        </motion.div>

        <motion.div className="apt-features-grid" variants={item}>
          {INSTRUCTIONS.map((inst, i) => (
            <div key={i} className="apt-feature-card">
              <div className="apt-feature-icon-wrap">
                <svg className="apt-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {inst.icon === "brain" && <><path d="M12 2a4 4 0 0 1 4 4c0 2-1 3-4 5-3-2-4-3-4-5a4 4 0 0 1 4-4z"/><path d="M8 12a4 4 0 0 0 8 0"/></>}
                  {inst.icon === "clock" && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                  {inst.icon === "shield" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
                  {inst.icon === "bar-chart" && <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>}
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
            {DIFFICULTIES.map((d) => (
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
        <motion.div className="apt-start-section" variants={item}>
          {honesty?.locked ? (
            <div className="apt-lock-notice">
              <div className="apt-lock-notice-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3>New Assessments Locked</h3>
              <p>
                Your honesty score is <strong>{honesty.score}/100</strong>. Until it rises above 75 you can only
                reattempt your previous assessments. Complete one honestly to recover your score.
              </p>
              <Link to="/aptitude/history" className="apt-start-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                Reattempt a Previous Test
              </Link>
            </div>
          ) : (
            <>
          {/* Terms agreement */}
          <label className="apt-agreement">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={generating || genStatus === "ready"} />
            <span>I agree to the <button className="apt-link-btn" onClick={() => setTncOpen(true)}>Terms & Conditions</button></span>
          </label>

          {/* Generate Button */}
          {genStatus === "idle" && (
            <button className="apt-start-btn" onClick={handleGenerate} disabled={!canGenerate}>
              {profileLoading ? "Loading Profile..." : `Generate Assessment (${diff.questions} Q / ${diff.minutes} min)`}
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
                Generating questions... {genProgress}/{genTotal} ({progressPct}%)
              </p>
              <p className="apt-gen-progress-sub">Questions are being created in batches of 5. This usually takes 30-60 seconds.</p>
            </div>
          )}

          {/* Ready - Start Test */}
          {genStatus === "ready" && (
            <div className="apt-ready-section">
              <div className="apt-ready-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="apt-ready-text">Assessment ready! {genProgress} questions generated.</p>
              <button className="apt-start-btn apt-start-btn-ready" onClick={handleStart}>
                Start Test
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
            </>
          )}
        </motion.div>
      </div>

      <TermsModal open={tncOpen} onClose={() => setTncOpen(false)} />
    </motion.div>
  );
}
