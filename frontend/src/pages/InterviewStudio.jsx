import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile, getInterviews, submitFeatureRequest } from "../services/apiService";
import {
  IconAptitude, IconGlobe, IconMessage, IconCode,
  IconResume, IconTarget, IconBuilding, IconDatabase, IconBarChart,
  IconPlay, IconBrain, IconHandshake, IconTerminal,
  IconClipboard, IconShuffle, IconTrendingUp, IconCheckCircle,
  IconLock, IconArrowRight, IconStar, IconAlertCircle, IconRefreshCw,
  IconCaseStudy, IconAnalyze, IconPaper, IconMic, IconBook,
  IconMail,
} from "../components/Icons";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/InterviewStudio.css";

const CATEGORIES = [
  { id: "aptitude", title: "AI Aptitude Assessment", icon: "aptitude", description: "Personalized AI-generated aptitude test with live proctoring", unlocked: true, requirement: null, color: "#ffffff", color2: "#94a3b8", modules: ["Quantitative Aptitude", "Logical Reasoning", "Data Interpretation", "Analytical Thinking", "Pattern Recognition"] },
  { id: "gk", title: "General Knowledge", icon: "globe", description: "Current affairs, science, technology & business", unlocked: true, requirement: null, color: "#34d399", color2: "#059669", modules: ["Current Affairs", "Science", "Technology", "Computer Basics", "Business", "Geography"] },
  { id: "english", title: "English & Communication", badge: "NLP", icon: "message", description: "Grammar, vocabulary, fluency & pronunciation", unlocked: true, requirement: null, color: "#fbbf24", color2: "#d97706", modules: ["Grammar", "Vocabulary", "Reading", "Speaking", "Pronunciation", "Listening"] },
  { id: "technical", title: "Technical Interview", icon: "code", description: "AI questions from your tech stack & experience", unlocked: false, requirement: "tech_stack", color: "#f87171", color2: "#dc2626", tags: ["Python", "Java", "React", "Node", "SQL", "AWS", "ML"] },
  { id: "resume", title: "Resume Interview", icon: "resume", description: "Personalized questions from your projects & experience", unlocked: false, requirement: "resume", color: "#a78bfa", color2: "#7c3aed", tags: ["Projects", "Experience", "Skills", "Internships"] },
  { id: "coding", title: "Coding Challenge", icon: "terminal", description: "Algorithms, data structures & problem-solving", unlocked: false, requirement: "tech_stack", color: "#ec4899", color2: "#be185d", tags: ["Easy", "Medium", "Hard"] },
  { id: "hr", title: "HR Interview", icon: "handshake", description: "Self intro, career goals & situational responses", unlocked: false, requirement: "profile", color: "#06b6d4", color2: "#0891b2", tags: ["Intro", "Strengths", "Goals", "Leadership"] },
  { id: "behavioral", title: "Behavioral Interview", icon: "brain", description: "STAR method, leadership & decision-making", unlocked: false, requirement: "profile", color: "#f97316", color2: "#ea580c", tags: ["STAR", "Situational", "Leadership", "Decisions"] },
  { id: "role_specific", title: "Role-Specific", icon: "target", description: "Tailored questions for your target role", unlocked: false, requirement: "tech_stack", color: "#22d3ee", color2: "#06b6d4", tags: ["Frontend", "Backend", "Full Stack", "ML", "DevOps", "Android", "iOS"] },
  { id: "company_specific", title: "Company-Specific", icon: "building", description: "AI mimics top company interview styles", unlocked: false, requirement: "resume", color: "#64748b", color2: "#475569", tags: ["Google", "Microsoft", "Amazon", "Meta", "TCS", "Accenture"] },
  { id: "case_study", title: "Case Study", icon: "casestudy", description: "Business & technical problem-solving scenarios", unlocked: false, requirement: "profile", color: "#e11d48", color2: "#be123c", tags: ["Business", "Product", "Technical", "Problem-Solving"] },
  { id: "mixed", title: "Mixed Interview", icon: "shuffle", description: "Technical, HR, behavioral & aptitude combined", unlocked: false, requirement: "tech_stack", color: "#d946ef", color2: "#a21caf", tags: ["Technical", "HR", "Behavioral", "Aptitude", "Resume"] },
];

const ICON_MAP = {
  aptitude: IconAptitude, globe: IconGlobe, message: IconMessage,
  code: IconCode, resume: IconResume, target: IconTarget, building: IconBuilding,
  database: IconDatabase, chart: IconBarChart, play: IconPlay, brain: IconBrain,
  handshake: IconHandshake, terminal: IconTerminal,
  clipboard: IconClipboard, shuffle: IconShuffle, trending: IconTrendingUp,
  check: IconCheckCircle, lock: IconLock, arrow: IconArrowRight, star: IconStar,
  alert: IconAlertCircle, refresh: IconRefreshCw, casestudy: IconCaseStudy,
  analyze: IconAnalyze, paper: IconPaper, mic: IconMic,
};

function CatIcon({ name, size, color }) {
  const Comp = ICON_MAP[name];
  if (!Comp) return <IconBook size={size} color={color} />;
  return <Comp size={size} color={color} />;
}

function InterviewStudio() {
  const { user, emailVerified } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileData, interviewsData] = await Promise.all([
          getProfile(),
          getInterviews(),
        ]);
        setProfile(profileData?.profile || {});
        setInterviews(Array.isArray(interviewsData) ? interviewsData : []);
      } catch (err) {
        console.warn("Failed to load studio data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const displayName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? " " + profile.last_name : ""}`
    : (user?.email || "there");

  const hasResume = !!profile?.resume_url;
  const hasTechStack = (profile?.skills || []).length > 0;
  const hasProfile = !!(profile?.target_role_name || profile?.target_role_id);

  const getUnlockStatus = (category) => {
    if (category.unlocked) return "unlocked";
    if (category.requirement === "resume" && hasResume) return "unlocked";
    if (category.requirement === "tech_stack" && hasTechStack) return "unlocked";
    if (category.requirement === "profile" && hasProfile) return "unlocked";
    if (category.requirement === "advanced" && (hasTechStack || hasProfile)) return "unlocked";
    return "locked";
  };

  const completedInterviews = interviews.filter((i) => i.score != null);
  const latestInterview = interviews[0] || null;
  const averageScore = completedInterviews.length > 0
    ? Math.round(completedInterviews.reduce((s, i) => s + i.score, 0) / completedInterviews.length)
    : null;
  const readinessScore = averageScore || (hasProfile ? 45 : 15);

  const unlockedCount = CATEGORIES.filter((c) => getUnlockStatus(c) === "unlocked").length;

  // Modal states
  const [showProgressionOverlay, setShowProgressionOverlay] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalStatus, setModalStatus] = useState(null);

  const handleFeatureSubmit = async (e) => {
    e.preventDefault();
    if (!moduleName.trim()) return;
    setModalSubmitting(true);
    setModalStatus(null);
    try {
      await submitFeatureRequest({
        module_name: moduleName,
        description: moduleDesc,
      });
      setModalStatus({ success: true, msg: "Expansion module proposal registered successfully." });
      setModuleName("");
      setModuleDesc("");
      setTimeout(() => {
        setShowFeatureModal(false);
        setModalStatus(null);
      }, 2000);
    } catch (err) {
      setModalStatus({ success: false, msg: err.message || "Failed to submit request." });
    } finally {
      setModalSubmitting(false);
    }
  };

  // ─── Sparkline Coordinates Calculation ─────────────────────────────
  const sparklineData = useMemo(() => {
    const sorted = [...completedInterviews].sort((a, b) => new Date(a.created_at || a.started_at) - new Date(b.created_at || b.started_at));
    const scores = sorted.map((item) => item.score || 0);
    
    // Provide a professional fallback trendline if there is insufficient historical data
    const baseline = scores.length === 0 
      ? [15, 25, 20, 32, 28, readinessScore] 
      : scores.length === 1 
      ? [15, 25, 20, scores[0]] 
      : scores;

    const width = 140;
    const height = 36;
    const minVal = 0;
    const maxVal = 100;
    const range = maxVal - minVal;

    const coords = baseline.map((score, idx) => {
      const x = (idx / (baseline.length - 1)) * width;
      const y = height - ((score - minVal) / range) * height;
      return { x, y };
    });

    const pathD = coords.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, "");

    const fillD = pathD ? `${pathD} L ${width} ${height} L 0 ${height} Z` : "";

    return { pathD, fillD };
  }, [completedInterviews, readinessScore]);

  // ─── Chronological Progression Nodes Mapping ────────────────────────
  const progressionNodes = useMemo(() => {
    const sorted = [...completedInterviews].sort((a, b) => new Date(a.created_at || a.started_at) - new Date(b.created_at || b.started_at));
    const nodes = [];

    // Base origin checkpoint
    nodes.push({
      x: 80,
      y: 120,
      label: "Origin",
      sublabel: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Activated"
    });

    if (sorted.length === 0) {
      nodes.push({
        x: 320,
        y: 120,
        label: "Profile Setup",
        sublabel: hasProfile ? "Complete" : "Pending"
      });
      nodes.push({
        x: 560,
        y: 120,
        label: "Evaluation",
        sublabel: "Awaiting"
      });
      nodes.push({
        x: 720,
        y: 120,
        label: "Readiness Index",
        sublabel: `${readinessScore}%`
      });
    } else {
      const step = 640 / (sorted.length + 1);
      sorted.forEach((item, idx) => {
        const matchedCat = CATEGORIES.find((c) => c.id === item.category);
        nodes.push({
          x: 80 + (idx + 1) * step,
          y: 120 + (idx % 2 === 0 ? 35 : -35), // alternate y coordinates slightly to represent sine wave path
          label: matchedCat ? matchedCat.title.split(" ")[0] : "Assessment",
          sublabel: `${item.score}%`
        });
      });

      nodes.push({
        x: 720,
        y: 120,
        label: "Current Level",
        sublabel: `${readinessScore}%`
      });
    }

    return nodes;
  }, [completedInterviews, profile, hasProfile, readinessScore]);

  if (loading) {
    return (
      <div className="studio-container">
        <LoadingSpinner label="Preparing your Interview Studio" />
      </div>
    );
  }

  // Email verification gate
  if (!emailVerified) {
    return (
      <div className="studio-container">
        <div className="studio-bg-glow" />
        <div className="studio-verify-gate">
          <div className="studio-verify-gate-card">
            <div className="studio-verify-gate-icon">
              <IconMail size={40} color="#f59e0b" />
            </div>
            <h2>Account Verification Required</h2>
            <p>Verify your email before accessing Interview Studio.</p>
            <div className="studio-verify-gate-actions">
              <button className="studio-verify-gate-btn" onClick={() => navigate("/profile#verification")}>
                Go to Verification
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-container">
      <div className="studio-bg-glow" />

      <div className="studio-header">
        <div className="studio-greeting">
          <h1>Welcome back, {displayName}!</h1>
          <p>Ready to ace your next interview?</p>
        </div>
      </div>

      <div className="studio-bento-grid">
        {/* Card 1: Assessment History (Routing) */}
        <div className="bento-card" onClick={() => navigate("/aptitude/history")}>
          <div className="bento-header">
            <span className="bento-title">Assessment Port</span>
            <div className="bento-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.42" />
              </svg>
            </div>
          </div>
          <div className="bento-body" style={{ marginBottom: 0 }}>
            <div className="bento-value" style={{ fontSize: '18px' }}>Assessment Logs</div>
          </div>
        </div>

        {/* Card 2: Progression (Overlay) */}
        <div className="bento-card" onClick={() => setShowProgressionOverlay(true)}>
          <div className="bento-header">
            <span className="bento-title">Progression Path</span>
            <div className="bento-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>
          <div className="bento-body" style={{ marginBottom: 0 }}>
            <div className="bento-value" style={{ fontSize: '18px' }}>Journey Path</div>
          </div>
        </div>

        {/* Card 3: Competency Index (Telemetry) */}
        <div className="bento-card">
          <div className="bento-header">
            <span className="bento-title">Competency Index</span>
            <div className="bento-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
          </div>
          <div className="bento-body" style={{ marginBottom: 0 }}>
            <div className="bento-value" style={{ fontSize: '18px' }}>Readiness: {readinessScore}%</div>
            
            {/* Sparkline trendline */}
            <div className="sparkline-container" style={{ height: '24px', marginTop: '6px' }}>
              <svg width="100%" height="100%" viewBox="0 0 140 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#66FCF1" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <linearGradient id="sparklineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#66FCF1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#66FCF1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparklineData.fillD} fill="url(#sparklineAreaGrad)" stroke="none" />
                <path d={sparklineData.pathD} fill="none" stroke="url(#sparklineGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Feature Request (Full-Stack Modal) */}
        <div className="bento-card" onClick={() => setShowFeatureModal(true)}>
          <div className="bento-header">
            <span className="bento-title">Expansion Deck</span>
            <div className="bento-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
          <div className="bento-body" style={{ marginBottom: 0 }}>
            <div className="bento-value" style={{ fontSize: '18px' }}>Propose Module</div>
          </div>
        </div>
      </div>

      <div className="studio-section">
        <div className="studio-section-header">
          <h2>Interview Categories</h2>
          <span className="studio-section-badge">{unlockedCount} of {CATEGORIES.length} unlocked</span>
        </div>
        <div className="studio-categories-grid">
          {CATEGORIES.map((cat) => {
            const status = getUnlockStatus(cat);
            const isLocked = status === "locked";
            return (
              <div
                key={cat.id}
                className={`studio-category-card ${isLocked ? "locked" : ""}`}
                style={{
                  "--cat-color-1": cat.color,
                  "--cat-color-2": cat.color2 || cat.color
                }}
                onClick={() => {
                  if (!isLocked) {
                    if (cat.id === "aptitude") navigate("/aptitude");
                    else if (cat.id === "gk") navigate("/aptitude?type=general_knowledge");
                    else if (cat.id === "english") navigate("/english");
                    else navigate(`/studio/${cat.id}`);
                  }
                }}
              >
                <div className="cat-accent-bar" />
                {isLocked && <div className="cat-lock-overlay"><span className="cat-lock-icon"><IconLock size={28} color="#94a3b8" /></span></div>}
                <div className="cat-icon-wrapper">
                  <CatIcon name={cat.icon} size={22} color={cat.color} />
                </div>
                <div className="cat-title-row">
                  <h3 className="cat-title">{cat.title}</h3>
                  {cat.badge && <span className="cat-badge">{cat.badge}</span>}
                </div>
                <p className="cat-desc">{cat.description}</p>
                {cat.tags && (
                  <div className="cat-tags">
                    {cat.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="cat-tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="cat-action">
                  {isLocked ? (
                    <span className="cat-lock-req">
                      {cat.requirement === "resume" && "Upload resume to unlock"}
                      {cat.requirement === "tech_stack" && "Add skills to unlock"}
                      {cat.requirement === "profile" && "Complete profile to unlock"}
                      {cat.requirement === "advanced" && "Experience > 2 years"}
                    </span>
                  ) : (
                    <span className="cat-start">Begin <IconArrowRight size={14} color={cat.color} /></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {completedInterviews.length > 0 && (
        <>
          <div className="studio-section">
            <div className="studio-section-header">
              <h2>Performance Snapshot</h2>
            </div>
            <div className="studio-performance">
              <div className="perf-card">
                <div className="perf-value">{completedInterviews.length}</div>
                <div className="perf-label">Completed</div>
              </div>
              <div className="perf-card">
                <div className="perf-value" style={{ color: averageScore >= 70 ? "var(--success)" : averageScore >= 40 ? "var(--warning)" : "var(--danger)" }}>
                  {averageScore}%
                </div>
                <div className="perf-label">Avg Score</div>
              </div>
              <div className="perf-card">
                <div className="perf-value">{Math.max(...completedInterviews.map((i) => i.score))}%</div>
                <div className="perf-label">Best Score</div>
              </div>
            </div>
          </div>

          <div className="studio-section">
            <div className="studio-section-header">
              <h2>Recent Activity</h2>
              <button className="studio-view-all" onClick={() => navigate("/dashboard")}>View All</button>
            </div>
            <div className="studio-activity-list">
              {interviews.slice(0, 5).map((session) => (
                <div key={session.id} className="activity-item" onClick={() => navigate(`/interviews/${session.id}`)}>
                  <div className="activity-icon">
                    {session.score != null
                      ? <IconCheckCircle size={20} color="#34d399" />
                      : <IconClock size={20} color="#94a3b8" />
                    }
                  </div>
                  <div className="activity-info">
                    <div className="activity-title">{session.category ? CATEGORIES.find(c => c.id === session.category)?.title || "Interview" : "Practice Session"}</div>
                    <div className="activity-date">{session.created_at ? new Date(session.created_at).toLocaleDateString() : "Recently"}</div>
                  </div>
                  <div className="activity-score">{session.score != null ? `${session.score}%` : "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!hasProfile && (
        <div className="studio-setup-cta">
          <div className="setup-content">
            <h3>Complete Your Profile</h3>
            <p>Set up your target role, skills, and experience to unlock all 15 interview categories.</p>
            <div className="setup-steps">
              <div className={`setup-step ${hasProfile ? "done" : ""}`}>
                <span className="setup-step-icon">{hasProfile ? <IconCheckCircle size={16} color="#34d399" /> : <IconAlertCircle size={16} color="#64748b" />}</span>
                <span>Target Role & Skills</span>
              </div>
              <div className={`setup-step ${hasTechStack ? "done" : ""}`}>
                <span className="setup-step-icon">{hasTechStack ? <IconCheckCircle size={16} color="#34d399" /> : <IconAlertCircle size={16} color="#64748b" />}</span>
                <span>Tech Stack</span>
              </div>
              <div className={`setup-step ${hasResume ? "done" : ""}`}>
                <span className="setup-step-icon">{hasResume ? <IconCheckCircle size={16} color="#34d399" /> : <IconAlertCircle size={16} color="#64748b" />}</span>
                <span>Upload Resume</span>
              </div>
            </div>
            <button className="studio-cta-btn" onClick={() => navigate("/profile")}>
              Complete Profile
            </button>
          </div>
        </div>
      )}

      {/* Progression Path Fullscreen Overlay */}
      {showProgressionOverlay && createPortal(
        <div className="fullscreen-overlay" onClick={() => setShowProgressionOverlay(false)}>
          <div className="overlay-container" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-header">
              <h2 className="overlay-title">Chronological Progression Path</h2>
              <button className="overlay-close-btn" onClick={() => setShowProgressionOverlay(false)}>×</button>
            </div>
            
            <p className="bento-desc" style={{ fontSize: '13px', margin: 0 }}>
              Chronological layout of your completed mock interviews and milestones. Hover over checkpoints to read details.
            </p>

            <div className="node-graph-wrapper">
              <svg viewBox="0 0 800 240" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#66FCF1" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Draw connection paths */}
                {progressionNodes.length > 1 && (
                  <path
                    d={progressionNodes.reduce((acc, n, idx) => {
                      if (idx === 0) return `M ${n.x} ${n.y}`;
                      return `${acc} C ${(progressionNodes[idx-1].x + n.x)/2} ${progressionNodes[idx-1].y}, ${(progressionNodes[idx-1].x + n.x)/2} ${n.y}, ${n.x} ${n.y}`;
                    }, "")}
                    fill="none"
                    stroke="url(#nodeGrad)"
                    strokeWidth="3"
                    filter="url(#glow)"
                  />
                )}

                {/* Draw Nodes */}
                {progressionNodes.map((n, idx) => (
                  <g key={idx} className="graph-node-group" style={{ cursor: 'pointer' }}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r="12"
                      fill="#0B0C10"
                      stroke={idx === 0 ? "#66FCF1" : idx === progressionNodes.length - 1 ? "#d946ef" : "#a78bfa"}
                      strokeWidth="3"
                      filter="url(#glow)"
                    />
                    <circle cx={n.x} cy={n.y} r="4" fill={idx === 0 ? "#66FCF1" : idx === progressionNodes.length - 1 ? "#d946ef" : "#a78bfa"} />
                    
                    {/* Node text tags */}
                    <text
                      x={n.x}
                      y={n.y - 20}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >
                      {n.label}
                    </text>
                    
                    <text
                      x={n.x}
                      y={n.y + 24}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                    >
                      {n.sublabel}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowProgressionOverlay(false)}>Close Path View</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Feature Request Modal */}
      {showFeatureModal && createPortal(
        <div className="glass-modal-backdrop" onClick={() => setShowFeatureModal(false)}>
          <div className="glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-header" style={{ marginBottom: '20px' }}>
              <h2 className="overlay-title" style={{ fontSize: '18px' }}>Propose Expansion Module</h2>
              <button className="overlay-close-btn" onClick={() => setShowFeatureModal(false)}>×</button>
            </div>

            <form onSubmit={handleFeatureSubmit}>
              <div className="form-group">
                <label>Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Advanced DevOps, Rust Challenging, etc."
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Requirements & Description</label>
                <textarea
                  rows="4"
                  placeholder="Describe target interview questions, difficulty, or desired AI scoring criteria."
                  value={moduleDesc}
                  onChange={(e) => setModuleDesc(e.target.value)}
                  className="form-input"
                  style={{ resize: 'none' }}
                />
                <p className="form-disclaimer">
                  Note: Module additions are driven by general demand. Submission does not guarantee implementation.
                </p>
              </div>

              {modalStatus && (
                <div style={{
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginTop: '12px',
                  background: modalStatus.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: modalStatus.success ? '#34d399' : '#f87171',
                  border: `1px solid ${modalStatus.success ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                  {modalStatus.msg}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowFeatureModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={modalSubmitting}>
                  {modalSubmitting ? "Submitting..." : "Submit Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function IconClock({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default InterviewStudio;
