import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AutocompleteInput from "../components/AutocompleteInput.jsx";
import LoadingSpinner from "/src/components/LoadingSpinner.jsx";
import { useAuth } from "/src/context/AuthContext.jsx";
import {
  getProfile, saveProfile,
  addEducation, updateEducation, deleteEducation,
  addSkill, removeSkill,
  addProject, updateProject, deleteProject,
  saveLearningGoals, saveWeakAreas,
  searchRoles, searchSkills, searchDegrees, searchSpecializations, searchInstitutions,
  uploadResume, deleteResume,
} from "/src/services/apiService.js";
import "/src/styles/Profile.css";

const LEARNING_GOALS = [
  "Placement Preparation", "Improve DSA", "Web Development",
  "AI & Machine Learning", "Cloud Computing", "DevOps",
  "Cyber Security", "Mobile Development", "Competitive Programming",
];

const WEAK_AREAS = [
  "Aptitude", "Communication", "DSA", "SQL", "JavaScript",
  "OOP", "Operating Systems", "DBMS", "Networking", "System Design",
];

const EXPERIENCE_LEVELS = ["Student", "Fresher", "Internship Experience", "Professional Experience"];

function getInitials(first, last, email) {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  const s = (email || "?").trim();
  return s.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Basic Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [targetRoleError, setTargetRoleError] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  // Education
  const [education, setEducation] = useState([]);

  // Skills
  const [skills, setSkills] = useState([]);
  const [skillError, setSkillError] = useState("");

  // Projects
  const [projects, setProjects] = useState([]);

  // Learning Goals & Weak Areas
  const [learningGoals, setLearningGoals] = useState([]);
  const [weakAreas, setWeakAreas] = useState([]);

  // Resume
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeId, setResumeId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const fileInputRef = useRef(null);

  // Toasts
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load
  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        const p = data?.profile || {};
        setProfile(p);
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setTargetRoleId(p.target_role_id || "");
        setExperienceLevel(p.experience_level || "");
        setEducation(p.education || []);
        setSkills(p.skills || []);
        setProjects(p.projects || []);
        setLearningGoals(p.learning_goals || []);
        setWeakAreas(p.weak_areas || []);
        setResumeUrl(p.resume_url || "");
        setResumeId(p.resume_id || null);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const initials = getInitials(firstName, lastName, user?.email);

  // Save basic info
  const handleSaveBasic = async () => {
    try {
      await saveProfile({ first_name: firstName, last_name: lastName, target_role_id: targetRoleId || null, experience_level: experienceLevel });
      showToast("Profile saved");
    } catch (e) { showToast(e?.message || "Failed to save", "error"); }
  };

  // ─── Education ───
  const handleAddEducation = async () => {
    try {
      const res = await addEducation({});
      setEducation(prev => [...prev, res]);
      showToast("Education added");
    } catch (e) { showToast(e?.message || "Failed", "error"); }
  };

  const handleUpdateEdu = async (id, data) => {
    try {
      const res = await updateEducation(id, data);
      setEducation(prev => prev.map(e => e.id === id ? { ...e, ...res } : e));
    } catch (e) { showToast(e?.message || "Failed to update", "error"); }
  };

  const handleDeleteEdu = async (id) => {
    try {
      await deleteEducation(id);
      setEducation(prev => prev.filter(e => e.id !== id));
      showToast("Education deleted");
    } catch (e) { showToast(e?.message || "Failed to delete", "error"); }
  };

  // ─── Skills ───
  const handleAddSkill = async (skillId) => {
    if (skills.length >= 50) { setSkillError("Maximum 50 skills"); return; }
    if (skills.some(s => s.id === skillId)) return;
    setSkillError("");
    try {
      await addSkill(skillId);
      const data = await getProfile();
      setSkills(data.profile.skills || []);
    } catch (e) { showToast(e?.message || "Failed to add skill", "error"); }
  };

  const handleRemoveSkill = async (skillId) => {
    try {
      await removeSkill(skillId);
      setSkills(prev => prev.filter(s => s.id !== skillId));
    } catch (e) { showToast(e?.message || "Failed to remove skill", "error"); }
  };

  // ─── Projects ───
  const handleAddProject = async () => {
    try {
      const res = await addProject({ project_name: "New Project" });
      setProjects(prev => [...prev, { ...res, tech_stack: [] }]);
      showToast("Project added");
    } catch (e) { showToast(e?.message || "Failed", "error"); }
  };

  const handleUpdateProject = async (id, data) => {
    try {
      const res = await updateProject(id, data);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...res } : p));
    } catch (e) { showToast(e?.message || "Failed to update", "error"); }
  };

  const handleDeleteProject = async (id) => {
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      showToast("Project deleted");
    } catch (e) { showToast(e?.message || "Failed to delete", "error"); }
  };

  const handleProjectSkillAdd = async (projectId, skillId) => {
    const project = projects.find(p => p.id === projectId);
    const curIds = (project?.tech_stack || []).map(s => s.id);
    if (curIds.includes(skillId)) return;
    try {
      await updateProject(projectId, { ...project, skill_ids: [...curIds, skillId] });
      const data = await getProfile();
      setProjects(data.profile.projects || []);
    } catch { showToast("Failed", "error"); }
  };

  const handleProjectSkillRemove = async (projectId, skillId) => {
    const project = projects.find(p => p.id === projectId);
    const curIds = (project?.tech_stack || []).map(s => s.id).filter(id => id !== skillId);
    try {
      await updateProject(projectId, { ...project, skill_ids: curIds });
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, tech_stack: (p.tech_stack || []).filter(s => s.id !== skillId) } : p
      ));
    } catch { showToast("Failed", "error"); }
  };

  // ─── Learning Goals & Weak Areas ───
  const handleToggleGoal = async (goal) => {
    const next = learningGoals.includes(goal)
      ? learningGoals.filter(g => g !== goal)
      : [...learningGoals, goal];
    setLearningGoals(next);
    try { await saveLearningGoals(next); } catch { showToast("Failed", "error"); }
  };

  const handleToggleWeak = async (wa) => {
    const next = weakAreas.includes(wa)
      ? weakAreas.filter(w => w !== wa)
      : [...weakAreas, wa];
    setWeakAreas(next);
    try { await saveWeakAreas(next); } catch { showToast("Failed", "error"); }
  };

  // ─── Resume ───
  const handleResumeUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const result = await uploadResume(fd);
      if (result?.profile?.resume_url) {
        setResumeUrl(result.profile.resume_url);
        setResumeId(result.profile.resume_id);
      }
      showToast("Resume uploaded");
    } catch (e) { showToast(e.message || "Upload failed", "error"); } finally { setIsUploading(false); }
  };

  const handleDeleteResume = async () => {
    setIsDeleting(true);
    try {
      await deleteResume(resumeId);
      setResumeUrl("");
      setResumeId(null);
      setShowDeleteConfirm(false);
      showToast("Resume deleted");
    } catch (e) { showToast(e.message || "Delete failed", "error"); } finally { setIsDeleting(false); }
  };

  // ─── Completion & Modules ───
  const completion = profile?.completion || { percentage: 0, missing: [] };
  const modules = profile?.modules || {};

  if (loading) return <div className="profile-page"><LoadingSpinner label="Loading profile..." /></div>;

  const resumeFileName = resumeUrl ? decodeURIComponent(resumeUrl.split("/").pop() || "resume.pdf") : null;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <span className="profile-eyebrow">PROFILE</span>
        <h1 className="profile-title">Your Profile</h1>
      </div>

      <div className="profile-grid">
        {/* ─── Sidebar ─── */}
        <aside className="profile-sidebar">
          <div className="card identity-card">
            <div className="scan-ring-wrapper">
              <svg className="scan-ring" viewBox="0 0 120 120">
                <circle className="scan-ring-track" cx="60" cy="60" r="52" />
                <circle className="scan-ring-progress" cx="60" cy="60" r="52"
                  style={{ strokeDasharray: 2 * Math.PI * 52, strokeDashoffset: 2 * Math.PI * 52 * (1 - completion.percentage / 100) }} />
              </svg>
              <div className="avatar-core">{initials}</div>
            </div>
            <p className="identity-name">{firstName || lastName ? `${firstName} ${lastName}` : "Your Name"}</p>
            <p className="identity-email">{user?.email}</p>
            <div className="completeness-readout">
              <span className="completeness-value">{completion.percentage}%</span>
              <span className="completeness-label">COMPLETE</span>
            </div>
            {completion.missing?.length > 0 && (
              <div className="missing-section">
                <span className="missing-label">Missing</span>
                {completion.missing.map(m => <span key={m} className="missing-tag">{m}</span>)}
              </div>
            )}
          </div>

          <div className="card modules-card">
            <span className="card-label">MODULES</span>
            {[
              { key: "general_aptitude", label: "General Aptitude" },
              { key: "communication", label: "Communication" },
              { key: "technical_interview", label: "Technical Interview" },
              { key: "coding_interview", label: "Coding Interview" },
              { key: "resume_analysis", label: "Resume Analysis" },
              { key: "learning_roadmap", label: "Learning Roadmap" },
              { key: "project_viva", label: "Project Viva" },
            ].map(m => (
              <div key={m.key} className={`module-row ${modules[m.key] === "unlocked" ? "unlocked" : "locked"}`}>
                <span className="module-icon">{modules[m.key] === "unlocked" ? "✓" : "🔒"}</span>
                <span className="module-name">{m.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ─── Main ─── */}
        <div className="profile-main">

          {/* 1. Basic Information */}
          <div className="card section-card">
            <span className="card-label">BASIC INFORMATION</span>
            <div className="section-fields">
              <div className="field">
                <label>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} onBlur={handleSaveBasic} />
              </div>
              <div className="field">
                <label>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} onBlur={handleSaveBasic} />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={user?.email || ""} disabled className="field-readonly" />
              </div>
            </div>
          </div>

          {/* 2. Academic Information */}
          <div className="card section-card">
            <div className="card-header">
              <span className="card-label">ACADEMIC INFORMATION</span>
              <button className="btn-add" onClick={handleAddEducation}>+ Add</button>
            </div>
            {education.map((edu) => (
              <EduCard key={edu.id} edu={edu} onUpdate={handleUpdateEdu} onDelete={handleDeleteEdu} />
            ))}
            {education.length === 0 && <p className="empty-hint">No education records yet.</p>}
          </div>

          {/* 3. Target Role */}
          <div className="card section-card">
            <span className="card-label">TARGET ROLE <span className="required">*</span></span>
            <AutocompleteInput
              value={targetRoleId ? (profile?.target_role_name || "") : ""}
              onChange={v => { setTargetRoleId(v); setTargetRoleError(""); }}
              onBlur={() => { if (!targetRoleId) setTargetRoleError("Please select a valid role."); }}
              search={searchRoles}
              placeholder="Search for a role..."
              error={targetRoleError}
            />
            <p className="field-hint">Used for AI interview generation and learning roadmap.</p>
          </div>

          {/* 4. Skills */}
          <div className="card section-card">
            <span className="card-label">SKILLS <span className="required">*</span> <span className="card-sublabel">(max 50)</span></span>
            <div className="chips-wrap">
              {skills.map(s => (
                <span key={s.id} className="chip">
                  {s.name}
                  {s.category && <span className="chip-cat">{s.category}</span>}
                  <button className="chip-remove" onClick={() => handleRemoveSkill(s.id)}>&times;</button>
                </span>
              ))}
            </div>
            <AutocompleteInput
              value=""
              onChange={v => { if (v) handleAddSkill(v); }}
              search={searchSkills}
              placeholder="Type to search skills..."
              error={skillError}
              clearOnSelect
            />
          </div>

          {/* 5. Experience Level */}
          <div className="card section-card">
            <span className="card-label">EXPERIENCE LEVEL</span>
            <select value={experienceLevel} onChange={e => { setExperienceLevel(e.target.value); saveProfile({ first_name: firstName, last_name: lastName, target_role_id: targetRoleId || null, experience_level: e.target.value }); }}>
              <option value="">Select...</option>
              {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* 6. Projects */}
          <div className="card section-card">
            <div className="card-header">
              <span className="card-label">PROJECTS</span>
              <button className="btn-add" onClick={handleAddProject}>+ Add</button>
            </div>
            {projects.map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                onUpdate={handleUpdateProject}
                onDelete={handleDeleteProject}
                onSkillAdd={handleProjectSkillAdd}
                onSkillRemove={handleProjectSkillRemove}
              />
            ))}
            {projects.length === 0 && <p className="empty-hint">No projects yet.</p>}
          </div>

          {/* 7. Resume */}
          <div className="card section-card">
            <span className="card-label">RESUME</span>
            {resumeUrl ? (
              <div className="resume-status">
                <span className="resume-filename">{resumeFileName}</span>
                <div className="resume-actions">
                  <button className="btn-link" onClick={() => setShowResumeViewer(true)}>View</button>
                  <button className="btn-sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
                  <button className="btn-sm btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
                </div>
              </div>
            ) : (
              <div className="resume-dropzone" onClick={() => fileInputRef.current?.click()}>
                <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <p className="dropzone-text">Upload your resume (PDF)</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files[0]; if (f) handleResumeUpload(f); }} />
          </div>

          {/* 8. Learning Goals */}
          <div className="card section-card">
            <span className="card-label">LEARNING GOALS</span>
            <div className="checkbox-grid">
              {LEARNING_GOALS.map(g => (
                <label key={g} className={`checkbox-label ${learningGoals.includes(g) ? "checked" : ""}`}>
                  <input type="checkbox" checked={learningGoals.includes(g)} onChange={() => handleToggleGoal(g)} />
                  {g}
                </label>
              ))}
            </div>
          </div>

          {/* 9. Weak Areas */}
          <div className="card section-card">
            <span className="card-label">WEAK AREAS</span>
            <p className="field-hint">Select areas you want the AI to prioritize.</p>
            <div className="checkbox-grid">
              {WEAK_AREAS.map(w => (
                <label key={w} className={`checkbox-label ${weakAreas.includes(w) ? "checked" : ""}`}>
                  <input type="checkbox" checked={weakAreas.includes(w)} onChange={() => handleToggleWeak(w)} />
                  {w}
                </label>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Resume viewer */}
      {showResumeViewer && (
        <div className="viewer-modal-overlay" role="dialog" onClick={() => setShowResumeViewer(false)}>
          <div className="viewer-modal" onClick={e => e.stopPropagation()}>
            <button className="viewer-close" onClick={() => setShowResumeViewer(false)}>&times;</button>
            <iframe src={resumeUrl} title="Resume" className="viewer-iframe" />
          </div>
        </div>
      )}

      {/* Resume delete confirmation */}
      {showDeleteConfirm && (
        <div className="confirm-modal-overlay" role="dialog">
          <div className="confirm-modal">
            <p className="confirm-title">Delete resume?</p>
            <p className="confirm-body">This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-button confirm-button-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</button>
              <button className="confirm-button confirm-button-danger" onClick={handleDeleteResume} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {isUploading && <div className="profile-overlay"><LoadingSpinner label="Uploading resume..." /></div>}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

/* ─── Education Card ─── */
function EduCard({ edu, onUpdate, onDelete }) {
  const [deg, setDeg] = useState(edu.degree_id || "");
  const [sp, setSp] = useState(edu.specialization_id || "");
  const [inst, setInst] = useState(edu.institution_id || "");
  const [curYear, setCurYear] = useState(edu.current_year || "");
  const [gradYear, setGradYear] = useState(edu.graduation_year || "");
  const [cgpa, setCgpa] = useState(edu.cgpa || "");

  const save = () => onUpdate(edu.id, { degree_id: deg || null, specialization_id: sp || null, institution_id: inst || null, current_year: curYear, graduation_year: gradYear || null, cgpa: cgpa || null });

  return (
    <div className="sub-card">
      <div className="sub-card-row">
        <div className="field"><label>Degree</label>
          <AutocompleteInput value={edu.degree_name || ""} onChange={setDeg} search={searchDegrees} placeholder="Degree" onSelect={() => setTimeout(save, 100)} />
        </div>
        <div className="field"><label>Specialization</label>
          <AutocompleteInput value={edu.specialization_name || ""} onChange={setSp} search={searchSpecializations} placeholder="Specialization" onSelect={() => setTimeout(save, 100)} />
        </div>
      </div>
      <div className="sub-card-row">
        <div className="field"><label>Institution</label>
          <AutocompleteInput value={edu.institution_name || ""} onChange={setInst} search={searchInstitutions} placeholder="Institution" onSelect={() => setTimeout(save, 100)} />
        </div>
      </div>
      <div className="sub-card-row sub-card-row-3">
        <div className="field"><label>Current Year</label><input value={curYear} onChange={e => setCurYear(e.target.value)} onBlur={save} placeholder="e.g. 3rd Year" /></div>
        <div className="field"><label>Grad Year</label><input type="number" value={gradYear} onChange={e => setGradYear(e.target.value)} onBlur={save} placeholder="2027" /></div>
        <div className="field"><label>CGPA</label><input type="number" step="0.01" max="10" value={cgpa} onChange={e => setCgpa(e.target.value)} onBlur={save} placeholder="8.5" /></div>
      </div>
      <button className="btn-delete" onClick={() => onDelete(edu.id)}>Remove</button>
    </div>
  );
}

/* ─── Project Card ─── */
function ProjectCard({ project, onUpdate, onDelete, onSkillAdd, onSkillRemove }) {
  const [name, setName] = useState(project.project_name || "");
  const [desc, setDesc] = useState(project.description || "");
  const [gh, setGh] = useState(project.github_url || "");
  const [demo, setDemo] = useState(project.live_demo || "");
  const timer = useRef(null);

  const save = (overrides = {}) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onUpdate(project.id, { project_name: name, description: desc, github_url: gh, live_demo: demo, ...overrides });
    }, 400);
  };

  return (
    <div className="sub-card">
      <div className="field"><label>Project Name</label><input value={name} onChange={e => setName(e.target.value)} onBlur={() => save()} /></div>
      <div className="field"><label>Description</label><textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} onBlur={() => save()} /></div>
      <div className="sub-card-row">
        <div className="field"><label>GitHub URL</label><input value={gh} onChange={e => setGh(e.target.value)} onBlur={() => save()} placeholder="https://github.com/..." /></div>
        <div className="field"><label>Live Demo</label><input value={demo} onChange={e => setDemo(e.target.value)} onBlur={() => save()} placeholder="https://..." /></div>
      </div>
      <div className="field"><label>Tech Stack</label>
        <div className="chips-wrap">
          {(project.tech_stack || []).map(s => (
            <span key={s.id} className="chip chip-sm">{s.name}<button className="chip-remove" onClick={() => onSkillRemove(project.id, s.id)}>&times;</button></span>
          ))}
        </div>
        <AutocompleteInput value="" onChange={v => { if (v) onSkillAdd(project.id, v); }} search={searchSkills} placeholder="Add skill..." clearOnSelect />
      </div>
      <button className="btn-delete" onClick={() => onDelete(project.id)}>Remove</button>
    </div>
  );
}
