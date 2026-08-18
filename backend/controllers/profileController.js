const db = require("../config/database");

async function resolveUserId(firebaseUid) {
  const result = await db.query("SELECT id FROM users WHERE firebase_uid = $1", [firebaseUid]);
  return result.rows.length ? result.rows[0].id : null;
}

/* ─── GET full profile ─── */
async function getMyProfile(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const userRes = await db.query("SELECT email, full_name FROM users WHERE id = $1", [userId]);
    const userData = userRes.rows[0] || {};

    const profileRes = await db.query(`
      SELECT cp.id, cp.user_id, cp.first_name, cp.last_name, cp.profile_picture_url,
        cp.target_role_id, cp.experience_level,
        r.name as target_role_name
      FROM candidate_profiles cp
      LEFT JOIN roles r ON cp.target_role_id = r.id
      WHERE cp.user_id = $1`, [userId]
    );
    let profile = profileRes.rows[0] || {};

    const resumeRes = await db.query(
      "SELECT id, cloudinary_url, file_name, uploaded_at FROM resumes WHERE candidate_id = $1 ORDER BY uploaded_at DESC LIMIT 1", [userId]
    );
    if (resumeRes.rows.length) {
      profile.resume_url = resumeRes.rows[0].cloudinary_url;
      profile.resume_id = resumeRes.rows[0].id;
      profile.resume_filename = resumeRes.rows[0].file_name;
    }

    const eduRes = await db.query(`
      SELECT ce.*, d.name as degree_name, sp.name as specialization_name, i.name as institution_name
      FROM candidate_education ce
      LEFT JOIN degrees d ON ce.degree_id = d.id
      LEFT JOIN specializations sp ON ce.specialization_id = sp.id
      LEFT JOIN institutions i ON ce.institution_id = i.id
      WHERE ce.user_id = $1 ORDER BY ce.graduation_year DESC NULLS LAST`, [userId]
    );
    profile.education = eduRes.rows;

    const skillsRes = await db.query(`
      SELECT sk.id, sk.name, sc.name as category FROM candidate_skills cs
      JOIN skills sk ON cs.skill_id = sk.id
      LEFT JOIN skill_categories sc ON sk.category_id = sc.id
      WHERE cs.user_id = $1 ORDER BY sk.name`, [userId]
    );
    profile.skills = skillsRes.rows;

    const projRes = await db.query(`
      SELECT cp.*,
        COALESCE(json_agg(json_build_object('id', sk.id, 'name', sk.name))
          FILTER (WHERE sk.id IS NOT NULL), '[]') as tech_stack
      FROM candidate_projects cp
      LEFT JOIN candidate_project_skills cps ON cp.id = cps.project_id
      LEFT JOIN skills sk ON cps.skill_id = sk.id
      WHERE cp.user_id = $1 GROUP BY cp.id ORDER BY cp.start_date DESC NULLS LAST`, [userId]
    );
    profile.projects = projRes.rows;

    const goalsRes = await db.query(
      "SELECT goal FROM candidate_learning_goals WHERE user_id = $1 ORDER BY goal", [userId]
    );
    profile.learning_goals = goalsRes.rows.map(r => r.goal);

    const weakRes = await db.query(
      "SELECT weak_area FROM candidate_weak_areas WHERE user_id = $1 ORDER BY weak_area", [userId]
    );
    profile.weak_areas = weakRes.rows.map(r => r.weak_area);

    profile.email = userData.email || "";
    if (!profile.first_name && !profile.last_name) {
      profile.first_name = userData.full_name || "";
    }

    profile.completion = calculateCompletion(profile);
    profile.modules = getModuleUnlock(profile);

    return res.json({ profile });
  } catch (error) {
    console.error("Get profile error", error);
    res.status(500).json({ message: "Failed to retrieve profile." });
  }
}

/* ─── Save basic info ─── */
async function saveProfile(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });
    const body = req.body;

    await db.query(`
      INSERT INTO candidate_profiles (user_id, first_name, last_name, profile_picture_url, target_role_id, experience_level)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id) DO UPDATE SET
        first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
        profile_picture_url=EXCLUDED.profile_picture_url,
        target_role_id=EXCLUDED.target_role_id, experience_level=EXCLUDED.experience_level
    `, [userId, body.first_name||"", body.last_name||"", body.profile_picture_url||"", body.target_role_id||null, body.experience_level||""]);

    return res.json({ message: "Profile saved." });
  } catch (error) {
    console.error("Save profile error", error);
    res.status(500).json({ message: "Failed to save profile." });
  }
}

/* ─── Education ─── */
async function addEducation(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const b = req.body;
    const r = await db.query(
      `INSERT INTO candidate_education (user_id, degree_id, specialization_id, institution_id, current_year, graduation_year, cgpa)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [userId, b.degree_id, b.specialization_id, b.institution_id, b.current_year||"", b.graduation_year, b.cgpa]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

async function updateEducation(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const { id } = req.params;
    const b = req.body;
    const r = await db.query(
      `UPDATE candidate_education SET degree_id=$1, specialization_id=$2, institution_id=$3, current_year=$4, graduation_year=$5, cgpa=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [b.degree_id, b.specialization_id, b.institution_id, b.current_year||"", b.graduation_year, b.cgpa, id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Not found." });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

async function deleteEducation(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    await db.query("DELETE FROM candidate_education WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
    res.json({ message: "Deleted." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

/* ─── Skills ─── */
async function addSkill(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const { skill_id } = req.body;
    if (!userId || !skill_id) return res.status(400).json({ message: "Missing data." });

    const count = await db.query("SELECT COUNT(*) FROM candidate_skills WHERE user_id=$1", [userId]);
    if (parseInt(count.rows[0].count) >= 50) return res.status(400).json({ message: "Maximum 50 skills allowed." });

    await db.query("INSERT INTO candidate_skills (user_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, skill_id]);
    res.json({ message: "Skill added." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

async function removeSkill(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    await db.query("DELETE FROM candidate_skills WHERE user_id=$1 AND skill_id=$2", [userId, req.params.skill_id]);
    res.json({ message: "Skill removed." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

/* ─── Projects ─── */
async function addProject(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const b = req.body;
    const r = await db.query(
      `INSERT INTO candidate_projects (user_id, project_name, description, github_url, live_demo, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [userId, b.project_name, b.description||"", b.github_url||"", b.live_demo||"", b.start_date, b.end_date]
    );
    if (b.skill_ids && b.skill_ids.length) {
      for (const sid of b.skill_ids) {
        await db.query("INSERT INTO candidate_project_skills (project_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [r.rows[0].id, sid]);
      }
    }
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

async function updateProject(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const { id } = req.params;
    const b = req.body;
    const r = await db.query(
      `UPDATE candidate_projects SET project_name=$1, description=$2, github_url=$3, live_demo=$4, start_date=$5, end_date=$6
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [b.project_name, b.description||"", b.github_url||"", b.live_demo||"", b.start_date, b.end_date, id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Not found." });
    if (b.skill_ids) {
      await db.query("DELETE FROM candidate_project_skills WHERE project_id=$1", [id]);
      for (const sid of b.skill_ids) {
        await db.query("INSERT INTO candidate_project_skills (project_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [id, sid]);
      }
    }
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

async function deleteProject(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    await db.query("DELETE FROM candidate_projects WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
    res.json({ message: "Deleted." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

/* ─── Learning Goals ─── */
async function saveLearningGoals(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const { goals } = req.body;
    await db.query("DELETE FROM candidate_learning_goals WHERE user_id=$1", [userId]);
    if (goals && goals.length) {
      for (const goal of goals) {
        await db.query("INSERT INTO candidate_learning_goals (user_id, goal) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, goal]);
      }
    }
    res.json({ message: "Learning goals saved." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

/* ─── Weak Areas ─── */
async function saveWeakAreas(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    const { weak_areas } = req.body;
    await db.query("DELETE FROM candidate_weak_areas WHERE user_id=$1", [userId]);
    if (weak_areas && weak_areas.length) {
      for (const wa of weak_areas) {
        await db.query("INSERT INTO candidate_weak_areas (user_id, weak_area) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, wa]);
      }
    }
    res.json({ message: "Weak areas saved." });
  } catch (e) { console.error(e); res.status(500).json({ message: "Failed." }); }
}

/* ─── Completion & Modules ─── */
function calculateCompletion(profile) {
  let pct = 0;
  const missing = [];

  if (profile.first_name && profile.last_name) { pct += 10; } else { missing.push("Basic Info"); }
  if (profile.education && profile.education.length > 0 && profile.education[0].degree_id) { pct += 15; } else { missing.push("Academic Info"); }
  if (profile.target_role_id) { pct += 20; } else { missing.push("Target Role"); }
  if (profile.skills && profile.skills.length > 0) { pct += 15; } else { missing.push("Skills"); }
  if (profile.experience_level) { pct += 5; } else { missing.push("Experience Level"); }
  if (profile.projects && profile.projects.length > 0) { pct += 15; } else { missing.push("Projects"); }
  if (profile.resume_url) { pct += 10; } else { missing.push("Resume"); }
  if (profile.learning_goals && profile.learning_goals.length > 0) { pct += 5; } else { missing.push("Learning Goals"); }
  if (profile.weak_areas && profile.weak_areas.length > 0) { pct += 5; } else { missing.push("Weak Areas"); }

  return { percentage: pct, missing };
}

function getModuleUnlock(profile) {
  const hasTargetRole = !!profile.target_role_id;
  const hasSkills = profile.skills && profile.skills.length > 0;
  const hasResume = !!profile.resume_url;
  const hasGoals = profile.learning_goals && profile.learning_goals.length > 0;
  const hasProjects = profile.projects && profile.projects.length > 0;

  return {
    general_aptitude: "unlocked",
    communication: "unlocked",
    technical_interview: (hasTargetRole && hasSkills) ? "unlocked" : "locked",
    coding_interview: hasSkills ? "unlocked" : "locked",
    resume_analysis: hasResume ? "unlocked" : "locked",
    learning_roadmap: (hasTargetRole && hasSkills && hasGoals) ? "unlocked" : "locked",
    project_viva: hasProjects ? "unlocked" : "locked",
  };
}

module.exports = {
  getMyProfile, saveProfile,
  addEducation, updateEducation, deleteEducation,
  addSkill, removeSkill,
  addProject, updateProject, deleteProject,
  saveLearningGoals, saveWeakAreas,
};
