import { useNavigate } from "react-router-dom";
import "../styles/Interviews.css";

function Interviews({ user, profile, interviews, onStartInterview }) {
  const navigate = useNavigate();

  const handleStart = async () => {
    const session = await onStartInterview();
    if (session?.id) {
      navigate(`/interviews/${session.id}`);
    }
  };

  const isProfileComplete = 
    profile && 
    profile.role && 
    profile.skills;

  return (
    <div className="page-container">
      <div className="interviews-header">
        <h1>Interview Preparation Hub</h1>
        <p>Prepare for your dream role with realistic, interactive mock interviews tailored to your profile and skills.</p>
      </div>

      <div className="interviews-layout">
        {/* Left Column: Profile Sync & Launch Settings */}
        <div className="interviews-sidebar">
          <div className="card profile-sync-panel">
            <h3>
              <span>📋</span> Interview Target Profile
            </h3>
            
            <p style={{ fontSize: "14px", margin: "0 0 8px 0" }}>
              Our AI customizes mock interview questions using these profile parameters:
            </p>

            <div className="profile-meta-grid">
              <div className="profile-meta-item">
                <div className="profile-meta-label">Target Role</div>
                <div className={`profile-meta-value ${!profile?.role ? 'empty' : ''}`}>
                  {profile?.role || "Not Configured"}
                </div>
              </div>
              
              <div className="profile-meta-item">
                <div className="profile-meta-label">Key Skills</div>
                <div className={`profile-meta-value ${!profile?.skills ? 'empty' : ''}`}>
                  {profile?.skills || "Not Configured"}
                </div>
              </div>

              <div className="profile-meta-item">
                <div className="profile-meta-label">Experience</div>
                <div className={`profile-meta-value ${!profile?.experience ? 'empty' : ''}`}>
                  {profile?.experience || "Not Provided"}
                </div>
              </div>

              <div className="profile-meta-item">
                <div className="profile-meta-label">Resume URL</div>
                <div className="profile-meta-value">
                  {profile?.resume_url ? (
                    <a href={profile.resume_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", textDecoration: "underline" }}>
                      View Uploaded PDF
                    </a>
                  ) : (
                    <span className="empty">No Resume Uploaded</span>
                  )}
                </div>
              </div>
            </div>

            {!isProfileComplete && (
              <div className="warning-box">
                <p>
                  <strong>Notice:</strong> Your profile target role or skills are missing. Complete them to get custom, relevant questions.
                </p>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate("/profile")}
                  style={{ width: "100%", padding: "10px", fontSize: "13px" }}
                >
                  Configure Profile
                </button>
              </div>
            )}
          </div>

          <div className="card launch-card">
            <div className="launch-content">
              <h3 className="launch-title">Launch Mock Session</h3>
              <p style={{ fontSize: "14px" }}>
                Ready to practice? This session will generate 5 custom behavioral and technical questions based on your profile.
              </p>
              <button 
                className="cta-button launch-button" 
                onClick={handleStart}
                disabled={!isProfileComplete}
              >
                <span>🚀</span> Start Mock Interview
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Previous Sessions History */}
        <div className="sessions-history-section">
          <div className="card" style={{ marginTop: 0, height: "100%" }}>
            <div className="sessions-panel-header">
              <h2>Previous Practice Sessions</h2>
              <span className="session-count">
                {interviews.length} {interviews.length === 1 ? "Session" : "Sessions"}
              </span>
            </div>

            {interviews.length === 0 ? (
              <div className="sessions-empty">
                <div className="sessions-empty-icon">🎓</div>
                <h3>No Sessions Recorded Yet</h3>
                <p style={{ marginTop: "8px" }}>
                  Your completed mock interviews and AI performance evaluations will appear here.
                </p>
              </div>
            ) : (
              <div className="sessions-grid">
                {interviews.map((session, index) => {
                  const score = session.score;
                  let scoreClass = "score-pending";
                  if (score !== null && score !== undefined) {
                    scoreClass = score >= 80 ? "score-high" : score >= 50 ? "score-mid" : "score-pending";
                  }

                  return (
                    <div key={session.id || index} className="session-card">
                      <div className="session-info">
                        <div className="session-title">
                          {profile?.role || "Candidate"} Practice Session
                        </div>
                        <div className="session-date">
                          {session.created_at ? new Date(session.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          }) : "Just now"}
                        </div>
                      </div>

                      <div className="session-meta">
                        <div className={`score-badge ${scoreClass}`}>
                          {score !== null && score !== undefined ? `${score}%` : "—"}
                        </div>
                        <button 
                          className="btn btn-secondary session-action-btn"
                          onClick={() => navigate(`/interviews/${session.id}`)}
                        >
                          Review Report
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Interviews;
