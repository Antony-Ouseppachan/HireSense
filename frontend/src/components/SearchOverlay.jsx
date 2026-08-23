import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "../context/SearchContext";
import { useAuth } from "../context/AuthContext";
import "../styles/SearchOverlay.css";

const SITE_MAP = [
  // General Site Pages
  { label: "Dashboard", description: "Your mission control & overview", link: "/dashboard", icon: "home", tags: ["home", "dashboard", "overview", "dash", "main", "control"] },
  { label: "AI Interview Studio", description: "Start an AI-powered interview session", link: "/interviews", icon: "play", tags: ["interview", "ai", "studio", "start", "begin", "session", "mock", "practice"] },
  { label: "Profile", description: "Edit your personal details, skills & education", link: "/profile", icon: "user", tags: ["profile", "account", "edit", "info", "details", "skills", "education", "cv"] },
  { label: "Resume Management", description: "Upload or manage your resume / CV", link: "/profile", icon: "file", tags: ["resume", "cv", "upload", "document", "file", "manage"] },
  { label: "Integrity Shield", description: "View your trust & honesty score", link: "/dashboard", icon: "shield", tags: ["integrity", "shield", "trust", "score", "honesty", "cheat", "proctoring"] },
  { label: "Logout", description: "Sign out of your account", link: "/logout", icon: "logout", tags: ["logout", "signout", "exit", "sign out"], action: "logout" },

  // Interview Studio Categories (Direct Navigation)
  { label: "AI Aptitude Assessment", description: "Personalized AI-generated aptitude test with live proctoring", link: "/aptitude", icon: "brain", tags: ["apt", "aptitude", "test", "quiz", "quant", "logical", "math", "reasoning", "exam"] },
  { label: "General Knowledge Assessment", description: "Current affairs, science, technology & business quiz", link: "/aptitude?type=general_knowledge", icon: "globe", tags: ["gk", "general", "knowledge", "science", "business", "current affairs", "world", "exam"] },
  { label: "English & Communication Interview", description: "Grammar, vocabulary, fluency & pronunciation prep", link: "/english", icon: "message", tags: ["english", "communication", "grammar", "speech", "vocabulary", "fluency", "pronunciation", "speaking", "listening"] },
  { label: "Technical Interview Preparation", description: "AI questions from your tech stack & experience", link: "/studio/technical", icon: "code", tags: ["tech", "technical", "interview", "coding", "programming", "developer", "skills"] },
  { label: "Resume Interview Preparation", description: "Personalized questions from your projects & experience", link: "/studio/resume", icon: "resume", tags: ["resume", "projects", "experience", "work", "cv", "background"] },
  { label: "Coding Challenge Studio", description: "Algorithms, data structures & problem-solving practice", link: "/studio/coding", icon: "terminal", tags: ["code", "coding", "challenge", "algorithms", "dsa", "leetcode", "problem solving"] },
  { label: "HR Interview Practice", description: "Self introduction, career goals & situational responses", link: "/studio/hr", icon: "handshake", tags: ["hr", "behavioral", "personal", "intro", "goals", "salary", "fit", "culture"] },
  { label: "Behavioral Interview Studio", description: "STAR method preparation, leadership & decision-making", link: "/studio/behavioral", icon: "brain", tags: ["behavioral", "star", "situational", "leadership", "decisions", "conflict"] },
  { label: "Role-Specific Preparation", description: "Tailored questions for your target professional role", link: "/studio/role_specific", icon: "target", tags: ["role", "frontend", "backend", "full stack", "devops", "android", "ios", "qa"] },
  { label: "Company-Specific Interview Simulation", description: "AI mimics Google, Microsoft, Amazon & Meta styles", link: "/studio/company_specific", icon: "building", tags: ["company", "google", "microsoft", "amazon", "meta", "tcs", "accenture", "interview"] },
  { label: "System Design Studio", description: "Scalability, caching, microservices & database design", link: "/studio/system_design", icon: "database", tags: ["system", "design", "scale", "scalability", "microservices", "caching", "architecture", "apis"] },
  { label: "Domain Knowledge Interview", description: "Specialized cloud, cybersecurity, finance & healthcare scenarios", link: "/studio/domain_knowledge", icon: "analyze", tags: ["domain", "cloud", "security", "cybersecurity", "finance", "healthcare", "business"] },
  { label: "Case Study Practice", description: "Business & technical problem-solving scenarios", link: "/studio/case_study", icon: "casestudy", tags: ["case", "study", "business", "problem solving", "product", "consulting"] },
  { label: "AI Voice Interview Studio", description: "Speech recognition, pacing & confidence analyzer", link: "/studio/voice", icon: "mic", tags: ["voice", "speech", "speaking", "audio", "pace", "confidence", "pronunciation"] },
  { label: "Mixed Interview Studio", description: "Technical, HR, behavioral & aptitude combined simulation", link: "/studio/mixed", icon: "shuffle", tags: ["mixed", "combined", "all", "general", "full", "practice"] },
];

const ICON_MAP = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4a4 4 0 0 1 4 4c0 2-1 3-2 4a3 3 0 0 1-2 3 3 3 0 0 1-2-3c-1-1-2-2-2-4a4 4 0 0 1 4-4z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.42" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  resume: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  handshake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  analyze: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  ),
  casestudy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M7 10l3 3 7-7" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  shuffle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-item-icon-svg" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  ),
};


function scoreItem(item, q) {
  let score = 0;
  const label = item.label.toLowerCase();
  const desc = item.description.toLowerCase();

  // 1. Exact label match
  if (label === q) {
    score += 1000;
  }
  // 2. Starts with label
  else if (label.startsWith(q)) {
    score += 500;
  }

  // 3. Word starts with match
  const labelWords = label.split(/\s+/);
  const wordStartMatch = labelWords.some((word) => word.startsWith(q));
  if (wordStartMatch) {
    score += 300;
  }

  // 4. Substring label match
  if (label.includes(q)) {
    score += 200;
  }

  // 5. Tags matching
  item.tags.forEach((tag) => {
    const t = tag.toLowerCase();
    if (t === q) {
      score += 150;
    } else if (t.startsWith(q)) {
      score += 100;
    } else if (t.includes(q)) {
      score += 50;
    }
  });

  // 6. Description match
  if (desc.includes(q)) {
    score += 40;
  }

  // 7. Fuzzy matching: query characters appear in order in the label
  let queryIdx = 0;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === q[queryIdx]) {
      queryIdx++;
      if (queryIdx === q.length) {
        score += 10;
        break;
      }
    }
  }

  return score;
}

function searchSite(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return SITE_MAP;
  }
  return SITE_MAP.map((item) => ({ ...item, _score: scoreItem(item, q) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);
}

export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useSearch();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  const isMac = typeof window !== "undefined" && navigator.userAgent.toLowerCase().includes("mac");
  const shortcutText = isMac ? "⌘K" : "Ctrl+K";

  const results = useMemo(() => searchSite(query), [query]);

  // Handle focus when overlay is opened
  useEffect(() => {
    if (isSearchOpen) {
      setQuery("");
      setSelected(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isSearchOpen]);

  // Adjust scroll when navigating via keyboard arrows
  useEffect(() => {
    if (resultsRef.current) {
      const activeEl = resultsRef.current.querySelector(".search-item.active");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selected]);

  const handleAction = (item) => {
    if (item.action === "logout") {
      logout();
    } else {
      navigate(item.link);
    }
    closeSearch();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selected]) {
        handleAction(results[selected]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          className="search-overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeSearch}
        >
          <motion.div
            className="search-overlay-container"
            initial={{ opacity: 0, scale: 0.96, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -30 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Row */}
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-input-icon">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search tools, tests, settings..."
                className="search-input-field"
              />
              {query && (
                <button className="search-clear-btn" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
              <div className="search-shortcut-hint">ESC</div>
            </div>

            {/* Tip Banner */}
            <div className="search-tip-banner">
              <span className="search-tip-icon">💡</span>
              <span className="search-tip-text">
                Press <kbd className="tip-kbd">{shortcutText}</kbd> to search from any page on the platform.
              </span>
            </div>

            {/* Results Row */}
            <div ref={resultsRef} className="search-results-list">
              {results.length > 0 ? (
                results.map((item, index) => (
                  <div
                    key={item.label}
                    className={`search-item ${index === selected ? "active" : ""}`}
                    onClick={() => handleAction(item)}
                    onMouseEnter={() => setSelected(index)}
                  >
                    <div className="search-item-icon-bg">{ICON_MAP[item.icon]}</div>
                    <div className="search-item-text">
                      <span className="search-item-title">{item.label}</span>
                      <span className="search-item-description">{item.description}</span>
                    </div>
                    {index === selected && (
                      <motion.div className="search-item-enter-hint" layoutId="searchEnterHint">
                        <span>Open</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="enter-arrow-svg">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </motion.div>
                    )}
                  </div>
                ))
              ) : (
                <div className="search-no-results">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="search-no-results-icon">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <p>No results found for "{query}"</p>
                  <span>Try searching for aptitude, interview, dashboard, or profile.</span>
                </div>
              )}
            </div>

            {/* Keyboard Footer hints */}
            <div className="search-footer-hint">
              <div className="hint-group">
                <span className="key-badge">↑↓</span>
                <span>to navigate</span>
              </div>
              <div className="hint-group">
                <span className="key-badge">Enter</span>
                <span>to select</span>
              </div>
              <div className="hint-group">
                <span className="key-badge">Esc</span>
                <span>to dismiss</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
