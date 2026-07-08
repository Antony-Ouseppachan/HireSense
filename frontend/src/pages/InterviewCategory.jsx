import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProfile, startMockInterview } from "../services/apiService";
import {
  IconBook, IconGlobe, IconMessage, IconCode, IconUser,
  IconTarget, IconBuilding, IconLayout, IconBarChart,
  IconBrain, IconHandshake, IconTerminal, IconClipboard,
  IconShuffle, IconArrowLeft, IconStar, IconTrendingUp,
  IconLightbulb, IconCheckCircle, IconAlertCircle, IconClock, IconArrowRight,
} from "../components/Icons";
import "../styles/InterviewCategory.css";

const CATEGORY_CONFIG = {
  aptitude: {
    title: "Aptitude Tests", icon: "book", color: "#38bdf8",
    description: "Practice quantitative aptitude, logical reasoning, and data interpretation questions.",
    difficulties: ["Beginner", "Intermediate", "Advanced"],
    durations: [10, 20, 30, 60], modes: ["Practice", "Timed Exam"],
    longDesc: "Master placement aptitude tests with questions covering quantitative aptitude, logical reasoning, verbal ability, data interpretation, and analytical reasoning.",
  },
  gk: {
    title: "General Knowledge", icon: "globe", color: "#34d399",
    description: "Test your knowledge of current affairs, science, technology, and business.",
    difficulties: ["Beginner", "Intermediate", "Advanced"],
    durations: [10, 20, 30], modes: ["Practice", "Timed Exam"],
    longDesc: "Stay ahead with questions on current affairs, science, technology, computer basics, business, and geography.",
  },
  english: {
    title: "English & Communication", icon: "message", color: "#fbbf24",
    description: "Improve grammar, vocabulary, speaking fluency, and pronunciation.",
    difficulties: ["Beginner", "Intermediate", "Advanced"],
    durations: [10, 20, 30], modes: ["Practice", "Timed Exam"],
    longDesc: "AI evaluates your fluency, pronunciation, confidence, and grammar across speaking, reading, and listening exercises.",
  },
  technical: {
    title: "Technical Interview", icon: "code", color: "#f87171",
    description: "AI generates questions from your tech stack and experience level.",
    difficulties: ["Easy", "Medium", "Hard", "Adaptive"],
    durations: [20, 30, 45, 60], modes: ["Practice", "Exam", "Voice", "Adaptive AI"],
    longDesc: "Questions generated from your languages, frameworks, databases, cloud, and AI expertise.",
  },
  resume: {
    title: "Resume Interview", icon: "user", color: "#a78bfa",
    description: "Personalized questions based on your projects, experience, and internships.",
    difficulties: ["Easy", "Medium", "Hard"],
    durations: [20, 30, 45], modes: ["Practice", "Exam", "Voice"],
    longDesc: "AI parses your resume and creates completely personalized questions about your specific projects, experience, and achievements.",
  },
  coding: {
    title: "Coding Challenge", icon: "terminal", color: "#ec4899",
    description: "Solve problems with hidden test cases and AI-powered hints.",
    difficulties: ["Easy", "Medium", "Hard"],
    durations: [30, 45, 60], modes: ["Practice", "Timed Exam"],
    longDesc: "Coding editor with hidden test cases, time limits, complexity analysis, AI hints, and code review.",
  },
  hr: {
    title: "HR Interview", icon: "handshake", color: "#06b6d4",
    description: "Practice self-introduction, career goals, and situational responses.",
    difficulties: ["Easy", "Medium", "Hard"],
    durations: [15, 20, 30], modes: ["Practice", "Exam", "Voice"],
    longDesc: "Covering self introduction, strengths, weaknesses, career goals, salary expectations, teamwork, and leadership.",
  },
  behavioral: {
    title: "Behavioral Interview", icon: "brain", color: "#f97316",
    description: "STAR method questions on leadership, decisions, and communication.",
    difficulties: ["Easy", "Medium", "Hard"],
    durations: [20, 30, 45], modes: ["Practice", "Exam", "Voice"],
    longDesc: "Master the STAR method with situational questions on leadership, decision making, pressure handling, and communication.",
  },
  role_specific: {
    title: "Role-Specific Interview", icon: "target", color: "#22d3ee",
    description: "Questions tailored to your desired role.",
    difficulties: ["Easy", "Medium", "Hard", "Expert"],
    durations: [20, 30, 45, 60], modes: ["Practice", "Exam", "Voice", "Adaptive AI"],
    longDesc: "Role-specific questions for Frontend, Backend, Full Stack, ML Engineer, Data Scientist, DevOps, and more.",
  },
  company_specific: {
    title: "Company-Specific Interview", icon: "building", color: "#64748b",
    description: "AI mimics the interview style of specific companies.",
    difficulties: ["Medium", "Hard", "Expert"],
    durations: [30, 45, 60], modes: ["Practice", "Exam"],
    longDesc: "AI mimics interview styles of Google, Microsoft, Amazon, Meta, Netflix, Adobe, TCS, Accenture, and more.",
  },
  system_design: {
    title: "System Design", icon: "layout", color: "#8b5cf6",
    description: "Scalability, caching, load balancing, and architecture design.",
    difficulties: ["Medium", "Hard", "Expert"],
    durations: [30, 45, 60, 90], modes: ["Practice", "Exam"],
    longDesc: "Advanced topics including scalability, caching, load balancing, databases, microservices, API design, and architecture.",
  },
  domain_knowledge: {
    title: "Domain Knowledge", icon: "book", color: "#14b8a6",
    description: "Healthcare, finance, retail, AI, and more.",
    difficulties: ["Beginner", "Intermediate", "Advanced"],
    durations: [20, 30, 45], modes: ["Practice", "Exam", "Adaptive AI"],
    longDesc: "Test your expertise in Healthcare, Finance, Retail, Agriculture, Education, Cloud, Cybersecurity, AI, and IoT.",
  },
  case_study: {
    title: "Case Study Interview", icon: "clipboard", color: "#e11d48",
    description: "Business, product, and technical problem-solving.",
    difficulties: ["Medium", "Hard", "Expert"],
    durations: [30, 45, 60], modes: ["Practice", "Exam"],
    longDesc: "Work through business scenarios, product scenarios, technical scenarios, and problem-solving exercises.",
  },
  voice: {
    title: "AI Voice Interview", icon: "message", color: "#0ea5e9",
    description: "Realistic voice interview with speech analysis.",
    difficulties: ["Easy", "Medium", "Hard"],
    durations: [15, 20, 30], modes: ["Voice Only", "Avatar Mode"],
    longDesc: "Speech recognition analyzes your speaking pace, confidence, filler words, and communication skills for an almost-real interview experience.",
  },
  mixed: {
    title: "Mixed Interview", icon: "shuffle", color: "#d946ef",
    description: "Combination of all interview types in one session.",
    difficulties: ["Easy", "Medium", "Hard", "Adaptive"],
    durations: [30, 45, 60], modes: ["Practice", "Exam", "Adaptive AI"],
    longDesc: "A comprehensive mix of technical, HR, behavioral, aptitude, resume, and coding questions in a single session.",
  },
};

const ICON_MAP = {
  book: IconBook, globe: IconGlobe, message: IconMessage, code: IconCode,
  user: IconUser, target: IconTarget, building: IconBuilding,
  layout: IconLayout, brain: IconBrain, handshake: IconHandshake,
  terminal: IconTerminal, clipboard: IconClipboard, shuffle: IconShuffle,
};

const MODE_ICONS = {
  Practice: IconStar, "Timed Exam": IconClock, Exam: IconClock,
  Voice: IconMessage, "Voice Only": IconMessage, "Avatar Mode": IconUser,
  "Adaptive AI": IconBrain, "Adaptive": IconRefreshCw,
};

function CatIcon({ name, size = 24, color }) {
  const Comp = ICON_MAP[name];
  if (!Comp) return <IconBook size={size} color={color} />;
  return <Comp size={size} color={color} />;
}

function ModeIcon({ mode, size = 14, color = "currentColor" }) {
  const Comp = MODE_ICONS[mode];
  if (!Comp) return <IconStar size={size} color={color} />;
  return <Comp size={size} color={color} />;
}

function IconRefreshCw({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function InterviewCategory() {
  const { categoryId: type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [difficulty, setDifficulty] = useState("");
  const [duration, setDuration] = useState("");
  const [mode, setMode] = useState("");
  const [starting, setStarting] = useState(false);

  const config = CATEGORY_CONFIG[type];

  useEffect(() => {
    getProfile().then(d => setProfile(d?.profile || {})).catch(() => {});
  }, []);

  const canStart = difficulty && duration && mode;

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      const session = await startMockInterview({
        profile: profile || {},
        category: type,
        difficulty,
        duration,
        mode,
      });
      if (session?.id) {
        navigate(`/interviews/${session.id}`);
      }
    } catch (err) {
      console.error("Failed to start interview:", err);
    } finally {
      setStarting(false);
    }
  };

  if (!config) {
    return (
      <div className="cat-page-container">
        <div className="cat-not-found">
          <IconSearch size={48} color="#64748b" />
          <h2>Category Not Found</h2>
          <p>The interview category you're looking for doesn't exist.</p>
          <button className="studio-cta-btn" onClick={() => navigate("/studio")}>
            Back to Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-page-container">
      <div className="cat-bg-glow" style={{ "--cat-color": config.color }} />

      <div className="cat-header-section">
        <button className="cat-back-btn" onClick={() => navigate("/studio")}>
          <IconArrowLeft size={16} color="#94a3b8" /> Back to Studio
        </button>
        <div className="cat-title-section">
          <span className="cat-page-icon" style={{ background: `${config.color}22` }}>
            <CatIcon name={config.icon} size={32} color={config.color} />
          </span>
          <div>
            <h1>{config.title}</h1>
            <p>{config.longDesc}</p>
          </div>
        </div>
      </div>

      <div className="cat-config-section">
        <div className="cat-config-card">
          <h3>Interview Settings</h3>
          <p className="cat-config-hint">Configure your interview preferences below</p>

          <div className="cat-config-group">
            <label>Difficulty Level</label>
            <div className="cat-option-grid">
              {config.difficulties.map((d) => (
                <button
                  key={d}
                  className={`cat-option-btn ${difficulty === d ? "active" : ""}`}
                  style={difficulty === d ? { borderColor: config.color, background: `${config.color}22` } : {}}
                  onClick={() => setDifficulty(d)}
                >
                  {d === "Expert" ? <IconStar size={13} color={difficulty === d ? config.color : undefined} />
                    : d === "Adaptive" || d === "Adaptive AI" ? <IconRefreshCw size={13} color={difficulty === d ? config.color : undefined} />
                    : d === "Hard" ? <IconAlertCircle size={13} color={difficulty === d ? config.color : undefined} />
                    : d === "Medium" ? <IconBarChart size={13} color={difficulty === d ? config.color : undefined} />
                    : <IconCheckCircle size={13} color={difficulty === d ? config.color : undefined} />
                  } {d}
                </button>
              ))}
            </div>
          </div>

          <div className="cat-config-group">
            <label>Duration</label>
            <div className="cat-option-grid">
              {config.durations.map((d) => (
                <button
                  key={d}
                  className={`cat-option-btn ${duration === d ? "active" : ""}`}
                  style={duration === d ? { borderColor: config.color, background: `${config.color}22` } : {}}
                  onClick={() => setDuration(d)}
                >
                  <IconClock size={13} color={duration === d ? config.color : undefined} /> {d} min{d > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="cat-config-group">
            <label>Mode</label>
            <div className="cat-option-grid">
              {config.modes.map((m) => (
                <button
                  key={m}
                  className={`cat-option-btn ${mode === m ? "active" : ""}`}
                  style={mode === m ? { borderColor: config.color, background: `${config.color}22` } : {}}
                  onClick={() => setMode(m)}
                >
                  <ModeIcon mode={m} size={13} color={mode === m ? config.color : undefined} /> {m}
                </button>
              ))}
            </div>
          </div>

          <button
            className={`cat-start-btn ${!canStart || starting ? "disabled" : ""}`}
            style={canStart && !starting ? { background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)` } : {}}
            onClick={handleStart}
            disabled={!canStart || starting}
          >
            {starting ? "Starting..." : `Begin ${config.title}`}
          </button>
        </div>

        <div className="cat-info-section">
          <div className="cat-info-card">
            <h4>What to Expect</h4>
            <ul className="cat-expect-list">
              <li><IconTarget size={14} color="#38bdf8" /> Questions tailored to your profile</li>
              <li><IconBarChart size={14} color="#34d399" /> AI-powered evaluation after completion</li>
              <li><IconLightbulb size={14} color="#fbbf24" /> Detailed feedback on each answer</li>
              <li><IconTrendingUp size={14} color="#a78bfa" /> Score tracking across all sessions</li>
            </ul>
          </div>

          <div className="cat-info-card">
            <h4>Tips for Success</h4>
            <ul className="cat-expect-list">
              <li><IconBook size={14} color="#38bdf8" /> Be specific with real examples</li>
              <li><IconClock size={14} color="#fbbf24" /> Manage your time wisely</li>
              <li><IconRefreshCw size={14} color="#34d399" /> Review past sessions to improve</li>
              <li><IconMessage size={14} color="#a78bfa" /> Practice out loud for voice modes</li>
            </ul>
          </div>

          {profile && (
            <div className="cat-info-card">
              <h4>Your Profile</h4>
              <div className="cat-profile-summary">
                {(profile.target_role_name || profile.target_role_id) && <div><span>Role:</span> {profile.target_role_name || profile.target_role_id}</div>}
                {(profile.skills || []).length > 0 && <div><span>Skills:</span> {profile.skills.map(s => s.name || s).join(", ")}</div>}
                {profile.experience_level && <div><span>Experience:</span> {profile.experience_level}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconSearch({ size = 48, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default InterviewCategory;
