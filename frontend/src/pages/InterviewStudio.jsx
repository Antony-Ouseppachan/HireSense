import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile, getInterviews } from "../services/apiService";
import {
  IconAptitude, IconGlobe, IconMessage, IconCode,
  IconResume, IconTarget, IconBuilding, IconDatabase, IconBarChart,
  IconPlay, IconBrain, IconHandshake, IconTerminal,
  IconClipboard, IconShuffle, IconTrendingUp, IconCheckCircle,
  IconLock, IconArrowRight, IconStar, IconAlertCircle, IconRefreshCw,
  IconCaseStudy, IconAnalyze, IconPaper, IconMic, IconBook,
} from "../components/Icons";
import "../styles/InterviewStudio.css";

const CATEGORIES = [
  { id: "aptitude", title: "Aptitude Tests", icon: "aptitude", description: "Quantitative, logical reasoning & data interpretation", unlocked: true, requirement: null, color: "#38bdf8", modules: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Data Interpretation", "Analytical Reasoning"] },
  { id: "gk", title: "General Knowledge", icon: "globe", description: "Current affairs, science, technology & business", unlocked: true, requirement: null, color: "#34d399", modules: ["Current Affairs", "Science", "Technology", "Computer Basics", "Business", "Geography"] },
  { id: "english", title: "English & Communication", icon: "message", description: "Grammar, vocabulary, fluency & pronunciation", unlocked: true, requirement: null, color: "#fbbf24", modules: ["Grammar", "Vocabulary", "Reading", "Speaking", "Pronunciation", "Listening"] },
  { id: "technical", title: "Technical Interview", icon: "code", description: "AI questions from your tech stack & experience", unlocked: false, requirement: "tech_stack", color: "#f87171", tags: ["Python", "Java", "React", "Node", "SQL", "AWS", "ML"] },
  { id: "resume", title: "Resume Interview", icon: "resume", description: "Personalized questions from your projects & experience", unlocked: false, requirement: "resume", color: "#a78bfa", tags: ["Projects", "Experience", "Skills", "Internships"] },
  { id: "coding", title: "Coding Challenge", icon: "terminal", description: "Algorithms, data structures & problem-solving", unlocked: false, requirement: "tech_stack", color: "#ec4899", tags: ["Easy", "Medium", "Hard"] },
  { id: "hr", title: "HR Interview", icon: "handshake", description: "Self intro, career goals & situational responses", unlocked: false, requirement: "profile", color: "#06b6d4", tags: ["Intro", "Strengths", "Goals", "Leadership"] },
  { id: "behavioral", title: "Behavioral Interview", icon: "brain", description: "STAR method, leadership & decision-making", unlocked: false, requirement: "profile", color: "#f97316", tags: ["STAR", "Situational", "Leadership", "Decisions"] },
  { id: "role_specific", title: "Role-Specific", icon: "target", description: "Tailored questions for your target role", unlocked: false, requirement: "tech_stack", color: "#22d3ee", tags: ["Frontend", "Backend", "Full Stack", "ML", "DevOps", "Android", "iOS"] },
  { id: "company_specific", title: "Company-Specific", icon: "building", description: "AI mimics top company interview styles", unlocked: false, requirement: "resume", color: "#64748b", tags: ["Google", "Microsoft", "Amazon", "Meta", "TCS", "Accenture"] },
  { id: "system_design", title: "System Design", icon: "database", description: "Scalability, caching, microservices & APIs", unlocked: false, requirement: "advanced", color: "#8b5cf6", tags: ["Scalability", "Caching", "Load Balancing", "Microservices"] },
  { id: "domain_knowledge", title: "Domain Knowledge", icon: "analyze", description: "Healthcare, finance, AI, cloud & more", unlocked: false, requirement: "profile", color: "#14b8a6", tags: ["Healthcare", "Finance", "AI", "Cloud", "Cybersecurity"] },
  { id: "case_study", title: "Case Study", icon: "casestudy", description: "Business & technical problem-solving scenarios", unlocked: false, requirement: "profile", color: "#e11d48", tags: ["Business", "Product", "Technical", "Problem-Solving"] },
  { id: "voice", title: "AI Voice Interview", icon: "mic", description: "Speech recognition, pace & confidence analysis", unlocked: false, requirement: "profile", color: "#0ea5e9", tags: ["Speech", "Pace", "Confidence", "Fillers"] },
  { id: "mixed", title: "Mixed Interview", icon: "shuffle", description: "Technical, HR, behavioral & aptitude combined", unlocked: false, requirement: "tech_stack", color: "#d946ef", tags: ["Technical", "HR", "Behavioral", "Aptitude", "Resume"] },
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
  const { user } = useAuth();
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

  const displayName = user?.email?.split("@")[0] || "there";

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

  if (loading) {
    return (
      <div className="studio-container">
        <div className="studio-loading">
          <div className="studio-loading-spinner" />
          <p>Preparing your Interview Studio...</p>
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

      <div className="studio-quick-stats">
        <div className="qs-card" onClick={() => latestInterview && navigate(`/interviews/${latestInterview.id}`)} style={{ cursor: latestInterview ? "pointer" : "default" }}>
          <div className="qs-icon"><IconPlay size={22} color="#38bdf8" /></div>
          <div className="qs-content">
            <div className="qs-label">{latestInterview && latestInterview.score == null ? "Continue Last Interview" : "Start New Interview"}</div>
            <div className="qs-desc">{latestInterview ? "Pick up where you left off" : "Begin your first session"}</div>
          </div>
        </div>
        <div className="qs-card">
          <div className="qs-icon"><IconStar size={22} color="#fbbf24" /></div>
          <div className="qs-content">
            <div className="qs-label">Today's Recommendation</div>
            <div className="qs-desc">{unlockedCount > 0 ? `${CATEGORIES.find((c) => getUnlockStatus(c) === "unlocked")?.title || "Explore categories below"}` : "Complete your profile"}</div>
          </div>
        </div>
        <div className="qs-card">
          <div className="qs-icon"><IconTrendingUp size={22} color="#34d399" /></div>
          <div className="qs-content">
            <div className="qs-label">Readiness Score</div>
            <div className="qs-score-value">{readinessScore}%</div>
            <div className="qs-score-bar">
              <div className="qs-score-fill" style={{ width: `${readinessScore}%` }} />
            </div>
          </div>
        </div>
        <div className="qs-card">
          <div className="qs-icon"><IconTarget size={22} color="#a78bfa" /></div>
          <div className="qs-content">
            <div className="qs-label">Upcoming Goals</div>
            <div className="qs-desc">{completedInterviews.length < 3 ? `Complete ${3 - completedInterviews.length} more interview${completedInterviews.length < 2 ? "s" : ""}` : "Great progress! Try a new category."}</div>
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
                style={{ "--cat-color": cat.color }}
                onClick={() => {
                  if (!isLocked) navigate(`/studio/${cat.id}`);
                }}
              >
                <div className="cat-accent-bar" />
                {isLocked && <div className="cat-lock-overlay"><span className="cat-lock-icon"><IconLock size={28} color="#94a3b8" /></span></div>}
                <div className="cat-icon-wrapper">
                  <CatIcon name={cat.icon} size={22} color={cat.color} />
                </div>
                <h3 className="cat-title">{cat.title}</h3>
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
