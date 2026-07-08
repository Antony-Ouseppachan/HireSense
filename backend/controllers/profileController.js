const db = require("../config/database");

/**
 * Resolve the internal users.id (bigint) from the Firebase uid
 * attached to the request by the auth middleware.
 */
async function resolveUserId(firebaseUid) {
  const result = await db.query(
    "SELECT id FROM users WHERE firebase_uid = $1",
    [firebaseUid]
  );
  return result.rows.length ? result.rows[0].id : null;
}

/**
 * GET /api/profile
 * Returns the profile for the authenticated user, or { profile: null }
 * when they haven't created one yet (so new users don't get a 404).
 */
async function getMyProfile(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) {
      return res.status(404).json({ message: "User not found." });
    }

    const result = await db.query(
      `SELECT id, user_id, name, education, skills, experience, projects, target_role
       FROM profiles
       WHERE user_id = $1`,
      [userId]
    );

    const profile = result.rows[0] || null;

    // Attach the most recent resume (if any) so the UI can display a stable resume_url
    try {
      const resumeRes = await db.query(
        `SELECT id, file_url FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
        [userId]
      );

      if (resumeRes.rows.length && profile) {
        profile.resume_url = resumeRes.rows[0].file_url;
        profile.resume_id = resumeRes.rows[0].id;
      } else if (resumeRes.rows.length && !profile) {
        // return a minimal profile object containing just resume_url and id for new users
        return res.json({ profile: { resume_url: resumeRes.rows[0].file_url, resume_id: resumeRes.rows[0].id } });
      }
    } catch (attachErr) {
      console.warn("Failed to attach resume to profile", attachErr);
    }

    return res.json({ profile });
  } catch (error) {
    console.error("Get profile error", error);
    res.status(500).json({ message: "Failed to retrieve profile." });
  }
}

/**
 * POST /api/profile
 * Creates or updates the authenticated user's profile (upsert on user_id).
 */
async function saveProfile(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) {
      return res.status(404).json({ message: "User not found." });
    }

    const {
      name = "",
      education = "",
      skills = "",
      experience = "",
      projects = "",
      target_role = "",
    } = req.body;

    const result = await db.query(
      `INSERT INTO profiles (user_id, name, education, skills, experience, projects, target_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         education = EXCLUDED.education,
         skills = EXCLUDED.skills,
         experience = EXCLUDED.experience,
         projects = EXCLUDED.projects,
         target_role = EXCLUDED.target_role
       RETURNING id, user_id, name, education, skills, experience, projects, target_role`,
      [userId, name, education, skills, experience, projects, target_role]
    );

    return res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Save profile error", error);
    res.status(500).json({ message: "Failed to save profile." });
  }
}

module.exports = {
  getMyProfile,
  saveProfile,
};
