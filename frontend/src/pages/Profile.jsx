import { useEffect, useMemo, useRef, useState } from "react";
import LoadingSpinner from "/src/components/LoadingSpinner.jsx";
import "/src/styles/Profile.css";

const FIELDS = [
  { key: "role", label: "Target Role", type: "input", placeholder: "e.g. Backend Developer" },
  { key: "education", label: "Education", type: "textarea", placeholder: "Degree, institution, graduation year..." },
  { key: "skills", label: "Skills", type: "textarea", placeholder: "React, Node.js, PostgreSQL..." },
  { key: "experience", label: "Experience", type: "textarea", placeholder: "Roles, companies, years..." },
  { key: "projects", label: "Projects", type: "textarea", placeholder: "What you built, and what it does..." },
];

function getInitials(name, email) {
  const source = (name || email || "?").trim();
  if (!source) return "?";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Profile({ user, profile, onSave, onResumeUpload }) {
  const [form, setForm] = useState({
    name: user?.email || "",
    education: "",
    skills: "",
    experience: "",
    projects: "",
    role: "",
    resume_url: ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || user?.email || "",
        education: profile.education || "",
        skills: profile.skills || "",
        experience: profile.experience || "",
        projects: profile.projects || "",
        role: profile.role || "",
        resume_url: profile.resume_url || ""
      });
    }
  }, [profile, user]);

  const completeness = useMemo(() => {
    const trackedFields = ["role", "education", "skills", "experience", "projects"];
    const filled = trackedFields.filter((key) => form[key] && form[key].trim().length > 0).length;
    return Math.round((filled / trackedFields.length) * 100);
  }, [form]);

  const initials = getInitials(form.name, user?.email);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const res = onSave(form);
    if (res && typeof res.then === "function") {
      setIsSaving(true);
      res
        .then(() => {
          setSavedPulse(true);
          setTimeout(() => setSavedPulse(false), 1800);
        })
        .finally(() => setIsSaving(false));
    }
  };

  const uploadResume = async (file) => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("userId", user.id);

    try {
      const result = await onResumeUpload(formData);
      if (result?.profile) {
        setForm((prev) => ({ ...prev, resume_url: result.profile.resume_url }));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleResumeInputChange = (event) => {
    const file = event.target.files[0];
    uploadResume(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadResume(file);
  };

  const resumeFileName = form.resume_url ? decodeURIComponent(form.resume_url.split("/").pop() || "resume.pdf") : null;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <span className="profile-eyebrow">CANDIDATE DOSSIER</span>
        <h1 className="profile-title">Your Profile</h1>
      </div>

      <div className="profile-grid">
        {/* ---------- Sidebar: identity + scan ring + resume slot ---------- */}
        <aside className="profile-sidebar">
          <div className="identity-card">
            <div className="scan-ring-wrapper">
              <svg className="scan-ring" viewBox="0 0 120 120">
                <circle className="scan-ring-track" cx="60" cy="60" r="52" />
                <circle
                  className="scan-ring-progress"
                  cx="60"
                  cy="60"
                  r="52"
                  style={{
                    strokeDasharray: 2 * Math.PI * 52,
                    strokeDashoffset: 2 * Math.PI * 52 * (1 - completeness / 100),
                  }}
                />
              </svg>
              <div className="avatar-core">{initials}</div>
            </div>

            <p className="identity-name">{form.name || "Unnamed candidate"}</p>
            <p className="identity-email">{user?.email}</p>

            <div className="completeness-readout">
              <span className="completeness-value">{completeness}%</span>
              <span className="completeness-label">PROFILE COMPLETE</span>
            </div>
          </div>

          <div className="resume-card">
            <span className="section-label">RESUME</span>

            <div
              className={`resume-dropzone ${isDragging ? "is-dragging" : ""} ${form.resume_url ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                id="resume-input"
                type="file"
                accept="application/pdf"
                onChange={handleResumeInputChange}
                hidden
              />
              <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>

              {form.resume_url ? (
                <>
                  <p className="dropzone-text">{resumeFileName}</p>
                  <span className="dropzone-hint">Drop a new file to replace</span>
                </>
              ) : (
                <>
                  <p className="dropzone-text">Drop your resume here</p>
                  <span className="dropzone-hint">or click to browse — PDF only</span>
                </>
              )}
            </div>

            {form.resume_url && (
              <a href={form.resume_url} target="_blank" rel="noreferrer" className="resume-view-link">
                View current resume →
              </a>
            )}
          </div>
        </aside>

        {/* ---------- Main: editable fields ---------- */}
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <span className="section-label">IDENTITY</span>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-section">
            <span className="section-label">DATA MATRIX</span>
            {FIELDS.map(({ key, label, type, placeholder }) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                {type === "textarea" ? (
                  <textarea
                    id={key}
                    name={key}
                    value={form[key]}
                    onChange={handleChange}
                    rows={3}
                    placeholder={placeholder}
                  />
                ) : (
                  <input
                    id={key}
                    name={key}
                    value={form[key]}
                    onChange={handleChange}
                    placeholder={placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="form-footer">
            <button type="submit" className="save-button" disabled={isSaving}>
              {isSaving ? (
                <span className="terminal-status">
                  Saving
                  <span className="loading-dots"><span /><span /><span /></span>
                </span>
              ) : savedPulse ? (
                "✓ Saved"
              ) : (
                "Save Profile"
              )}
            </button>
          </div>
        </form>
      </div>

      {(isUploading || isSaving) && (
        <div className="profile-overlay">
          <LoadingSpinner label={isUploading ? "Reading resume..." : "Saving profile..."} />
        </div>
      )}
    </div>
  );
}

export default Profile;
