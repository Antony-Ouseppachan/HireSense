import { useEffect, useState } from "react";

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
  const [resumeFile, setResumeFile] = useState(null);

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

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    setResumeFile(file);
    if (!file) return;

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("userId", user.id);

    const result = await onResumeUpload(formData);
    if (result?.profile) {
      setForm((prev) => ({ ...prev, resume_url: result.profile.resume_url }));
      alert("Resume uploaded successfully.");
    }
  };

  return (
    <div className="page-container">
      <h1>Profile</h1>
      <form onSubmit={handleSubmit} className="form-card">
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />

        <label>Role</label>
        <input name="role" value={form.role} onChange={handleChange} />

        <label>Education</label>
        <textarea name="education" value={form.education} onChange={handleChange} rows="3" />

        <label>Skills</label>
        <textarea name="skills" value={form.skills} onChange={handleChange} rows="3" />

        <label>Experience</label>
        <textarea name="experience" value={form.experience} onChange={handleChange} rows="3" />

        <label>Projects</label>
        <textarea name="projects" value={form.projects} onChange={handleChange} rows="3" />

        <button type="submit">Save Profile</button>
      </form>

      <div className="card">
        <h2>Resume upload</h2>
        <input type="file" accept="application/pdf" onChange={handleResumeUpload} />
        {form.resume_url && (
          <p>Resume saved: <a href={form.resume_url} target="_blank" rel="noreferrer">View resume</a></p>
        )}
      </div>
    </div>
  );
}

export default Profile;
