import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useHonesty } from "../context/HonestyContext";
import useDashboardData from "../hooks/useDashboardData";
import { uploadResume, deleteResume, getAptitudeRemarkDetail, getAptitudeHistory, reattemptAssessment } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Dashboard.css";

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="dash-clock">
      <span className="dash-clock-time">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <span className="dash-clock-date">{time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
    </div>
  );
}

function CountUp({ value, duration = 1.5, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - (1 - p) * (1 - p) * (1 - p);
      setDisplay(Math.round(value * eased * 10 ** decimals) / 10 ** decimals);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration, decimals]);
  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>;
}

function SkeletonBlock({ height = 120, count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dash-skeleton" style={{ height }} />
      ))}
    </>
  );
}

function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (!open) { setQuery(""); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  const items = useMemo(() => {
    if (!query.trim()) return [];
    return [
      { section: "Pages", items: [
        { label: "Dashboard", link: "/dashboard" },
        { label: "Interview Studio", link: "/interviews" },
        { label: "Profile", link: "/profile" },
      ]},
    ].flatMap((s) => s.items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())).map((i) => ({ ...i, section: s.section })));
  }, [query]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="dash-search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="dash-search-modal" initial={{ opacity: 0, scale: 0.96, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -20 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()}>
            <div className="dash-search-input-wrap">
              <svg className="dash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="dash-search-input" autoFocus placeholder="Search pages, interviews, documents..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <kbd className="dash-search-kbd">ESC</kbd>
            </div>
            {items.length > 0 && (
              <div className="dash-search-results">
                {items.map((item, i) => (
                  <Link key={i} to={item.link} className="dash-search-item" onClick={onClose}>
                    <span className="dash-search-item-label">{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
            {query.trim() && items.length === 0 && <p className="dash-search-empty">No results found.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

export default function Dashboard() {
  const { user, isCandidate, isRecruiter } = useAuth();
  const { honesty, refresh: refreshHonesty } = useHonesty();
  const { loading, error, refetch, profile, interviews, backendUser, displayName, initials, completion, interviewStats, activity, tasks, health, relativeTime, remarks } = useDashboardData();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [reattemptingId, setReattemptingId] = useState(null);
  const [reattemptError, setReattemptError] = useState("");

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setSearchOpen((o) => !o); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAptitudeHistory({ limit: 4 });
        setHistoryList(res?.history || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleReattempt = async (id) => {
    if (reattemptingId) return;
    setReattemptingId(id);
    setReattemptError("");
    try {
      const res = await reattemptAssessment(id);
      navigate(`/aptitude/test?id=${res.assessmentId}`);
    } catch (err) {
      setReattemptError(err.message || "Failed to create reattempt. Please try again.");
      setReattemptingId(null);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      await uploadResume(fd);
      refetch();
    } catch { /* ignore */ } finally { setResumeUploading(false); }
  };

  const handleDeleteResume = async () => {
    if (!profile?.resume_id) return;
    setIsDeleting(true);
    try {
      await deleteResume(profile.resume_id);
      setShowDeleteConfirm(false);
      refetch();
    } catch { /* ignore */ } finally { setIsDeleting(false); }
  };

  const resumeFileName = profile?.resume_url
    ? decodeURIComponent(profile.resume_url.split("/").pop() || "resume.pdf")
    : null;

  if (loading) {
    return (
      <div className="dash-root">
        <div className="dash-container">
          <LoadingSpinner label="Loading your workspace" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-root">
        <div className="dash-container">
          <motion.div className="dash-error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="dash-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
            </div>
            <h3>Unable to load dashboard</h3>
            <p>Check your connection and try again.</p>
            <button className="dash-retry-btn" onClick={refetch}>Try Again</button>
          </motion.div>
        </div>
      </div>
    );
  }

  const profilePic = profile?.profile_picture_url || null;
  const joinedDate = backendUser?.created_at || user?.metadata?.createdAt;
  const lastLogin = backendUser?.last_login || null;
  const isVerified = backendUser?.is_verified || false;
  const accountType = isCandidate ? "Candidate" : isRecruiter ? "Recruiter" : user?.role || "User";

  return (
    <motion.div className="dash-root" variants={container} initial="hidden" animate="show">
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="dash-container">
        <div className="dash-top-bar">
          <button className="dash-search-trigger" onClick={() => setSearchOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dash-search-trigger-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span>Search</span>
            <kbd>Ctrl+K</kbd>
          </button>
          <LiveClock />
        </div>

        {/* Greeting */}
        <motion.section className="dash-greeting" variants={itemAnim}>
          <h1 className="dash-greeting-text">Ready for launch, <span className="dash-greeting-name">{displayName}</span>?</h1>
          <p className="dash-greeting-sub">Welcome back to your AI workspace.</p>
        </motion.section>

        {/* Profile + Stats row */}
        <div className="dash-profile-row">
          <motion.div className="dash-profile-card" variants={itemAnim}>
            <div className="dash-profile-left">
              <div className="dash-avatar">
                {profilePic ? <img src={profilePic} alt="" className="dash-avatar-img" /> : <span className="dash-avatar-initials">{initials}</span>}
                <span className={`dash-online-dot ${profile ? "online" : ""}`} />
              </div>
              <div className="dash-profile-info">
                <h3>{profile?.first_name ? `${profile.first_name} ${profile.last_name || ""}` : displayName}</h3>
                <p className="dash-profile-email">{user?.email || ""}</p>
                <div className="dash-profile-meta">
                  <span className="dash-meta-tag">{accountType}</span>
                  {isVerified && <span className="dash-meta-tag dash-meta-verified">Verified</span>}
                </div>
              </div>
            </div>
            <div className="dash-profile-right">
              <div className="dash-completion-ring-wrap">
                <svg className="dash-completion-ring" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <motion.circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" strokeDasharray={106.8} initial={{ strokeDashoffset: 106.8 }} animate={{ strokeDashoffset: 106.8 - (106.8 * (completion.percentage || 0)) / 100 }} transition={{ duration: 1.2, ease: [0.16,1,0.3,1] }} transform="rotate(-90 20 20)" />
                </svg>
                <span className="dash-completion-pct">{completion.percentage || 0}%</span>
              </div>
              <span className="dash-completion-label">Profile</span>
              {completion.percentage < 100 && (
                <Link to="/profile" className="dash-profile-cta">Complete Profile</Link>
              )}
            </div>
            <div className="dash-profile-stats">
              <div className="dash-ps-item">
                <span className="dash-ps-label">Joined</span>
                <span className="dash-ps-value">{joinedDate ? new Date(joinedDate).toLocaleDateString() : "—"}</span>
              </div>
              <div className="dash-ps-item">
                <span className="dash-ps-label">Last Login</span>
                <span className="dash-ps-value">{lastLogin ? relativeTime(lastLogin) : "—"}</span>
              </div>
              <div className="dash-ps-item">
                <span className="dash-ps-label">Plan</span>
                <span className="dash-ps-value">{health.subscription}</span>
              </div>
              <div className="dash-ps-item">
                <span className="dash-ps-label">Interviews</span>
                <span className="dash-ps-value">{interviewStats.totalInterviews}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <motion.section className="dash-section" variants={itemAnim}>
          <div className="dash-stats-grid">
            {[
              { label: "Interviews", value: interviewStats.totalInterviews, icon: "play" },
              { label: "Completed", value: interviewStats.totalCompleted, icon: "check" },
              { label: "Avg. Score", value: interviewStats.avgScore, suffix: "%", icon: "trending" },
              { label: "Best Score", value: interviewStats.bestScore, suffix: "%", icon: "star" },
              { label: "Resume", value: profile?.resume_url ? 1 : 0, suffix: profile?.resume_url ? "Uploaded" : "Missing", icon: "file" },
              { label: "Skills", value: profile?.skills?.length || 0, icon: "layers" },
            ].map((stat, i) => (
              <motion.div key={i} className="dash-stat-card" whileHover={{ y: -4, transition: { duration: 0.3 } }}>
                <div className="dash-stat-icon">
                  <StatIcon name={stat.icon} />
                </div>
                <div className="dash-stat-body">
                  <span className="dash-stat-value">
                    {stat.value != null ? <CountUp value={stat.value} /> : "—"}
                    {stat.suffix && <span className="dash-stat-suffix">{stat.suffix}</span>}
                  </span>
                  <span className="dash-stat-label">{stat.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Honesty Score Module */}
        <motion.section className="dash-section" variants={itemAnim} id="honesty">
          <HonestyModule honesty={honesty} onRefresh={refreshHonesty} />
        </motion.section>

        {/* Resume Management */}
        <motion.section className="dash-section" variants={itemAnim}>
          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Resume</h2>
            </div>
            {resumeFileName ? (
              <div className="dash-resume-status">
                <div className="dash-resume-info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dash-resume-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="dash-resume-filename">{resumeFileName}</span>
                </div>
                <div className="dash-resume-actions">
                  <button className="dash-resume-btn" onClick={() => setShowResumeViewer(true)}>View</button>
                  <button className="dash-resume-btn dash-resume-btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
                </div>
              </div>
            ) : (
              <div className="dash-resume-empty">
                <p>No resume uploaded yet.</p>
                <label className="dash-resume-upload-label">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} disabled={resumeUploading} hidden />
                  <span className="dash-resume-upload-btn">{resumeUploading ? "Uploading..." : "Upload Resume"}</span>
                </label>
              </div>
            )}
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.section className="dash-section" variants={itemAnim}>
          <div className="dash-actions-grid">
            {[
              { label: "Start AI Interview", icon: "play", to: "/interviews" },
              { label: "Edit Profile", icon: "user", to: "/profile" },
            ].map((action, i) => (
              <motion.div key={i} className="dash-action-card" whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}>
                <Link to={action.to} className="dash-action-btn">
                  <ActionIcon name={action.icon} />
                  <span>{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Activity + Notifications row */}
        <div className="dash-two-col">
          <motion.section className="dash-section" variants={itemAnim}>
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">Recent Activity</h2>
              </div>
              {activity.length === 0 ? (
                <div className="dash-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dash-empty-icon"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <p>No activity yet.</p>
                  <Link to="/interviews" className="dash-empty-cta">Start Your First Interview</Link>
                </div>
              ) : (
                <div className="dash-timeline">
                  {activity.map((ev, i) => (
                    <div key={i} className="dash-timeline-item">
                      <div className="dash-tl-dot">
                        <ActivityDot type={ev.type} />
                      </div>
                      <div className="dash-tl-content">
                        <span className="dash-tl-label">{ev.label}</span>
                        {ev.score != null && <span className="dash-tl-score">{ev.score}%</span>}
                      </div>
                      <span className="dash-tl-time">{relativeTime(ev.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          <motion.section className="dash-section" variants={itemAnim}>
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">Upcoming Tasks</h2>
                <span className="dash-card-badge">{tasks.length}</span>
              </div>
              {tasks.length === 0 ? (
                <div className="dash-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dash-empty-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <p>All tasks completed!</p>
                </div>
              ) : (
                <div className="dash-task-list">
                  {tasks.map((task) => (
                    <div key={task.id} className="dash-task-item">
                      <span className={`dash-task-priority dash-priority-${task.priority}`} />
                      <span className="dash-task-label">{task.label}</span>
                      {task.id === "profile" && <Link to="/profile" className="dash-task-link">Go</Link>}
                      {task.id === "resume" && <button className="dash-task-link" onClick={() => document.getElementById("resume-input")?.click()}>Upload</button>}
                      {task.id === "skills" && <Link to="/profile" className="dash-task-link">Add</Link>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* Assessment History */}
        <motion.section className="dash-section dash-section-full" variants={itemAnim}>
          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Assessment History</h2>
              {historyList.length > 0 && (
                <Link to="/aptitude/history" className="dash-card-link">View All</Link>
              )}
            </div>
            {historyList.length === 0 ? (
              <div className="dash-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dash-empty-icon"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9m0 0h6"/></svg>
                <p>No aptitude assessments taken yet.</p>
                <Link to="/aptitude" className="dash-empty-cta">Take an Assessment</Link>
              </div>
            ) : (
              <>
                {reattemptError && (
                  <div className="dash-assess-error" role="alert">{reattemptError}</div>
                )}
                <div className="dash-assess-grid">
                  {historyList.map((h) => (
                    <AssessmentCard key={h.id} attempt={h} onReattempt={handleReattempt} reattempting={reattemptingId === h.id} />
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.section>

        {/* Remarks History */}
        <motion.section className="dash-section dash-section-full" variants={itemAnim}>
          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Remarks History</h2>
            </div>            {remarks.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "16px 20px", margin: 0 }}>No assessments taken yet.</p>
            ) : (
              <div className="dash-remarks-list">
                {remarks.map((r) => (
                  <RemarkRow key={r.id} remark={r} />
                ))}
              </div>
            )}
          </div>
        </motion.section>

      </div>

      {/* Resume Viewer Modal */}
      {showResumeViewer && profile?.resume_url && createPortal(
        <div className="viewer-modal-overlay" onClick={() => setShowResumeViewer(false)}>
          <div className="viewer-modal" onClick={(e) => e.stopPropagation()}>
            <button className="viewer-close" onClick={() => setShowResumeViewer(false)}>&times;</button>
            <iframe src={profile.resume_url} title="Resume" className="viewer-iframe" />
          </div>
        </div>, document.body)}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && createPortal(
        <div className="confirm-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">Delete resume?</p>
            <p className="confirm-body">This will permanently remove your resume. You can upload it again later.</p>
            <div className="confirm-actions">
              <button className="confirm-button confirm-button-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</button>
              <button className="confirm-button confirm-button-danger" onClick={handleDeleteResume} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>, document.body)}

      {resumeUploading && <div className="dash-overlay"><LoadingSpinner label="Uploading resume..." /></div>}
    </motion.div>
  );
}

function HonestyModule({ honesty, onRefresh }) {
  if (!honesty) return null;
  const score = Math.max(0, Math.min(100, honesty.score || 0));
  const status = honesty.status || "good";
  const colors = { excellent: "#10b981", good: "#38bdf8", warning: "#fbbf24", locked: "#f87171" };
  const color = colors[status] || "#38bdf8";
  const labels = { excellent: "Excellent Integrity", good: "Good Standing", warning: "Integrity Warning", locked: "Studio Locked" };
  const descs = {
    locked: "Your honesty score fell too low, so the Interview Studio is locked. Reattempt a previous assessment without cheating to recover your score.",
    warning: "Detected violations are pulling your honesty score down. Complete assessments without cheating to raise it back above 80.",
    good: "No major integrity violations this week. Keep taking assessments honestly to protect your score.",
    excellent: "Clean record this week. Outstanding integrity — keep it up!",
  };
  const R = 84;
  const C = 2 * Math.PI * R;

  return (
    <div className="dash-card dash-honesty-card" id="honesty-card">
      <div className="dash-honesty-gauge-wrap">
        <svg className="dash-honesty-gauge" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
          <motion.circle
            cx="100" cy="100" r={R} fill="none"
            stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (C * score) / 100 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            transform="rotate(-90 100 100)"
            style={{ filter: `drop-shadow(0 0 12px ${color}55)` }}
          />
        </svg>
        <div className="dash-honesty-gauge-center">
          <svg className="dash-honesty-shield" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div className="dash-honesty-score"><CountUp value={score} duration={1.2} />%</div>
          <span className="dash-honesty-sub">Honesty Score</span>
        </div>
      </div>

      <div className="dash-honesty-info">
        <div className="dash-honesty-head">
          <div>
            <h2 className="dash-honesty-title">Integrity Shield</h2>
            <span className="dash-honesty-status" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
              <span className="dash-honesty-status-dot" style={{ background: color }} />
              {labels[status]}
            </span>
          </div>
          <button className="dash-honesty-refresh" onClick={onRefresh} title="Refresh score">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>

        <p className="dash-honesty-desc">{descs[status] || descs.good}</p>

        <div className="dash-honesty-week">
          <div className="dash-honesty-week-item">
            <span className="dash-honesty-week-label">Week</span>
            <span className="dash-honesty-week-value">{honesty.weekRangeLabel}</span>
          </div>
          <div className="dash-honesty-week-item">
            <span className="dash-honesty-week-label">Violations</span>
            <span className="dash-honesty-week-value" style={{ color: honesty.violationsCount > 0 ? "#f87171" : "var(--text-primary)" }}>{honesty.violationsCount}</span>
          </div>
          <div className="dash-honesty-week-item">
            <span className="dash-honesty-week-label">Clean Attempts</span>
            <span className="dash-honesty-week-value" style={{ color: "#10b981" }}>{honesty.cleanAssessments}</span>
          </div>
          <div className="dash-honesty-week-item">
            <span className="dash-honesty-week-label">Assessments</span>
            <span className="dash-honesty-week-value">{honesty.totalAssessments}</span>
          </div>
        </div>

        <div className="dash-honesty-foot">
          <span className="dash-honesty-reset">Resets to 100 every Monday</span>
          {status === "locked" && (
            <Link to="/aptitude/history" className="dash-honesty-cta">
              Reattempt a Previous Test
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatIcon({ name }) {
  if (name === "play") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
  if (name === "check") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
  if (name === "trending") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (name === "star") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  if (name === "file") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  if (name === "layers") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
  return null;
}

function ActionIcon({ name }) {
  if (name === "upload") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
  if (name === "play") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
  if (name === "chart") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (name === "user") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return null;
}

function ActivityDot({ type }) {
  if (type === "login") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dash-tl-icon login"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
  if (type === "interview") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dash-tl-icon interview"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
  if (type === "resume") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dash-tl-icon file"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  if (type === "profile") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dash-tl-icon user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return <div className="dash-tl-dot-default" />;
}

function RemarkRow({ remark }) {  const r = remark;
  const riskLevel = r.risk_level || "none";
  const terminated = r.terminated || false;
  const score = r.score ?? 0;
  const warnings = r.warnings ?? 0;
  const violationCount = r.malpractice_summary ? Object.keys(r.malpractice_summary).length : 0;
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const statusClass = terminated ? "disqualified" : warnings > 0 ? "warnings" : "clean";
  const statusLabel = terminated ? "Disqualified" : warnings > 0 ? "Completed With Warnings" : "Completed Successfully";

  useEffect(() => {
    if (!expanded || detail) return;
    (async () => {
      setLoadingDetail(true);
      try {
        const res = await getAptitudeRemarkDetail(r.id);
        setDetail(res?.remark || null);
      } catch { /* ignore */ }
      setLoadingDetail(false);
    })();
  }, [expanded, r.id, detail]);

  return (
    <div className={`dash-remark-row ${expanded ? "expanded" : ""}`}>
      <div className="dash-remark-header" onClick={() => setExpanded((e) => !e)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((p) => !p); } }}>
        <div className={`dash-remark-status-icon dash-remark-${statusClass}`}>
          {statusClass === "clean" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : statusClass === "warnings" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/></svg>
          )}
        </div>
        <div className="dash-remark-info">
          <span className="dash-remark-name">AI Aptitude Assessment</span>
          <span className="dash-remark-meta">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ""} &middot; {r.difficulty ? r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1) : ""}</span>
        </div>
        <div className="dash-remark-stats">
          <span className={`dash-remark-score ${score >= 40 ? "pass" : "fail"}`}>{score}%</span>
          {warnings > 0 && <span className="dash-remark-warn-count">{warnings}W</span>}
        </div>
        <svg className={`dash-remark-arrow ${expanded ? "open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div className="dash-remark-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {loadingDetail ? (
              <div className="dash-remark-detail-loading">Loading...</div>
            ) : detail ? (
              <div className="dash-remark-detail-content">
                <div className="dash-remark-detail-grid">
                  <div className="dash-remark-detail-stat"><span>Score</span><strong>{detail.score}%</strong></div>
                  <div className="dash-remark-detail-stat"><span>Accuracy</span><strong>{detail.accuracy}%</strong></div>
                  <div className="dash-remark-detail-stat"><span>Time</span><strong>{Math.floor(detail.timeTaken / 60)}m {detail.timeTaken % 60}s</strong></div>
                  <div className="dash-remark-detail-stat"><span>Warnings</span><strong>{detail.warnings}</strong></div>
                </div>
                <div className="dash-remark-detail-remarks">
                  <p className="dash-remark-detail-label">Remarks</p>
                  <p className="dash-remark-detail-text">{detail.remarks || "No remarks."}</p>
                </div>
                {detail.violations && detail.violations.length > 0 && (
                  <div className="dash-remark-detail-violations">
                    <p className="dash-remark-detail-label">Violation Timeline</p>
                    <div className="dash-remark-violation-timeline">
                      {detail.violations.map((v, i) => (
                        <div key={i} className="dash-remark-violation-event">
                          <div className="dash-rm-ve-dot" />
                          <span className="dash-rm-ve-time">{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ""}</span>
                          <span className="dash-rm-ve-type">{v.type?.replace(/-/g, " ") || "Unknown"}</span>
                          <span className="dash-rm-ve-severity" style={{ color: v.severity === "critical" ? "var(--text-primary)" : "var(--text-muted)" }}>{v.severity || ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.feedback && (
                  <div className="dash-remark-detail-feedback">
                    <p className="dash-remark-detail-label">AI Feedback</p>
                    <p className="dash-remark-detail-text">{detail.feedback}</p>
                  </div>
                )}
                {detail.improvementPlan && detail.improvementPlan.length > 0 && (
                  <div className="dash-remark-detail-improve">
                    <p className="dash-remark-detail-label">Learning Suggestions</p>
                    <ul className="dash-remark-detail-list">
                      {detail.improvementPlan.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                <div className="dash-remark-detail-footer">
                  <span className={`dash-remark-status-badge dash-rs-${statusClass}`}>{statusLabel}</span>
                  <span className={`dash-remark-risk dash-rl-${riskLevel}`}>Risk: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}</span>
                </div>
              </div>
            ) : (
              <div className="dash-remark-detail-error">Failed to load details.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AssessmentCard({ attempt, onReattempt, reattempting }) {
  const h = attempt;
  const completed = h.status === "completed";
  const ready = h.status === "ready";
  const generating = h.status === "generating";
  const done = completed || h.status === "cancelled" || h.status === "in_progress";
  const grade = h.grade || (h.score >= 90 ? "A+" : h.score >= 80 ? "A" : h.score >= 70 ? "B+" : h.score >= 60 ? "B" : h.score >= 50 ? "C" : "NI");
  const tone = grade === "A+" ? "#10b981" : grade === "A" ? "#34d399" : grade === "B+" ? "#38bdf8" : grade === "B" ? "#fbbf24" : grade === "C" ? "#f97316" : "#f87171";
  const integrity = h.integrity_score ?? 100;
  const time = h.time_taken ?? 0;
  const date = h.completed_at || h.created_at;

  return (
    <div className="dash-assess-card">
      <div className="dash-assess-card-top">
        <div className="dash-assess-score" style={{ color: completed ? tone : "var(--text-muted)" }}>
          {completed ? `${h.score ?? 0}%` : "—"}
        </div>
        {completed ? (
          <span className="dash-assess-grade" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>{grade}</span>
        ) : (
          <span className="dash-assess-grade" style={{ color: "#94a3b8", borderColor: "rgba(148,163,184,0.4)", background: "rgba(148,163,184,0.1)" }}>{h.status === "cancelled" ? "Cancelled" : h.status === "ready" ? "Ready" : h.status === "generating" ? "Generating" : "In Progress"}</span>
        )}
      </div>
      <div className="dash-assess-meta">
        <span className="dash-assess-diff">{(h.difficulty || "").charAt(0).toUpperCase() + (h.difficulty || "").slice(1)}</span>
        <span className="dash-assess-date">{date ? new Date(date).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
      </div>
      <div className="dash-assess-stats">
        <span>{completed ? `${h.correct_count ?? 0}/${h.total_questions ?? 0} correct` : `${h.total_questions ?? 0} questions`}</span>
        {completed && <span>{h.accuracy ?? 0}% acc</span>}
        {completed && <span>{Math.floor(time / 60)}m {time % 60}s</span>}
        {completed && <span>Integrity {integrity}%</span>}
      </div>
      <div className="dash-assess-actions">
        {generating ? (
          <span className="dash-assess-btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>Generating questions...</span>
        ) : (
          <>
            {done && <Link to={`/aptitude/results/${h.id}`} className="dash-assess-btn">Analysis</Link>}
            {done && <Link to={`/aptitude/review/${h.id}`} className="dash-assess-btn">Review</Link>}
            {ready && <Link to={`/aptitude/test?id=${h.id}`} className="dash-assess-btn">Start Test</Link>}
            <button className="dash-assess-btn primary" onClick={() => onReattempt(h.id)} disabled={reattempting}>
              {reattempting ? "Creating..." : "Reattempt"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
