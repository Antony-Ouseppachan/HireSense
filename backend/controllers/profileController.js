const { pool } = require("../db");

async function getProfileByUserId(req, res) {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT id, user_id, education, skills, experience, resume_url FROM profiles WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found." });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile error", error);
    res.status(500).json({ message: "Failed to retrieve profile." });
  }
}

async function createProfile(req, res) {
  try {
    const { user_id, education, skills, experience, resume_url } = req.body;
    if (!user_id || !education || !skills || !experience) {
      return res.status(400).json({ message: "user_id, education, skills, and experience are required." });
    }

    const result = await pool.query(
      `INSERT INTO profiles (user_id, education, skills, experience, resume_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, education, skills, experience, resume_url`,
      [user_id, education, skills, experience, resume_url || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create profile error", error);
    res.status(500).json({ message: "Failed to create profile." });
  }
}

async function updateProfileById(req, res) {
  try {
    const { id } = req.params;
    const { education, skills, experience, resume_url } = req.body;

    const result = await pool.query(
      `UPDATE profiles
       SET education = $1,
           skills = $2,
           experience = $3,
           resume_url = $4
       WHERE id = $5
       RETURNING id, user_id, education, skills, experience, resume_url`,
      [education, skills, experience, resume_url || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update profile error", error);
    res.status(500).json({ message: "Failed to update profile." });
  }
}

module.exports = {
  getProfileByUserId,
  createProfile,
  updateProfileById
};
