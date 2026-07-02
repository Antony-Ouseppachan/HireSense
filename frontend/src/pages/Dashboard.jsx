import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Dashboard.css";

function Dashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    try {
      const savedProfile = JSON.parse(localStorage.getItem("hireSenseProfile") || "null");
      const savedInterviews = JSON.parse(localStorage.getItem("hireSenseInterviews") || "null");

      if (savedProfile) setProfile(savedProfile);
      if (Array.isArray(savedInterviews)) setInterviews(savedInterviews);
    } catch (error) {
      console.warn("Dashboard data could not be restored:", error);
    }
  }, []);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "there";
  const interviewCount = Array.isArray(interviews) ? interviews.length : 0;
  const latestScore = Array.isArray(interviews) && interviews[0]?.score != null ? interviews[0].score : null;

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const fields = [profile.education, profile.skills, profile.experience, profile.resume_url];
    const filled = fields.filter((value) => !!value).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <div className="welcome-text">
            <h1>Welcome back, {displayName}</h1>
            <p>Your interview preparation dashboard</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-interviews">
            <div className="stat-icon icon-interviews"></div>
            <div className="stat-number">{interviewCount}</div>
            <div className="stat-label">Interviews</div>
          </div>
          <div className="stat-card stat-profile">
            <div className="stat-icon icon-profile"></div>
            <div className="stat-number">{profileCompletion}%</div>
            <div className="stat-label">Profile Complete</div>
          </div>
          <div className="stat-card stat-score">
            <div className="stat-icon icon-score"></div>
            <div className="stat-number">{latestScore ? latestScore : "—"}</div>
            <div className="stat-label">Latest Score</div>
          </div>
          <div className="stat-card stat-ready">
            <div className="stat-icon icon-ready"></div>
            <div className="stat-number">Ready</div>
            <div className="stat-label">Status</div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="content-card">
          <h2 className="card-title">
            <span className="card-title-icon icon-interviews-title"></span>
            Recent Interviews
          </h2>

          {interviewCount > 0 ? (
            <ul className="interview-list">
              {interviews.slice(0, 5).map((interview, index) => (
                <li key={index} className="interview-item">
                  <div className="interview-title">
                    {interview.title || `Interview ${interviewCount - index}`}
                  </div>
                  <div className="interview-date">
                    {interview.date ? new Date(interview.date).toLocaleDateString() : "Recently"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎬</div>
              <p>No interviews yet. Start your first one!</p>
              <Link to="/interviews">
                <button className="cta-button">Start Interview</button>
              </Link>
            </div>
          )}

          {interviewCount > 0 && (
            <Link to="/interviews">
              <button className="cta-button">View All Interviews</button>
            </Link>
          )}
        </div>

        <div className="content-card">
          <h2 className="card-title">
            <span className="card-title-icon">👤</span>
            Profile Overview
          </h2>

          {profile ? (
            <>
              <div className="profile-overview">
                <div className="profile-item">
                  <span className="profile-label">Full Name</span>
                  <span className="profile-value">{profile.name || displayName}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Email</span>
                  <span className="profile-value">{user?.email || "Not available"}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Role</span>
                  <span className="profile-value">{profile.role || "Not specified"}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Experience</span>
                  <span className="profile-value">{profile.experience || "Not provided"}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Completion</span>
                  <span className="profile-value">{profileCompletion}%</span>
                </div>
              </div>
              <Link to="/profile">
                <button className="cta-button">Update Profile</button>
              </Link>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>Complete your profile to get started</p>
              <Link to="/profile">
                <button className="cta-button">Create Profile</button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
